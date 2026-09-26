import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendShopOrderNotification } from '@/lib/mail'
import { getServerUrl, requireEnv } from '@/lib/env'
import { rateLimit } from '@/lib/rate-limit'
import { extractClientIp, isBlockedEmailDomain, validateAntispamFields, isValidEmailFormat, isWithinLimit } from '@/lib/antispam'
import {
  normalizeCartTotal,
  SHOP_RESERVATION_TTL_MS,
  type CartItem,
  type PaymentMethod,
} from '@/lib/shop'
import { isOrderConfirmed, saveOrderToDb, type OrderPayload } from '@/lib/shop-orders'
import { buildCatalogLookup, catalogKey } from '@/lib/shop-catalog'
import {
  consumeReservation,
  decrementStockForSale,
  InsufficientStockError,
  reserveItems,
} from '@/lib/shop-stock'
import type { ReservationItem } from '@/collections/ShopReservations'

type PrepareRequest = {
  action: 'prepare'
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  postalCode: string
  city: string
  notes?: string
  paymentMethod: PaymentMethod
  items: CartItem[]
  website?: string
  renderTs?: number | string
}

type ConfirmRequest = {
  action: 'confirm'
  orderToken: string
}

type StatusRequest = {
  action: 'status'
  orderRef?: string
}

const allowedPaylinkHosts = new Set(['pay.raisenow.io'])

