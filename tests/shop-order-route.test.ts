import './helpers/test-env'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'
import type { Payload } from 'payload'

// The mail module is mocked at the module boundary so no test ever opens an SMTP
// connection. The mock factory only provides what the route imports.
vi.mock('@/lib/mail', () => ({
  sendShopOrderNotification: vi.fn(),
}))

// The route boots Payload through the `@payload-config` alias; redirect it to a
// test config that registers exactly the collections the pipeline touches.
// The config object is shared with `getTestPayload` below so both resolve to the
// same singleton Payload instance on the shared SQLite file.
vi.mock('@payload-config', async () => {
  const { getTestConfig } = await import('./helpers/test-payload')
  const { ShopOrders } = await import('../src/collections/ShopOrders')
  const { ShopReservations } = await import('../src/collections/ShopReservations')
  const { ShopStock } = await import('../src/collections/ShopStock')
  return { default: getTestConfig([ShopOrders, ShopReservations, ShopStock]) }
})

import { POST } from '../src/app/(frontend)/api/shop-order/route'
import { sendShopOrderNotification } from '@/lib/mail'
import { getTestPayload, getStockValue, resetState, seedStock, teardownTestPayload } from './helpers/test-payload'
import { verifyOrderToken, signOrderPayload, type OrderPayload } from '../src/lib/shop-order-token'
import { catalogKey } from '../src/lib/shop-catalog'
import { SHOP_RESERVATION_TTL_MS } from '../src/lib/shop'
import { ShopOrders } from '../src/collections/ShopOrders'
import { ShopReservations } from '../src/collections/ShopReservations'
import { ShopStock } from '../src/collections/ShopStock'

const routeCollections = [ShopOrders, ShopReservations, ShopStock]

const FLEECE_KEY = catalogKey('Giacca Fleece Uomo', 'Grigia', 'L')
const FLEECE_ITEM = {
  productName: 'Giacca Fleece Uomo',
  edition: 'ed. 2023',
  variant: 'Grigia',
  size: 'L',
  quantity: 1,
}
const FLEECE_INITIAL_STOCK = 2

let payload: Payload
const mockSendShopOrderNotification = vi.mocked(sendShopOrderNotification)

// The rate limiter keeps module-level per-IP state with a 60s window; every test
// works from a fresh IP so buckets never leak between tests.
let ipCounter = 0
function nextIp() {
  ipCounter += 1
  return `10.0.${Math.floor(ipCounter / 250)}.${(ipCounter % 250) + 1}`
}

function postShopOrder(body: unknown, ip = nextIp()): Promise<Response> {
  const request = new Request('http://localhost:3000/api/shop-order', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify(body),
  })
  return POST(request)
}

function prepareBody(overrides: Record<string, unknown> = {}) {
  return {
    action: 'prepare',
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario.rossi@example.ch',
    phone: '+41 79 123 45 67',
    address: 'Via ai Ronchi 12',
    postalCode: '6600',
    city: 'Locarno',
    notes: '',
    paymentMethod: 'twint',
    items: [FLEECE_ITEM],
    website: '',
    renderTs: Date.now() - 10_000,
    ...overrides,
  }
}

function orderPayloadForToken(orderRef: string, overrides: Partial<OrderPayload> = {}): OrderPayload {
  return {
    orderRef,
    firstName: 'Mario',
    lastName: 'Rossi',
    email: 'mario.rossi@example.ch',
    phone: '+41 79 123 45 67',
    address: 'Via ai Ronchi 12',
    postalCode: '6600',
    city: 'Locarno',
    notes: '',
    paymentMethod: 'twint',
    paymentStatus: 'paid',
    total: 55,
    createdAt: new Date().toISOString(),
    items: [{ ...FLEECE_ITEM, unitPrice: 55 }],
    ...overrides,
  }
}

