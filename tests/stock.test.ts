import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import type { Payload } from 'payload'
import { getTestPayload, resetState, getStockValue, seedStock, teardownTestPayload } from './helpers/test-payload'
import {
  consumeReservation,
  decrementStockForSale,
  getAvailabilityMap,
  InsufficientStockError,
  reserveItems,
  sweepExpiredReservations,
} from '../src/lib/shop-stock'
import { catalogKey } from '../src/lib/shop-catalog'

const KEY = catalogKey('Maglietta 100% Cotone Bio', 'Dusty Indigo', 'S')
const TTL = 2 * 60 * 60 * 1000

let payload: Payload

beforeAll(async () => {
  payload = await getTestPayload()
  await seedStock(payload)
})

beforeEach(async () => {
  await resetState(payload, { [KEY]: 1 })
})

afterAll(async () => {
  await teardownTestPayload()
})

describe('availability', () => {
  it('reads the seeded stock', async () => {
    const availability = await getAvailabilityMap(payload)
    expect(availability[KEY]).toBe(1)
  })

  it('never reports a negative number', async () => {
    await resetState(payload, { [KEY]: 0 })
    const availability = await getAvailabilityMap(payload)
    expect(availability[KEY]).toBe(0)
  })
})

describe('reserveItems (TWINT hold)', () => {
  it('reduces availability but leaves physical stock untouched', async () => {
    await reserveItems(payload, [{ key: KEY, qty: 1 }], 'ord-1', TTL)

    const availability = await getAvailabilityMap(payload)
    expect(availability[KEY]).toBe(0)
    expect(await getStockValue(payload, KEY)).toBe(1)
  })

  it('blocks a second buyer when the last unit is already held', async () => {
    await reserveItems(payload, [{ key: KEY, qty: 1 }], 'ord-1', TTL)

    await expect(reserveItems(payload, [{ key: KEY, qty: 1 }], 'ord-2', TTL)).rejects.toBeInstanceOf(
      InsufficientStockError,
    )
  })

  it('rejects reserving more units than available', async () => {
    await resetState(payload, { [KEY]: 2 })
    await expect(reserveItems(payload, [{ key: KEY, qty: 3 }], 'ord-1', TTL)).rejects.toBeInstanceOf(
      InsufficientStockError,
    )
  })

  it('serializes a concurrent race so exactly one buyer wins', async () => {
    await resetState(payload, { [KEY]: 1 })

    const results = await Promise.allSettled([
      reserveItems(payload, [{ key: KEY, qty: 1 }], 'race-A', TTL),
      reserveItems(payload, [{ key: KEY, qty: 1 }], 'race-B', TTL),
    ])

    const fulfilled = results.filter((r) => r.status === 'fulfilled')
    const rejected = results.filter((r) => r.status === 'rejected')

    expect(fulfilled).toHaveLength(1)
    expect(rejected).toHaveLength(1)
    expect((rejected[0] as PromiseRejectedResult).reason).toBeInstanceOf(InsufficientStockError)

    const availability = await getAvailabilityMap(payload)
    expect(availability[KEY]).toBe(0)
    expect(await getStockValue(payload, KEY)).toBe(1)
  })
})

describe('consumeReservation (TWINT confirm after payment)', () => {
  it('decrements physical stock on confirmation, never below zero', async () => {
    await reserveItems(payload, [{ key: KEY, qty: 1 }], 'ord-1', TTL)
    expect(await consumeReservation(payload, 'ord-1')).toBe(true)

    expect(await getStockValue(payload, KEY)).toBe(0)
    const availability = await getAvailabilityMap(payload)
    expect(availability[KEY]).toBe(0)
  })

  it('is idempotent: consuming twice returns false', async () => {
    await reserveItems(payload, [{ key: KEY, qty: 1 }], 'ord-1', TTL)
    expect(await consumeReservation(payload, 'ord-1')).toBe(true)
    expect(await consumeReservation(payload, 'ord-1')).toBe(false)
  })

  it('returns false for an unknown order', async () => {
    expect(await consumeReservation(payload, 'does-not-exist')).toBe(false)
  })
})

describe('sweepExpiredReservations', () => {
  it('filters expired reservations from availability and sweeps them to expired', async () => {
    await resetState(payload, { [KEY]: 2 })
    await reserveItems(payload, [{ key: KEY, qty: 2 }], 'ord-expired', 300)

    let availability = await getAvailabilityMap(payload)
    expect(availability[KEY]).toBe(0)

    await new Promise((resolve) => setTimeout(resolve, 450))
    availability = await getAvailabilityMap(payload)
    expect(availability[KEY]).toBe(2)

    const released = await sweepExpiredReservations(payload)
    expect(released).toBeGreaterThanOrEqual(1)

    availability = await getAvailabilityMap(payload)
    expect(availability[KEY]).toBe(2)
    expect(await getStockValue(payload, KEY)).toBe(2)
  })
})

describe('decrementStockForSale (invoice)', () => {
  it('decrements stock atomically', async () => {
    await resetState(payload, { [KEY]: 2 })
    await decrementStockForSale(payload, [{ key: KEY, qty: 2 }])
    expect(await getStockValue(payload, KEY)).toBe(0)
  })

  it('blocks the sale when insufficient and leaves stock unchanged', async () => {
    await resetState(payload, { [KEY]: 1 })
    await expect(
      decrementStockForSale(payload, [{ key: KEY, qty: 2 }]),
    ).rejects.toBeInstanceOf(InsufficientStockError)
    expect(await getStockValue(payload, KEY)).toBe(1)
  })

  it('respects existing reservations (does not oversell against a hold)', async () => {
    await resetState(payload, { [KEY]: 1 })
    await reserveItems(payload, [{ key: KEY, qty: 1 }], 'ord-1', TTL)

    await expect(
      decrementStockForSale(payload, [{ key: KEY, qty: 1 }]),
    ).rejects.toBeInstanceOf(InsufficientStockError)
    expect(await getStockValue(payload, KEY)).toBe(1)
  })

  it('aggregates duplicate keys so a crafted order cannot oversell', async () => {
    await resetState(payload, { [KEY]: 1 })
    await expect(
      decrementStockForSale(payload, [
        { key: KEY, qty: 1 },
        { key: KEY, qty: 1 },
      ]),
    ).rejects.toBeInstanceOf(InsufficientStockError)
    expect(await getStockValue(payload, KEY)).toBe(1)
  })

  it('aggregates duplicate keys and decrements the combined total', async () => {
    await resetState(payload, { [KEY]: 3 })
    await decrementStockForSale(payload, [
      { key: KEY, qty: 1 },
      { key: KEY, qty: 1 },
    ])
    expect(await getStockValue(payload, KEY)).toBe(1)
  })
})
