import crypto from 'node:crypto'
import { requireEnv } from '@/lib/env'
import type { CartItem, PaymentMethod, PaymentStatus } from '@/lib/shop'

export type OrderPayload = {
  orderRef: string
  firstName: string
  lastName: string
  email: string
  phone: string
  address: string
  postalCode: string
  city: string
  notes?: string
  paymentMethod: PaymentMethod
  paymentStatus: PaymentStatus
  total: number
  createdAt: string
  items: CartItem[]
}

function base64UrlEncode(input: string) {
  return Buffer.from(input, 'utf8').toString('base64url')
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, 'base64url').toString('utf8')
}

function getOrderTokenSecret() {
  return requireEnv('SHOP_ORDER_TOKEN_SECRET')
}

export function signOrderPayload(payload: OrderPayload) {
  const serialized = JSON.stringify(payload)
  const encoded = base64UrlEncode(serialized)
  const signature = crypto.createHmac('sha256', getOrderTokenSecret()).update(encoded).digest('base64url')
  return `${encoded}.${signature}`
}

export function verifyOrderToken(token: string) {
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
