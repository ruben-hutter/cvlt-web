import { mkdirSync, rmSync } from 'fs'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import crypto from 'node:crypto'
import type { Payload } from 'payload'

vi.mock('@/lib/mail', () => ({
  sendShopOrderNotification: vi.fn(async () => {}),
}))

import { sendShopOrderNotification } from '@/lib/mail'
import { getPayload } from 'payload'
import config from '@payload-config'
import { POST as webhookPost } from '../src/app/(frontend)/api/shop-webhook/route'
import { POST as shopOrderPost } from '../src/app/(frontend)/api/shop-order/route'
import { saveOrderToDb } from '@/lib/shop-orders'
import { catalogKey } from '../src/lib/shop-catalog'
import { consumeReservation, reserveItems } from '../src/lib/shop-stock'
import { getStockValue, resetState, seedStock } from './helpers/test-payload'

const sendMock = vi.mocked(sendShopOrderNotification)

const SECRET = 'test-webhook-secret'
const KEY = catalogKey('Giacca Fleece Uomo', 'Grigia', 'L')
const TTL = 2 * 60 * 60 * 1000
const DB_FILE = './.tmp/test-webhook-config.db'

// RaiseNow-style webhook fixture. `reference.campaign_subid` carries our
// orderRef (set by buildCheckoutUrl); amount is in minor units (cents).
function buildWebhookBody(orderRef: string) {
  return {
    transaction_uuid: '6f9619ff-8b86-d011-b42d-00c04fc964ff',
    status: 'finalized',
    test: false,
    amount: 5500,
    currency: 'chf',
    payment_method: { provider: 'twint', brand: 'twint' },
    reference: { campaign_id: 'cvlt-shop', campaign_subid: orderRef },
    supporter: {
      first_name: 'Mario',
      last_name: 'Rossi',
      email: 'mario.rossi@example.com',
      phone: '+41 91 123 45 67',
      street: 'Via ai Ronchi',
      house_number: '12',
      zip_code: '6600',
      city: 'Locarno',
    },
  }
}

function webhookRequest(body: unknown, headers: Record<string, string> = { 'x-webhook-secret': SECRET }) {
  return new Request('http://localhost:3000/api/shop-webhook', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function statusRequest(orderRef: string) {
  return new Request('http://localhost:3000/api/shop-order', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'status', orderRef }),
  })
}

async function createReservation(payload: Payload, orderRef: string) {
  await reserveItems(payload, [{ key: KEY, qty: 1 }], orderRef, TTL)
}

