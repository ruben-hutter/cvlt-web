import { NextResponse } from 'next/server'
import crypto from 'node:crypto'
import { getPayload } from 'payload'
import config from '@payload-config'
import { sendShopOrderNotification } from '@/lib/mail'
import { rateLimit } from '@/lib/rate-limit'
import { extractClientIp } from '@/lib/antispam'
import { normalizeCartTotal, type CartItem } from '@/lib/shop'
import { buildCatalogLookup } from '@/lib/shop-catalog'
import { consumeReservation, decrementStockForSale, InsufficientStockError } from '@/lib/shop-stock'
import { isOrderConfirmed, saveOrderToDb, type OrderPayload } from '@/lib/shop-orders'
import type { ReservationItem } from '@/collections/ShopReservations'

/**
 * POST /api/shop-webhook
 *
 * Server-side order confirmation for RaiseNow (Twint) payments. RaiseNow is
 * configured (RaiseNow dashboard, manual step — see
 * plans/tickets/2026-09-26-A-shop-server-side-order-confirmation.md) to call
 * this endpoint when a payment completes. The order is matched via
 * `reference.campaign_subid`, which `buildCheckoutUrl` sets to our orderRef.
 *
 * Authenticity: RaiseNow's exact webhook-signature support must be verified in
 * their dashboard. Until a signature scheme is confirmed we use a shared
 * secret: the dashboard sends it in the `X-Webhook-Secret` header (or as an
 * `Authorization: Bearer <secret>`) and we compare it constant-time against
 * SHOP_WEBHOOK_SECRET. The endpoint fails closed when the secret is not
 * configured, so orders can never be finalized by unauthenticated callers.
 *
 * Idempotency: RaiseNow may deliver the same event more than once (retries,
 * webhook + fallback client confirm racing). isOrderConfirmed + the unique
 * orderRef constraint guarantee exactly one shop-orders row and one email.
 *
 * Stock/TTL policy: a paid webhook beats reservation expiry (see ticket).
 * Active reservation → consumeReservation (decrement stock, mark fulfilled).
 * Expired/released reservation → try to decrement stock for the sale; if the
 * item sold out in the meantime the order is still recorded (oversell beats a
 * silently lost paid order) and the shortfall is logged loudly.
 */

type UnknownRecord = Record<string, unknown>

const SUCCESS_PAYMENT_STATUSES = new Set([
  'finalized',
  'success',
  'succeeded',
  'paid',
  'confirmed',
  'complete',
  'completed',
])

const FAILURE_PAYMENT_STATUSES = new Set([
  'failed',
  'failure',
  'error',
  'aborted',
  'aborted_by_user',
  'cancelled',
  'canceled',
  'declined',
  'expired',
])

const PENDING_PAYMENT_STATUSES = new Set([
  'pending',
  'in_progress',
  'processing',
  'created',
  'started',
  'waiting',
  'initialized',
])

function asRecord(value: unknown): UnknownRecord | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as UnknownRecord)
    : undefined
}

function getPath(source: UnknownRecord, path: string): unknown {
  let current: unknown = source
  for (const segment of path.split('.')) {
    const record = asRecord(current)
    if (!record) return undefined
    current = record[segment]
  }
  return current
}

function asNonEmptyString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

// The webhook payload shape differs slightly between RaiseNow products/versions;
// try the known locations before giving up.
function extractOrderRef(body: UnknownRecord): string | undefined {
  return (
    asNonEmptyString(getPath(body, 'reference.campaign_subid')) ??
    asNonEmptyString(getPath(body, 'payment.reference.campaign_subid')) ??
    asNonEmptyString(getPath(body, 'campaign_subid'))
  )
}

function extractPaymentStatus(body: UnknownRecord): string | undefined {
  return (
    asNonEmptyString(getPath(body, 'status')) ??
    asNonEmptyString(getPath(body, 'payment.status')) ??
    asNonEmptyString(getPath(body, 'payment_status')) ??
    asNonEmptyString(getPath(body, 'event'))
  )?.toLowerCase()
}

// RaiseNow reports amounts in minor units (cents): 5500 = CHF 55.00.
function extractPaidAmount(body: UnknownRecord): number | undefined {
  const raw = getPath(body, 'amount') ?? getPath(body, 'payment.amount')
  const value = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : NaN
  if (!Number.isFinite(value) || value <= 0) return undefined
  const chf = Number.isInteger(value) ? value / 100 : value
  if (!Number.isFinite(chf) || chf <= 0 || !hasMaxTwoDecimals(chf)) return undefined
  return Math.round(chf * 100) / 100
}

function hasMaxTwoDecimals(value: number) {
  return Math.abs(value * 100 - Math.round(value * 100)) < 1e-8
}

function extractSupporter(body: UnknownRecord): UnknownRecord {
  return asRecord(getPath(body, 'supporter')) ?? asRecord(getPath(body, 'payment.supporter')) ?? {}
}

