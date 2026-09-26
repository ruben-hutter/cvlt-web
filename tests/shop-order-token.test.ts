import './helpers/test-env'
import { describe, expect, it } from 'vitest'
import { signOrderPayload, verifyOrderToken, type OrderPayload } from '../src/lib/shop-order-token'

function baseOrder(overrides: Partial<OrderPayload> = {}): OrderPayload {
  return {
    orderRef: 'f638fa51-2b3c-41b9-b202-bce46cce82d7',
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
    ...overrides,
  }
}

function flipLastChar(value: string) {
  const last = value.at(-1) as string
  const replacement = last === 'A' ? 'B' : 'A'
  return value.slice(0, -1) + replacement
}

describe('signOrderPayload / verifyOrderToken round-trip', () => {
  it('returns the exact payload that was signed', () => {
    const order = baseOrder()
    const verified = verifyOrderToken(signOrderPayload(order))
    expect(verified).toEqual(order)
  })

  it('produces a token of two base64url parts', () => {
    const token = signOrderPayload(baseOrder())
    const parts = token.split('.')
    expect(parts).toHaveLength(2)
    for (const part of parts) {
      expect(part).toMatch(/^[A-Za-z0-9_-]+$/)
    }
  })

  it('round-trips an expired createdAt unchanged (expiry is enforced by the confirm route)', () => {
    const expiredCreatedAt = new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString()
    const order = baseOrder({ createdAt: expiredCreatedAt })
    const verified = verifyOrderToken(signOrderPayload(order))
    expect(verified.createdAt).toBe(expiredCreatedAt)
  })

  it('normalizes unknown paymentMethod/paymentStatus to the twint defaults', () => {
    const order = baseOrder({
      paymentMethod: 'bitcoin' as OrderPayload['paymentMethod'],
      paymentStatus: 'banana' as OrderPayload['paymentStatus'],
    })
    const verified = verifyOrderToken(signOrderPayload(order))
    expect(verified.paymentMethod).toBe('twint')
    expect(verified.paymentStatus).toBe('paid')
  })

  it('keeps invoice/pending_invoice through the round-trip', () => {
    const order = baseOrder({ paymentMethod: 'invoice', paymentStatus: 'pending_invoice' })
    const verified = verifyOrderToken(signOrderPayload(order))
    expect(verified.paymentMethod).toBe('invoice')
    expect(verified.paymentStatus).toBe('pending_invoice')
  })
})

describe('verifyOrderToken rejections', () => {
  it('rejects a tampered signature of the same length', () => {
    const token = signOrderPayload(baseOrder())
    const [encoded, signature] = token.split('.')
    const tamperedToken = `${encoded}.${flipLastChar(signature)}`

    expect(() => verifyOrderToken(tamperedToken)).toThrowError(/signature invalid/)
  })

  it('rejects a tampered payload re-signed with the original signature', () => {
    const token = signOrderPayload(baseOrder())
    const [encoded, signature] = token.split('.')

    const forgedPayload = baseOrder({ total: 0.01 })
    const forgedEncoded = Buffer.from(JSON.stringify(forgedPayload), 'utf8').toString('base64url')
    const forgedToken = `${forgedEncoded}.${signature}`

    expect(() => verifyOrderToken(forgedToken)).toThrowError(/signature invalid/)
  })

  it('rejects a token signed with a different secret', () => {
    const token = signOrderPayload(baseOrder())
    const originalSecret = process.env.SHOP_ORDER_TOKEN_SECRET
    process.env.SHOP_ORDER_TOKEN_SECRET = `${originalSecret}-rotated`
    try {
      expect(() => verifyOrderToken(token)).toThrowError(/signature invalid/)
    } finally {
      process.env.SHOP_ORDER_TOKEN_SECRET = originalSecret
    }
  })

  it('rejects tokens with the wrong number of parts', () => {
    expect(() => verifyOrderToken('garbage')).toThrowError(/format invalid/)
    expect(() => verifyOrderToken('a.b.c')).toThrowError(/format invalid/)
  })

  it('rejects a validly signed token whose payload has no orderRef', () => {
    const token = signOrderPayload(baseOrder({ orderRef: '' }))
    expect(() => verifyOrderToken(token)).toThrowError(/payload invalid/)
  })

  it('rejects a validly signed token whose payload has no items', () => {
    const token = signOrderPayload(baseOrder({ items: [] }))
    expect(() => verifyOrderToken(token)).toThrowError(/payload invalid/)
  })

  it('throws on a signature with a different byte length (timingSafeEqual precondition)', () => {
    const token = signOrderPayload(baseOrder())
    const [encoded] = token.split('.')
    const truncatedSignatureToken = `${encoded}.abc`

    expect(() => verifyOrderToken(truncatedSignatureToken)).toThrowError()
  })
})