function base64UrlEncode(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function getOrderTokenSecret() {
  return requireEnv('SHOP_ORDER_TOKEN_SECRET')
}

function signOrderPayload(payload: OrderPayload) {
  const serialized = JSON.stringify(payload)
  const encoded = base64UrlEncode(serialized)
  const signature = crypto.createHmac('sha256', getOrderTokenSecret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

function verifyOrderToken(token: string) {
  const parts = token.split('.')
  if (parts.length !== 2) throw new Error('Token format invalid')

  const [encoded, signature] = parts
  const expected = crypto.createHmac('sha256', getOrderTokenSecret()).update(encoded).digest('base64url')

  const valid = crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
  if (!valid) throw new Error('Token signature invalid')

  const payload = JSON.parse(base64UrlDecode(encoded)) as Partial<OrderPayload>
  if (!payload.orderRef || !Array.isArray(payload.items) || payload.items.length === 0) {
    throw new Error('Token payload invalid')
  }

  return {
    ...payload,
    paymentMethod: payload.paymentMethod === 'invoice' ? 'invoice' : 'twint',
    paymentStatus: payload.paymentStatus === 'pending_invoice' ? 'pending_invoice' : 'paid',
  } as OrderPayload
}

function isValidCartItem(item: CartItem) {
  return (
    typeof item.productName === 'string' &&
    item.productName.length > 0 &&
    typeof item.edition === 'string' &&
    item.edition.length > 0 &&
    typeof item.variant === 'string' &&
    item.variant.length > 0 &&
    typeof item.size === 'string' &&
    item.size.length > 0 &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    item.quantity <= 20
  )
}

function formatStockKey(stockKey: string) {
  const parts = stockKey.split('__')
  const productName = parts[0] ?? ''
  const variant = parts[1] ?? ''
  const size = parts[2] ?? ''
  return `${productName} (${variant}, taglia ${size})`
}

function hasMaxTwoDecimals(value: number) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
}

function isProductionLikeRuntime() {
  return process.env.NODE_ENV === 'production'
}

function getValidatedServerUrl() {
  const parsed = new URL(getServerUrl())
  if (isProductionLikeRuntime() && parsed.hostname === 'localhost') {
    throw new Error('NEXT_PUBLIC_SERVER_URL must not use localhost in production runtime')
  }
  return parsed
}

function getValidatedPaylinkUrl() {
  let parsed: URL
  try {
    parsed = new URL(requireEnv('SHOP_PAYLINK_URL'))
  } catch {
    throw new Error('Invalid SHOP_PAYLINK_URL')
  }

  if (!allowedPaylinkHosts.has(parsed.hostname)) {
    throw new Error(`Invalid SHOP_PAYLINK_URL host: ${parsed.hostname}`)
  }

  return parsed
}

function buildCheckoutUrl(payload: OrderPayload) {
  const serverUrl = getValidatedServerUrl()
  const url = getValidatedPaylinkUrl()

  url.searchParams.set('amount.values', payload.total.toFixed(2))
  url.searchParams.set('amount.custom', 'false')
  url.searchParams.set('supporter.first_name.value', payload.firstName)
  url.searchParams.set('supporter.last_name.value', payload.lastName)
  url.searchParams.set('supporter.email.value', payload.email)
  url.searchParams.set('supporter.phone.value', payload.phone)
  url.searchParams.set('supporter.street.value', payload.address)
  url.searchParams.set('supporter.zip_code.value', payload.postalCode)
  url.searchParams.set('supporter.city.value', payload.city)

  url.searchParams.set('payment_method.values', 'twint')
  url.searchParams.set('payment_method.custom', 'false')

  url.searchParams.set('reference.campaign_subid', payload.orderRef)

  console.info('[shop-order] checkout prepared', {
    orderRef: payload.orderRef,
    total: payload.total,
    paylinkHost: url.host,
    paylinkPath: url.pathname,
    nodeEnv: process.env.NODE_ENV ?? 'undefined',
    serverUrlHost: serverUrl.host,
  })

  return url.toString()
}

// Read-only order status for the /shop/confirm result page.
// Returns a state only (paid / pending / not_found) — never any customer PII:
// the orderRef is an unguessable UUID that only the buyer received.
const ORDER_REF_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

async function handleStatus(body: StatusRequest) {
  const orderRef = typeof body.orderRef === 'string' ? body.orderRef.trim().toLowerCase() : ''
  if (!ORDER_REF_PATTERN.test(orderRef)) {
    return NextResponse.json({ error: 'Riferimento ordine non valido.' }, { status: 400 })
  }

  if (await isOrderConfirmed(orderRef)) {
    return NextResponse.json({ success: true, status: 'paid' })
  }

  const payload = await getPayload({ config })
  const reservations = await payload.find({
    collection: 'shop-reservations',
    where: { orderRef: { equals: orderRef } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const reservation = reservations.docs[0] as unknown as { status?: string } | undefined

  const status =
    reservation?.status === 'fulfilled' ? 'paid' : reservation ? 'pending' : 'not_found'
  return NextResponse.json({ success: true, status })
}

async function handlePrepare(body: PrepareRequest) {
  const { firstName, lastName, email, phone, address, postalCode, city, notes, paymentMethod, items, website, renderTs } = body

  const antispam = validateAntispamFields({ honeypot: website, renderTs })
  if (!antispam.ok) {
    if (antispam.reason === 'honeypot') {
      return NextResponse.json({ success: true, orderRef: crypto.randomUUID(), paymentMethod: 'invoice', paymentStatus: 'pending_invoice' })
    }
    return NextResponse.json({ error: 'Verifica anti-spam non superata. Ricarica la pagina e riprova.' }, { status: 400 })
  }

  if (
    !firstName ||
    !lastName ||
    !email ||
    !phone ||
    !address ||
    !postalCode ||
    !city ||
    !Array.isArray(items) ||
    items.length === 0
  ) {
    return NextResponse.json({ error: 'Dati ordine incompleti.' }, { status: 400 })
  }

  if (
    typeof firstName !== 'string' || typeof lastName !== 'string' ||
    typeof email !== 'string' || typeof phone !== 'string' ||
    typeof address !== 'string' || typeof postalCode !== 'string' ||
    typeof city !== 'string'
  ) {
    return NextResponse.json({ error: 'Dati non validi.' }, { status: 400 })
  }

  if (
    !isWithinLimit(firstName, 'name') || !isWithinLimit(lastName, 'name') ||
    !isWithinLimit(phone, 'phone') || !isWithinLimit(address, 'address') ||
    !isWithinLimit(postalCode, 'postalCode') || !isWithinLimit(city, 'city') ||
    !isWithinLimit(notes, 'notes') || items.length > 50
  ) {
    return NextResponse.json({ error: 'Dati ordine troppo lunghi.' }, { status: 400 })
  }

  if (!isValidEmailFormat(email) || isBlockedEmailDomain(email)) {
    return NextResponse.json({ error: 'Indirizzo email non valido.' }, { status: 400 })
  }

  if (!items.every(isValidCartItem)) {
    return NextResponse.json({ error: 'Carrello non valido.' }, { status: 400 })
  }

  if (paymentMethod !== 'twint' && paymentMethod !== 'invoice') {
    return NextResponse.json({ error: 'Metodo di pagamento non valido.' }, { status: 400 })
  }

  const lookup = buildCatalogLookup()
  const reservationItems: ReservationItem[] = []
  const validatedItems: CartItem[] = []
  for (const item of items) {
    const key = catalogKey(item.productName, item.variant, item.size)
    const entry = lookup.get(key)
    if (!entry) {
      return NextResponse.json({ error: 'Articolo non valido o non più disponibile.' }, { status: 400 })
    }
    validatedItems.push({
      productName: entry.productName,
      edition: entry.edition,
      variant: entry.variant,
      size: entry.size,
      quantity: item.quantity,
      unitPrice: entry.unitPrice,
    })
    reservationItems.push({ key, qty: item.quantity })
  }

  const total = normalizeCartTotal(validatedItems)
  if (!Number.isFinite(total) || total <= 0 || !hasMaxTwoDecimals(total)) {
    return NextResponse.json({ error: 'Totale ordine non valido.' }, { status: 400 })
  }

  const order: OrderPayload = {
    orderRef: crypto.randomUUID(),
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    email: email.trim(),
    phone: phone.trim(),
    address: address.trim(),
    postalCode: postalCode.trim(),
    city: city.trim(),
    notes: notes?.trim() || '',
    paymentMethod,
    paymentStatus: paymentMethod === 'twint' ? 'paid' : 'pending_invoice',
    total,
    createdAt: new Date().toISOString(),
    items: validatedItems,
  }

  const payload = await getPayload({ config })

  if (paymentMethod === 'invoice') {
    if (await isOrderConfirmed(order.orderRef)) {
      return NextResponse.json({
        success: true,
        alreadyConfirmed: true,
        orderRef: order.orderRef,
        paymentMethod: order.paymentMethod,
        paymentStatus: order.paymentStatus,
      })
    }

    try {
      await decrementStockForSale(payload, reservationItems)
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        return NextResponse.json(
          { error: `Articolo esaurito: ${formatStockKey(error.stockKey)}. Riprova più tardi.` },
          { status: 409 },
        )
      }
      throw error
    }

    await saveOrderToDb(order)

    try {
      await sendShopOrderNotification(order)
    } catch (emailError) {
      console.error('Failed to send shop order email:', emailError)
    }

    return NextResponse.json({
      success: true,
      orderRef: order.orderRef,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    })
  }

  try {
    await reserveItems(payload, reservationItems, order.orderRef, SHOP_RESERVATION_TTL_MS)
  } catch (error) {
    if (error instanceof InsufficientStockError) {
      return NextResponse.json(
        { error: `Articolo esaurito: ${formatStockKey(error.stockKey)}. Riprova più tardi.` },
        { status: 409 },
      )
    }
    throw error
  }

  const orderToken = signOrderPayload(order)
  const checkoutUrl = buildCheckoutUrl(order)

  return NextResponse.json({ success: true, checkoutUrl, orderToken, orderRef: order.orderRef })
}

async function handleConfirm(body: ConfirmRequest) {
  const { orderToken } = body
  if (!orderToken) {
    return NextResponse.json({ error: 'Token ordine mancante.' }, { status: 400 })
  }

  const order = verifyOrderToken(orderToken)
  const createdAtMs = new Date(order.createdAt).getTime()
  const isExpired = Number.isNaN(createdAtMs) || Date.now() - createdAtMs > SHOP_RESERVATION_TTL_MS

  if (isExpired) {
    return NextResponse.json({ error: 'Ordine scaduto, riprovare dal carrello.' }, { status: 400 })
  }

  if (await isOrderConfirmed(order.orderRef)) {
    return NextResponse.json({
      success: true,
      alreadyConfirmed: true,
      orderRef: order.orderRef,
      paymentMethod: order.paymentMethod,
      paymentStatus: order.paymentStatus,
    })
  }

  const payload = await getPayload({ config })
  const consumed = await consumeReservation(payload, order.orderRef)
  if (!consumed) {
    return NextResponse.json(
      { error: 'La prenotazione è scaduta o non più valida. Riprova dal carrello.' },
      { status: 409 },
    )
  }

  await saveOrderToDb(order)

  try {
    await sendShopOrderNotification(order)
  } catch (emailError) {
    console.error('Failed to send shop order email:', emailError)
  }

  return NextResponse.json({
    success: true,
    orderRef: order.orderRef,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
  })
}

export async function POST(request: Request) {
  const ip = extractClientIp(request)

  try {
    const body = (await request.json()) as Record<string, unknown>

    if (body.action === 'status') {
      // Polling endpoint: needs a much higher limit than prepare/confirm.
      const { allowed } = rateLimit({ key: `shop-order-status:${ip}`, limit: 30, windowMs: 60_000 })
      if (!allowed) {
        return NextResponse.json({ error: 'Troppe richieste. Riprova più tardi.' }, { status: 429 })
      }
      return handleStatus(body as StatusRequest)
    }

    const { allowed } = rateLimit({ key: `shop-order:${ip}`, limit: 3, windowMs: 60_000 })
    if (!allowed) {
      return NextResponse.json({ error: 'Troppe richieste. Riprova più tardi.' }, { status: 429 })
    }

    if (body.action === 'prepare') {
      return handlePrepare(body as PrepareRequest)
    }

    if (body.action === 'confirm') {
      return handleConfirm(body as ConfirmRequest)
    }

    return NextResponse.json({ error: 'Azione non valida.' }, { status: 400 })
  } catch (error) {
    console.error('Shop order error:', error)
    return NextResponse.json({ error: 'Si è verificato un errore. Riprova più tardi.' }, { status: 500 })
  }
}