function supporterField(supporter: UnknownRecord, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = asNonEmptyString(supporter[name])
    if (value) return value
  }
  return undefined
}

function getWebhookSecret(): string | undefined {
  const raw = process.env.SHOP_WEBHOOK_SECRET
  if (typeof raw !== 'string') return undefined
  const trimmed = raw.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

// Hash both sides before timingSafeEqual so different lengths don't leak
// timing information (timingSafeEqual itself throws on length mismatch).
function secretsMatch(provided: string, expected: string): boolean {
  const hashedProvided = crypto.createHash('sha256').update(provided).digest()
  const hashedExpected = crypto.createHash('sha256').update(expected).digest()
  return crypto.timingSafeEqual(hashedProvided, hashedExpected)
}

function extractProvidedSecret(request: Request): string | undefined {
  const header = asNonEmptyString(request.headers.get('x-webhook-secret'))
  if (header) return header
  const authorization = request.headers.get('authorization')
  if (authorization && authorization.toLowerCase().startsWith('bearer ')) {
    return asNonEmptyString(authorization.slice(7))
  }
  return undefined
}

type ReservationRecord = {
  id: number | string
  status: 'active' | 'fulfilled' | 'released'
  items: ReservationItem[]
}

async function findReservationByOrderRef(orderRef: string): Promise<ReservationRecord | undefined> {
  const payload = await getPayload({ config })
  const result = await payload.find({
    collection: 'shop-reservations',
    where: { orderRef: { equals: orderRef } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  const doc = result.docs[0] as unknown as Record<string, unknown> | undefined
  if (!doc) return undefined
  const status = doc.status === 'fulfilled' || doc.status === 'released' ? doc.status : 'active'
  return {
    id: doc.id as number | string,
    status,
    items: Array.isArray(doc.items) ? (doc.items as ReservationItem[]) : [],
  }
}

// Rebuild the order lines from the reservation (the webhook payload carries no
// item detail). Catalog entries no longer in code fall back to the raw key.
function itemsFromReservation(reservationItems: ReservationItem[]): CartItem[] {
  const lookup = buildCatalogLookup()
  const totals = new Map<string, number>()
  for (const item of reservationItems) {
    const qty = Number(item?.qty) || 0
    if (!item?.key || qty <= 0) continue
    totals.set(item.key, (totals.get(item.key) ?? 0) + qty)
  }

  const items: CartItem[] = []
  for (const [key, quantity] of totals) {
    const entry = lookup.get(key)
    if (entry) {
      items.push({
        productName: entry.productName,
        edition: entry.edition,
        variant: entry.variant,
        size: entry.size,
        quantity,
        unitPrice: entry.unitPrice,
      })
    } else {
      const [productName = key, variant = '', size = ''] = key.split('__')
      console.error('[shop-webhook] catalog entry missing for reservation item', { key, orderRefPath: 'see reservation' })
      items.push({
        productName,
        edition: 'edizione non più a catalogo',
        variant,
        size,
        quantity,
        unitPrice: 0,
      })
    }
  }
  return items
}

async function handleWebhook(request: Request): Promise<NextResponse> {
  const expectedSecret = getWebhookSecret()
  if (!expectedSecret) {
    console.error('[shop-webhook] SHOP_WEBHOOK_SECRET is not configured; rejecting webhook')
    return NextResponse.json({ error: 'Webhook non configurato.' }, { status: 503 })
  }

  const providedSecret = extractProvidedSecret(request)
  if (!providedSecret || !secretsMatch(providedSecret, expectedSecret)) {
    return NextResponse.json({ error: 'Non autorizzato.' }, { status: 401 })
  }

  const ip = extractClientIp(request)
  const { allowed } = rateLimit({ key: `shop-webhook:${ip}`, limit: 60, windowMs: 60_000 })
  if (!allowed) {
    return NextResponse.json({ error: 'Troppe richieste. Riprova più tardi.' }, { status: 429 })
  }

  let body: UnknownRecord
  try {
    body = (await request.json()) as UnknownRecord
  } catch {
    return NextResponse.json({ error: 'Payload non valido.' }, { status: 400 })
  }

  const orderRef = extractOrderRef(body)
  if (!orderRef) {
    console.error('[shop-webhook] payload without reference.campaign_subid', { keys: Object.keys(body) })
    return NextResponse.json({ error: 'Riferimento ordine mancante.' }, { status: 400 })
  }

  const paymentStatus = extractPaymentStatus(body)
  if (paymentStatus && FAILURE_PAYMENT_STATUSES.has(paymentStatus)) {
    console.log('[shop-webhook] ignoring failed payment', { orderRef, paymentStatus })
    return NextResponse.json({ success: true, ignored: true })
  }
  if (paymentStatus && PENDING_PAYMENT_STATUSES.has(paymentStatus)) {
    console.log('[shop-webhook] ignoring still-pending payment', { orderRef, paymentStatus })
    return NextResponse.json({ success: true, ignored: true })
  }
  if (paymentStatus && !SUCCESS_PAYMENT_STATUSES.has(paymentStatus)) {
    // Unknown status vocabulary: log loudly and proceed (RaiseNow delivers this
    // webhook for completed payments; a wrong guess is recoverable via the
    // Payload admin, a dropped paid order is not).
    console.error('[shop-webhook] unknown payment status, confirming anyway', { orderRef, paymentStatus })
  }

  // Idempotency guard: a redelivery (or the client fallback confirm) must not
  // create a second order or send a second email.
  if (await isOrderConfirmed(orderRef)) {
    return NextResponse.json({ success: true, alreadyConfirmed: true, orderRef })
  }

  const payload = await getPayload({ config })
  const reservation = await findReservationByOrderRef(orderRef)
  if (!reservation) {
    console.error('[shop-webhook] paid webhook without matching reservation', { orderRef })
    return NextResponse.json({ error: 'Ordine sconosciuto.' }, { status: 404 })
  }

  const items = itemsFromReservation(reservation.items)
  const computedTotal = normalizeCartTotal(items)
  const paidAmount = extractPaidAmount(body)
  if (paidAmount !== undefined && computedTotal > 0 && Math.abs(paidAmount - computedTotal) > 0.005) {
    console.error('[shop-webhook] paid amount differs from order total', { orderRef, paidAmount, computedTotal })
  }
  const total = computedTotal > 0 ? computedTotal : (paidAmount ?? 0)
  if (total <= 0) {
    console.error('[shop-webhook] unable to determine order total', { orderRef })
    return NextResponse.json({ error: 'Totale ordine non determinabile.' }, { status: 500 })
  }

  // Stock policy: payment proof beats reservation expiry (see header comment).
  let stockHandled = false
  if (reservation.status === 'active') {
    stockHandled = await consumeReservation(payload, orderRef)
  }
  if (!stockHandled && reservation.status !== 'fulfilled') {
    try {
      await decrementStockForSale(payload, reservation.items)
      stockHandled = true
    } catch (error) {
      if (error instanceof InsufficientStockError) {
        console.error('[shop-webhook] stock no longer available for paid order, recording anyway', {
          orderRef,
          stockKey: error.stockKey,
        })
      } else {
        throw error
      }
    }
  }

  const supporter = extractSupporter(body)
  const firstName = supporterField(supporter, 'first_name', 'firstName')
  const lastName = supporterField(supporter, 'last_name', 'lastName')
  const email = supporterField(supporter, 'email', 'email_address')
  const phone = supporterField(supporter, 'phone', 'phone_number', 'mobile')
  const street = supporterField(supporter, 'street', 'address')
  const houseNumber = supporterField(supporter, 'house_number', 'house_no')
  const postalCode = supporterField(supporter, 'zip_code', 'postal_code', 'zip')
  const city = supporterField(supporter, 'city')

  if (!firstName || !lastName || !email || !phone || !street || !postalCode || !city) {
    console.error('[shop-webhook] supporter data incomplete in webhook payload', {
      orderRef,
      missing: {
        firstName: !firstName,
        lastName: !lastName,
        email: !email,
        phone: !phone,
        street: !street,
        postalCode: !postalCode,
        city: !city,
      },
    })
  }

  const order: OrderPayload = {
    orderRef,
    // Required fields in the ShopOrders collection — never lose a paid order
    // over a missing supporter attribute; placeholders are logged above.
    firstName: firstName ?? '-',
    lastName: lastName ?? '-',
    email: email ?? `sconosciuto+${orderRef}@cvlt.ch`,
    phone: phone ?? '-',
    address: [street, houseNumber].filter(Boolean).join(' ') || '-',
    postalCode: postalCode ?? '-',
    city: city ?? '-',
    notes: '',
    paymentMethod: 'twint',
    paymentStatus: 'paid',
    total,
    createdAt: new Date().toISOString(),
    items,
  }

  try {
    await saveOrderToDb(order)
  } catch (error) {
    // Lost a race against a concurrent confirm: the order now exists → OK.
    if (await isOrderConfirmed(orderRef)) {
      return NextResponse.json({ success: true, alreadyConfirmed: true, orderRef })
    }
    throw error
  }

  try {
    await sendShopOrderNotification(order)
  } catch (emailError) {
    console.error('[shop-webhook] failed to send shop order email:', emailError)
  }

  console.log('[shop-webhook] order confirmed via webhook', {
    orderRef,
    total,
    reservationStatus: reservation.status,
    stockHandled,
  })

  return NextResponse.json({
    success: true,
    orderRef,
    paymentMethod: order.paymentMethod,
    paymentStatus: order.paymentStatus,
  })
}

export async function POST(request: Request) {
  try {
    return await handleWebhook(request)
  } catch (error) {
    console.error('[shop-webhook] webhook error:', error)
    return NextResponse.json({ error: 'Si è verificato un errore. Riprova più tardi.' }, { status: 500 })
  }
}