async function findReservation(payload: Payload, orderRef: string) {
  const result = await payload.find({
    collection: 'shop-reservations',
    where: { orderRef: { equals: orderRef } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] as unknown as { id: number | string; status: string } | undefined
}

async function expireReservation(payload: Payload, orderRef: string, statusOverride?: 'released') {
  const reservation = await findReservation(payload, orderRef)
  expect(reservation).toBeDefined()
  await payload.update({
    collection: 'shop-reservations',
    id: reservation!.id,
    data: {
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      ...(statusOverride ? { status: statusOverride } : {}),
    },
    overrideAccess: true,
  })
}

async function countOrders(payload: Payload, orderRef: string) {
  const result = await payload.find({
    collection: 'shop-orders',
    where: { orderRef: { equals: orderRef } },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return result.totalDocs
}

async function getOrder(payload: Payload, orderRef: string) {
  const result = await payload.find({
    collection: 'shop-orders',
    where: { orderRef: { equals: orderRef } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] as unknown as Record<string, unknown> | undefined
}

async function clearOrders(payload: Payload) {
  const result = await payload.find({
    collection: 'shop-orders',
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  for (const doc of result.docs) {
    await payload.delete({ collection: 'shop-orders', id: doc.id, overrideAccess: true })
  }
}

let payload: Payload

beforeAll(async () => {
  mkdirSync('./.tmp', { recursive: true })
  for (const suffix of ['', '-wal', '-shm', '-journal']) {
    rmSync(DB_FILE + suffix, { force: true })
  }
  // Same config object the route modules resolve via '@payload-config', so
  // getPayload hands route code and tests the exact same instance.
  payload = await getPayload({ config })
  await seedStock(payload)
})

beforeEach(async () => {
  await resetState(payload, { [KEY]: 2 })
  await clearOrders(payload)
  sendMock.mockClear()
})

afterAll(async () => {
  await payload?.db.destroy?.()
})

describe('shop webhook (POST /api/shop-webhook)', () => {
  it('finalizes the order on a successful payment (happy path)', async () => {
    const orderRef = crypto.randomUUID()
    await createReservation(payload, orderRef)

    const res = await webhookPost(webhookRequest(buildWebhookBody(orderRef)))
    expect(res.status).toBe(200)
    const data = await res.json()
    expect(data.success).toBe(true)
    expect(data.alreadyConfirmed).toBeUndefined()

    const order = await getOrder(payload, orderRef)
    expect(order).toBeDefined()
    expect(order?.paymentMethod).toBe('twint')
    expect(order?.paymentStatus).toBe('paid')
    expect(order?.total).toBe(55)
    expect(order?.firstName).toBe('Mario')
    expect(order?.lastName).toBe('Rossi')
    expect(order?.email).toBe('mario.rossi@example.com')
    expect(order?.phone).toBe('+41 91 123 45 67')
    expect(order?.address).toBe('Via ai Ronchi 12')
    expect(order?.postalCode).toBe('6600')
    expect(order?.city).toBe('Locarno')
    expect(order?.items).toEqual([
      {
        productName: 'Giacca Fleece Uomo',
        edition: 'ed. 2023',
        variant: 'Grigia',
        size: 'L',
        quantity: 1,
        unitPrice: 55,
      },
    ])

    // Reservation consumed, stock decremented exactly once.
    expect((await findReservation(payload, orderRef))?.status).toBe('fulfilled')
    expect(await getStockValue(payload, KEY)).toBe(1)

    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(sendMock.mock.calls[0]?.[0]).toMatchObject({ orderRef, total: 55 })
  })

  it('is idempotent: a double delivery creates exactly one order and sends one email', async () => {
    const orderRef = crypto.randomUUID()
    await createReservation(payload, orderRef)
    const body = buildWebhookBody(orderRef)

    const first = await webhookPost(webhookRequest(body))
    const second = await webhookPost(webhookRequest(body))

    expect(first.status).toBe(200)
    expect(second.status).toBe(200)
    expect((await second.json()).alreadyConfirmed).toBe(true)
    expect(await countOrders(payload, orderRef)).toBe(1)
    expect(sendMock).toHaveBeenCalledTimes(1)
    expect(await getStockValue(payload, KEY)).toBe(1)
  })

  it('does not duplicate an order already confirmed by the client fallback', async () => {
    const orderRef = crypto.randomUUID()
    await createReservation(payload, orderRef)

    // Simulate the client confirm having won the race.
    const consumed = await consumeReservation(payload, orderRef)
    expect(consumed).toBe(true)
    await saveOrderToDb({
      orderRef,
      firstName: 'Mario',
      lastName: 'Rossi',
      email: 'mario.rossi@example.com',
      phone: '+41 91 123 45 67',
      address: 'Via ai Ronchi 12',
      postalCode: '6600',
      city: 'Locarno',
      notes: '',
      paymentMethod: 'twint',
      paymentStatus: 'paid',
      total: 55,
      createdAt: new Date().toISOString(),
      items: [
        {
          productName: 'Giacca Fleece Uomo',
          edition: 'ed. 2023',
          variant: 'Grigia',
          size: 'L',
          quantity: 1,
          unitPrice: 55,
        },
      ],
    })

    const res = await webhookPost(webhookRequest(buildWebhookBody(orderRef)))
    expect(res.status).toBe(200)
    expect((await res.json()).alreadyConfirmed).toBe(true)
    expect(await countOrders(payload, orderRef)).toBe(1)
    expect(sendMock).not.toHaveBeenCalled()
  })

  it('answers 404 for an unknown orderRef and stores nothing', async () => {
    const res = await webhookPost(webhookRequest(buildWebhookBody(crypto.randomUUID())))
    expect(res.status).toBe(404)
    expect(sendMock).not.toHaveBeenCalled()
    expect(await countOrders(payload, crypto.randomUUID())).toBe(0)
  })

  it('confirms an order even when the reservation TTL has expired', async () => {
    const orderRef = crypto.randomUUID()
    await createReservation(payload, orderRef)
    await expireReservation(payload, orderRef)

    const res = await webhookPost(webhookRequest(buildWebhookBody(orderRef)))
    expect(res.status).toBe(200)

    expect(await countOrders(payload, orderRef)).toBe(1)
    // Reservation was swept to released, stock still decremented exactly once.
    expect((await findReservation(payload, orderRef))?.status).toBe('released')
    expect(await getStockValue(payload, KEY)).toBe(1)
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('confirms an order when the reservation was already released (expired)', async () => {
    const orderRef = crypto.randomUUID()
    await createReservation(payload, orderRef)
    await expireReservation(payload, orderRef, 'released')

    const res = await webhookPost(webhookRequest(buildWebhookBody(orderRef)))
    expect(res.status).toBe(200)

    expect(await countOrders(payload, orderRef)).toBe(1)
    expect(await getStockValue(payload, KEY)).toBe(1)
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  it('records a paid order even when the stock is gone (oversell beats a lost order)', async () => {
    const orderRef = crypto.randomUUID()
    await createReservation(payload, orderRef)
    await expireReservation(payload, orderRef, 'released')
    // Someone else bought the last unit while the reservation was expired.
    await payload.update({
      collection: 'shop-stock',
      where: { key: { equals: KEY } },
      data: { stock: 0 },
      overrideAccess: true,
    })

    const res = await webhookPost(webhookRequest(buildWebhookBody(orderRef)))
    expect(res.status).toBe(200)
    expect(await countOrders(payload, orderRef)).toBe(1)
    expect(await getStockValue(payload, KEY)).toBe(0)
    expect(sendMock).toHaveBeenCalledTimes(1)
  })

  describe('authenticity', () => {
    it('rejects a missing secret header with 401', async () => {
      const res = await webhookPost(webhookRequest(buildWebhookBody(crypto.randomUUID()), {}))
      expect(res.status).toBe(401)
    })

    it('rejects a wrong secret with 401', async () => {
      const res = await webhookPost(
        webhookRequest(buildWebhookBody(crypto.randomUUID()), { 'x-webhook-secret': 'wrong-secret' }),
      )
      expect(res.status).toBe(401)
    })

    it('accepts the secret as Authorization Bearer fallback', async () => {
      const orderRef = crypto.randomUUID()
      await createReservation(payload, orderRef)
      const res = await webhookPost(
        webhookRequest(buildWebhookBody(orderRef), { authorization: `Bearer ${SECRET}` }),
      )
      expect(res.status).toBe(200)
      expect(await countOrders(payload, orderRef)).toBe(1)
    })

    it('fails closed with 503 when SHOP_WEBHOOK_SECRET is not configured', async () => {
      const previous = process.env.SHOP_WEBHOOK_SECRET
      process.env.SHOP_WEBHOOK_SECRET = ''
      try {
        const res = await webhookPost(webhookRequest(buildWebhookBody(crypto.randomUUID())))
        expect(res.status).toBe(503)
      } finally {
        process.env.SHOP_WEBHOOK_SECRET = previous
      }
    })
  })

  describe('payload validation', () => {
    it('answers 400 when reference.campaign_subid is missing', async () => {
      const body = buildWebhookBody(crypto.randomUUID())
      delete (body.reference as { campaign_subid?: string }).campaign_subid
      const res = await webhookPost(webhookRequest(body))
      expect(res.status).toBe(400)
    })

    it('ignores failed payments without creating an order', async () => {
      const orderRef = crypto.randomUUID()
      await createReservation(payload, orderRef)
      const body = { ...buildWebhookBody(orderRef), status: 'failed' }
      const res = await webhookPost(webhookRequest(body))
      expect(res.status).toBe(200)
      expect(await res.json()).toMatchObject({ ignored: true })
      expect(await countOrders(payload, orderRef)).toBe(0)
      expect(sendMock).not.toHaveBeenCalled()
    })

    it('answers 400 for a malformed JSON body', async () => {
      const res = await webhookPost(
        new Request('http://localhost:3000/api/shop-webhook', {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-webhook-secret': SECRET },
          body: 'not-json',
        }),
      )
      expect(res.status).toBe(400)
    })
  })
})

describe('shop-order status action (POST /api/shop-order action=status)', () => {
  it('returns not_found for an unknown orderRef', async () => {
    const res = await shopOrderPost(statusRequest(crypto.randomUUID()))
    expect(res.status).toBe(200)
    expect(await res.json()).toMatchObject({ success: true, status: 'not_found' })
  })

  it('returns 400 for a malformed orderRef', async () => {
    const res = await shopOrderPost(statusRequest('not-a-uuid'))
    expect(res.status).toBe(400)
  })

  it('reports pending while the reservation is active, paid after the webhook', async () => {
    const orderRef = crypto.randomUUID()
    await createReservation(payload, orderRef)

    const before = await shopOrderPost(statusRequest(orderRef))
    expect(await before.json()).toMatchObject({ success: true, status: 'pending' })

    await webhookPost(webhookRequest(buildWebhookBody(orderRef)))

    const after = await shopOrderPost(statusRequest(orderRef))
    expect(await after.json()).toMatchObject({ success: true, status: 'paid' })
  })
})