async function findOrders(orderRef: string) {
  return payload.find({
    collection: 'shop-orders',
    where: { orderRef: { equals: orderRef } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
}

async function findReservations(orderRef: string) {
  return payload.find({
    collection: 'shop-reservations',
    where: { orderRef: { equals: orderRef } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
}

async function countAllOrders(): Promise<number> {
  const result = await payload.find({
    collection: 'shop-orders',
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return result.totalDocs
}

async function clearOrders() {
  const found = await payload.find({
    collection: 'shop-orders',
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of found.docs) {
    await payload.delete({ collection: 'shop-orders', id: doc.id, overrideAccess: true })
  }
}

beforeAll(async () => {
  payload = await getTestPayload({ collections: routeCollections })
  await seedStock(payload)
})

beforeEach(async () => {
  await clearOrders()
  await resetState(payload, { [FLEECE_KEY]: FLEECE_INITIAL_STOCK })
  mockSendShopOrderNotification.mockReset()
})

afterAll(async () => {
  await teardownTestPayload()
})

describe('prepare (twint) — happy path', () => {
  it('returns a RaiseNow checkout URL prefilled with amount and reference and creates an active reservation', async () => {
    const ip = nextIp()
    const res = await postShopOrder(prepareBody(), ip)
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.orderRef).toEqual(expect.any(String))

    const checkout = new URL(data.checkoutUrl)
    expect(checkout.host).toBe('pay.raisenow.io')
    expect(checkout.searchParams.get('amount.values')).toBe('55.00')
    expect(checkout.searchParams.get('amount.custom')).toBe('false')
    expect(checkout.searchParams.get('reference.campaign_subid')).toBe(data.orderRef)
    expect(checkout.searchParams.get('payment_method.values')).toBe('twint')
    expect(checkout.searchParams.get('payment_method.custom')).toBe('false')
    expect(checkout.searchParams.get('supporter.email.value')).toBe('mario.rossi@example.ch')
    expect(checkout.searchParams.get('supporter.first_name.value')).toBe('Mario')

    // the returned token round-trips to the order the server decided on
    const order = verifyOrderToken(data.orderToken)
    expect(order.orderRef).toBe(data.orderRef)
    expect(order.total).toBe(55)
    expect(order.paymentMethod).toBe('twint')
    expect(order.paymentStatus).toBe('paid')
    expect(order.items).toEqual([{ ...FLEECE_ITEM, unitPrice: 55 }])

    // exactly one active reservation backs the checkout
    const reservations = await findReservations(data.orderRef)
    expect(reservations.totalDocs).toBe(1)
    expect((reservations.docs[0] as { status?: string }).status).toBe('active')

    // no order row yet, physical stock untouched, no email yet
    expect(await countAllOrders()).toBe(0)
    expect(await getStockValue(payload, FLEECE_KEY)).toBe(FLEECE_INITIAL_STOCK)
    expect(mockSendShopOrderNotification).not.toHaveBeenCalled()
  })
})

describe('prepare (invoice) — order created immediately', () => {
  it('creates the order row, decrements stock and sends the notification email', async () => {
    const res = await postShopOrder(prepareBody({ paymentMethod: 'invoice' }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toMatchObject({
      success: true,
      paymentMethod: 'invoice',
      paymentStatus: 'pending_invoice',
    })
    // invoice orders never go through RaiseNow
    expect(data.checkoutUrl).toBeUndefined()
    expect(data.orderToken).toBeUndefined()

    const orders = await findOrders(data.orderRef)
    expect(orders.totalDocs).toBe(1)
    const order = orders.docs[0] as unknown as Record<string, unknown>
    expect(order.paymentMethod).toBe('invoice')
    expect(order.paymentStatus).toBe('pending_invoice')
    expect(order.total).toBe(55)
    expect(order.firstName).toBe('Mario')
    expect(order.lastName).toBe('Rossi')
    expect(order.fullName).toBe('Rossi Mario')
    expect(order.email).toBe('mario.rossi@example.ch')
    expect(order.items).toEqual([{ ...FLEECE_ITEM, unitPrice: 55 }])

    // stock is decremented immediately (no reservation round-trip for invoices)
    expect(await getStockValue(payload, FLEECE_KEY)).toBe(FLEECE_INITIAL_STOCK - 1)

    expect(mockSendShopOrderNotification).toHaveBeenCalledTimes(1)
    expect(mockSendShopOrderNotification.mock.calls[0][0].orderRef).toBe(data.orderRef)
  })
})

describe('prepare rejections', () => {
  it('silently swallows a honeypot submission without persisting or mailing anything', async () => {
    const res = await postShopOrder(prepareBody({ website: 'http://spam.example' }))
    expect(res.status).toBe(200)

    const data = await res.json()
    expect(data).toMatchObject({
      success: true,
      paymentMethod: 'invoice',
      paymentStatus: 'pending_invoice',
    })
    expect(data.orderRef).toEqual(expect.any(String))

    expect(await countAllOrders()).toBe(0)
    expect((await findReservations(data.orderRef)).totalDocs).toBe(0)
    expect(mockSendShopOrderNotification).not.toHaveBeenCalled()
  })

  it('rejects a submission with missing fields', async () => {
    const { lastName: _omitted, ...partial } = prepareBody()
    const res = await postShopOrder(partial)
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Dati ordine incompleti.')
  })

  it('rejects a missing antispam render timestamp', async () => {
    const res = await postShopOrder(prepareBody({ renderTs: undefined }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Verifica anti-spam non superata. Ricarica la pagina e riprova.')
  })

  it('rejects a form submitted too fast after render', async () => {
    const res = await postShopOrder(prepareBody({ renderTs: Date.now() }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Verifica anti-spam non superata. Ricarica la pagina e riprova.')
  })

  it('rejects a blocked email domain', async () => {
    const res = await postShopOrder(prepareBody({ email: 'spam@mailinator.com' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Indirizzo email non valido.')
  })

  it('rejects non-string field values', async () => {
    const res = await postShopOrder(prepareBody({ email: 123 }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Dati non validi.')
  })

  it('rejects over-long notes', async () => {
    const res = await postShopOrder(prepareBody({ notes: 'x'.repeat(2001) }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Dati ordine troppo lunghi.')
  })

  it('rejects a quantity outside the allowed range', async () => {
    const res = await postShopOrder(prepareBody({ items: [{ ...FLEECE_ITEM, quantity: 0 }] }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Carrello non valido.')
  })

  it('rejects a payment method other than twint/invoice', async () => {
    const res = await postShopOrder(prepareBody({ paymentMethod: 'bitcoin' }))
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Metodo di pagamento non valido.')
  })

  it('rejects a product that is not in the catalog', async () => {
    const res = await postShopOrder(
      prepareBody({
        items: [{ productName: 'Prodotto Inesistente', edition: 'ed. 2099', variant: 'Niente', size: 'M', quantity: 1 }],
      }),
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Articolo non valido o non più disponibile.')
  })

  it('returns 409 with the Italian stock message when a twint reservation exceeds availability', async () => {
    await resetState(payload, { [FLEECE_KEY]: 0 })
    const res = await postShopOrder(prepareBody())
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe(
      'Articolo esaurito: Giacca Fleece Uomo (Grigia, taglia L). Riprova più tardi.',
    )
    expect((await findReservations('whatever')).totalDocs).toBe(0)
  })

  it('returns 409 and creates no order when the invoice path exceeds availability', async () => {
    await resetState(payload, { [FLEECE_KEY]: 1 })
    const res = await postShopOrder(
      prepareBody({ paymentMethod: 'invoice', items: [{ ...FLEECE_ITEM, quantity: 2 }] }),
    )
    expect(res.status).toBe(409)
    expect((await res.json()).error).toContain('Articolo esaurito')
    expect(await countAllOrders()).toBe(0)
    expect(await getStockValue(payload, FLEECE_KEY)).toBe(1)
    expect(mockSendShopOrderNotification).not.toHaveBeenCalled()
  })
})

describe('confirm', () => {
  it('creates exactly one order row, sends the email, consumes the reservation and is idempotent', async () => {
    const ip = nextIp()
    const prepareRes = await postShopOrder(prepareBody(), ip)
    const { orderToken, orderRef } = (await prepareRes.json()) as { orderToken: string; orderRef: string }

    const confirmRes = await postShopOrder({ action: 'confirm', orderToken }, ip)
    expect(confirmRes.status).toBe(200)
    expect(await confirmRes.json()).toEqual({
      success: true,
      orderRef,
      paymentMethod: 'twint',
      paymentStatus: 'paid',
    })

    const orders = await findOrders(orderRef)
    expect(orders.totalDocs).toBe(1)
    const orderRow = orders.docs[0] as unknown as Record<string, unknown>
    expect(orderRow.paymentMethod).toBe('twint')
    expect(orderRow.paymentStatus).toBe('paid')
    expect(orderRow.total).toBe(55)

    expect(mockSendShopOrderNotification).toHaveBeenCalledTimes(1)
    expect(mockSendShopOrderNotification.mock.calls[0][0].orderRef).toBe(orderRef)

    const reservations = await findReservations(orderRef)
    expect(reservations.totalDocs).toBe(1)
    expect((reservations.docs[0] as { status?: string }).status).toBe('fulfilled')

    // physical stock decremented exactly once by consumeReservation
    expect(await getStockValue(payload, FLEECE_KEY)).toBe(FLEECE_INITIAL_STOCK - 1)

    // second confirm: alreadyConfirmed, still exactly ONE order row, no second email
    const secondRes = await postShopOrder({ action: 'confirm', orderToken }, ip)
    expect(secondRes.status).toBe(200)
    expect(await secondRes.json()).toEqual({
      success: true,
      alreadyConfirmed: true,
      orderRef,
      paymentMethod: 'twint',
      paymentStatus: 'paid',
    })
    expect((await findOrders(orderRef)).totalDocs).toBe(1)
    expect(mockSendShopOrderNotification).toHaveBeenCalledTimes(1)
    expect(await getStockValue(payload, FLEECE_KEY)).toBe(FLEECE_INITIAL_STOCK - 1)
  })

  it('returns 400 for an expired token', async () => {
    const expiredToken = signOrderPayload(
      orderPayloadForToken(crypto.randomUUID(), {
        createdAt: new Date(Date.now() - SHOP_RESERVATION_TTL_MS - 60_000).toISOString(),
      }),
    )
    const res = await postShopOrder({ action: 'confirm', orderToken: expiredToken })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Ordine scaduto, riprovare dal carrello.')
  })

  it('returns 409 when the reservation is missing (token fresh, nothing reserved)', async () => {
    const token = signOrderPayload(orderPayloadForToken(crypto.randomUUID()))
    const res = await postShopOrder({ action: 'confirm', orderToken: token })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('La prenotazione è scaduta o non più valida. Riprova dal carrello.')
  })

  it('returns 409 when the reservation has expired before confirmation', async () => {
    const prepareRes = await postShopOrder(prepareBody())
    const { orderToken, orderRef } = (await prepareRes.json()) as { orderToken: string; orderRef: string }

    const reservations = await findReservations(orderRef)
    const reservation = reservations.docs[0] as { id: number | string }
    await payload.update({
      collection: 'shop-reservations',
      id: reservation.id,
      data: { expiresAt: new Date(Date.now() - 1_000).toISOString() },
      overrideAccess: true,
    })

    const res = await postShopOrder({ action: 'confirm', orderToken })
    expect(res.status).toBe(409)
    expect((await res.json()).error).toBe('La prenotazione è scaduta o non più valida. Riprova dal carrello.')

    // the sweep marked the stale reservation as expired (watchdog needs to see it)
    const after = await findReservations(orderRef)
    expect((after.docs[0] as { status?: string }).status).toBe('expired')
    expect(await countAllOrders()).toBe(0)
  })

  it('returns 400 when the orderToken is missing', async () => {
    const res = await postShopOrder({ action: 'confirm' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Token ordine mancante.')
  })

  it('rejects the handler promise for a structurally invalid token (POST returns handleConfirm without awaiting, so the route catch-all never fires — Next.js surfaces a generic 500)', async () => {
    await expect(postShopOrder({ action: 'confirm', orderToken: 'garbage' })).rejects.toThrowError(
      'Token format invalid',
    )
  })

  it('returns 400 for an unknown action', async () => {
    const res = await postShopOrder({ action: 'bogus' })
    expect(res.status).toBe(400)
    expect((await res.json()).error).toBe('Azione non valida.')
  })
})

describe('rate limiting', () => {
  it('returns 429 on the 4th request within a minute from the same IP', async () => {
    const ip = nextIp()
    for (let i = 0; i < 3; i++) {
      const res = await postShopOrder({ action: 'prepare' }, ip)
      expect(res.status).toBe(400)
    }

    const fourth = await postShopOrder(prepareBody(), ip)
    expect(fourth.status).toBe(429)
    expect((await fourth.json()).error).toBe('Troppe richieste. Riprova più tardi.')

    // a different IP is unaffected (fresh bucket)
    const otherIp = await postShopOrder({ action: 'prepare' }, nextIp())
    expect(otherIp.status).toBe(400)
  })
})

describe('incident 2026-09-26 regression (lost shop order)', () => {
  it('prepare without confirm leaves NO order row but keeps an active reservation', async () => {
    const res = await postShopOrder(prepareBody())
    expect(res.status).toBe(200)
    const { orderRef } = (await res.json()) as { orderRef: string }

    // the exact production failure mode: reservation exists, order never does
    expect((await findOrders(orderRef)).totalDocs).toBe(0)
    const reservations = await findReservations(orderRef)
    expect(reservations.totalDocs).toBe(1)
    expect((reservations.docs[0] as { status?: string }).status).toBe('active')
    expect(mockSendShopOrderNotification).not.toHaveBeenCalled()
  })

  // Written against the webhook contract in
  // plans/tickets/2026-09-26-A-shop-server-side-order-confirmation.md.
  // TODO(Ticket A): unskip when feat/shop-server-side-confirm lands.
  describe("POST /api/shop-webhook", () => {
    it('creates the order when RaiseNow reports payment success even if the browser never returns', async () => {
      const prepareRes = await postShopOrder(prepareBody())
      const { orderRef } = (await prepareRes.json()) as { orderRef: string }

      const webhookModulePath = '../src/app/(frontend)/api/shop-webhook/route'
      const { POST: webhookPOST } = (await import(webhookModulePath)) as { POST: typeof POST }

      const webhookRes = await webhookPOST(
        new Request('http://localhost:3000/api/shop-webhook', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-forwarded-for': nextIp(), 'x-webhook-secret': process.env.SHOP_WEBHOOK_SECRET ?? '' },
          body: JSON.stringify({
            event: 'payment.succeeded',
            transaction: { id: 'rn-txn-1', status: 'success' },
            reference: { campaign_subid: orderRef },
          }),
        }),
      )
      expect(webhookRes.status).toBe(200)

      // paid order exists, email sent, reservation consumed
      expect((await findOrders(orderRef)).totalDocs).toBe(1)
      expect(mockSendShopOrderNotification).toHaveBeenCalledTimes(1)
      expect(((await findReservations(orderRef)).docs[0] as { status?: string }).status).toBe('fulfilled')

      // the late client-side fallback confirm stays idempotent
      expect(await countAllOrders()).toBe(1)
    })
  })
})

describe('mail failure resilience', () => {
  it('invoice path: a throwing mailer still returns success and keeps the order, and logs the failure', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSendShopOrderNotification.mockRejectedValueOnce(new Error('SMTP down'))
    try {
      const res = await postShopOrder(prepareBody({ paymentMethod: 'invoice' }))
      expect(res.status).toBe(200)
      const data = await res.json()
      expect(data.success).toBe(true)

      expect((await findOrders(data.orderRef)).totalDocs).toBe(1)
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[shop-order] email failed'), expect.any(Error))
    } finally {
      errorSpy.mockRestore()
    }
  })

  it('twint confirm path: a throwing mailer still returns success, keeps the order and consumed the reservation', async () => {
    const prepareRes = await postShopOrder(prepareBody())
    const { orderToken, orderRef } = (await prepareRes.json()) as { orderToken: string; orderRef: string }

    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    mockSendShopOrderNotification.mockRejectedValueOnce(new Error('SMTP down'))
    try {
      const res = await postShopOrder({ action: 'confirm', orderToken })
      expect(res.status).toBe(200)
      expect((await res.json()).success).toBe(true)

      expect((await findOrders(orderRef)).totalDocs).toBe(1)
      expect(((await findReservations(orderRef)).docs[0] as { status?: string }).status).toBe('fulfilled')
      expect(errorSpy).toHaveBeenCalledWith(expect.stringContaining('[shop-order] email failed'), expect.any(Error))
    } finally {
      errorSpy.mockRestore()
    }
  })
})
