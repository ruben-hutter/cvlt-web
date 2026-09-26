import { afterAll, beforeAll, beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import type { Payload } from 'payload'
import {
  getTestPayload,
  resetState,
  seedStock,
  shopCollectionsWithOrders,
  teardownTestPayload,
} from './helpers/test-payload'
import { reserveItems, sweepExpiredReservations } from '../src/lib/shop-stock'
import { catalogKey } from '../src/lib/shop-catalog'
import {
  handleWatchdogRequest,
  isWatchdogKeyValid,
  runStuckReservationCheck,
  runWatchdog,
} from '../src/lib/watchdog'

const mailMocks = vi.hoisted(() => ({
  sendShopWatchdogAlert: vi.fn(),
  sendWatchdogSelfCheckAlert: vi.fn(),
  verifyMailTransport: vi.fn(),
}))

// Mock the mail module at its boundary: no real SMTP is ever touched.
vi.mock('../src/lib/mail', () => mailMocks)

const CRON_SECRET = 'test-cron-secret'
const PAYLINK_URL = 'https://pay.raisenow.example/cvlt'
const KEY = catalogKey('Maglietta 100% Cotone Bio', 'Dusty Indigo', 'S')
const ITEMS = [{ key: 'Giacca Fleece Uomo__Grigia__L', qty: 1 }]

let payload: Payload

async function insertReservation(overrides: Record<string, unknown> = {}) {
  return payload.create({
    collection: 'shop-reservations',
    data: {
      orderRef: 'watch-ref-1',
      status: 'active',
      items: ITEMS,
      expiresAt: new Date(Date.now() - 60_000).toISOString(),
      ...overrides,
    },
    overrideAccess: true,
  })
}

async function getReservation(id: number | string) {
  const result = await payload.find({
    collection: 'shop-reservations',
    where: { id: { equals: id } },
    limit: 1,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs[0] as unknown as Record<string, unknown>
}

beforeAll(async () => {
  process.env.CRON_SECRET = CRON_SECRET
  process.env.SHOP_PAYLINK_URL = PAYLINK_URL
  payload = await getTestPayload({ collections: shopCollectionsWithOrders() })
  await seedStock(payload)
})

beforeEach(async () => {
  await resetState(payload)
  mailMocks.sendShopWatchdogAlert.mockResolvedValue(undefined)
  mailMocks.sendWatchdogSelfCheckAlert.mockResolvedValue(undefined)
  mailMocks.verifyMailTransport.mockResolvedValue(undefined)
  mailMocks.sendShopWatchdogAlert.mockClear()
  mailMocks.sendWatchdogSelfCheckAlert.mockClear()
  mailMocks.verifyMailTransport.mockClear()
  // Default: paylink reachable. Individual tests override this.
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({ status: 200 })),
  )
})

afterEach(() => {
  vi.unstubAllGlobals()
})

afterAll(async () => {
  await teardownTestPayload()
})

describe('lost-order alerting (stuck reservations)', () => {
  it('marks a lapsed active reservation expired and sends exactly one alert', async () => {
    const created = await insertReservation()

    const result = await runWatchdog(payload)

    expect(result.reservations.alerted).toBe(1)
    expect(result.reservations.orderRefs).toEqual(['watch-ref-1'])
    expect(result.ok).toBe(true)

    const after = await getReservation(created.id as number)
    expect(after.status).toBe('expired')
    expect(after.alertedAt).toBeTruthy()

    expect(mailMocks.sendShopWatchdogAlert).toHaveBeenCalledTimes(1)
    const alertData = mailMocks.sendShopWatchdogAlert.mock.calls[0][0]
    expect(alertData.orderRef).toBe('watch-ref-1')
    expect(alertData.items).toEqual(ITEMS)
    expect(typeof alertData.createdAt).toBe('string')

    // Second run: no duplicate alert.
    await runWatchdog(payload)
    expect(mailMocks.sendShopWatchdogAlert).toHaveBeenCalledTimes(1)
  })

  it('leaves reservations that are still within their TTL untouched', async () => {
    const created = await insertReservation({
      orderRef: 'still-valid',
      expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    })

    const result = await runWatchdog(payload)

    expect(result.reservations.alerted).toBe(0)
    expect(mailMocks.sendShopWatchdogAlert).not.toHaveBeenCalled()
    const after = await getReservation(created.id as number)
    expect(after.status).toBe('active')
    expect(after.alertedAt ?? null).toBeFalsy()
  })

  it('never re-alerts a reservation that already has an alertedAt', async () => {
    await insertReservation({
      orderRef: 'already-alerted',
      status: 'expired',
      alertedAt: new Date(Date.now() - 60_000).toISOString(),
    })

    await runWatchdog(payload)

    expect(mailMocks.sendShopWatchdogAlert).not.toHaveBeenCalled()
  })

  it('still alerts when the stock sweep already flipped the row to expired', async () => {
    // The checkout-time sweep runs before the watchdog cron: the row must not get lost.
    await resetState(payload, { [KEY]: 2 })
    await reserveItems(payload, [{ key: KEY, qty: 1 }], 'race-ref', 50)
    await new Promise((resolve) => setTimeout(resolve, 150))
    expect(await sweepExpiredReservations(payload)).toBe(1)

    const result = await runWatchdog(payload)

    expect(result.reservations.alerted).toBe(1)
    expect(mailMocks.sendShopWatchdogAlert).toHaveBeenCalledTimes(1)
    expect(mailMocks.sendShopWatchdogAlert.mock.calls[0][0].orderRef).toBe('race-ref')
  })

  it('serializes concurrent runs so the alert is sent at most once', async () => {
    await insertReservation({ orderRef: 'concurrent-ref' })

    const results = await Promise.all([runWatchdog(payload), runWatchdog(payload)])

    expect(results.reduce((sum, run) => sum + run.reservations.alerted, 0)).toBe(1)
    expect(mailMocks.sendShopWatchdogAlert).toHaveBeenCalledTimes(1)
  })

  it('retries the alert on the next run when sending fails', async () => {
    const created = await insertReservation({ orderRef: 'smtp-down-ref' })
    mailMocks.sendShopWatchdogAlert.mockRejectedValueOnce(new Error('SMTP unavailable'))

    const failedRun = await runWatchdog(payload)
    expect(failedRun.ok).toBe(false)
    expect(failedRun.failures.some((failure) => failure.includes('SMTP unavailable'))).toBe(true)
    expect(mailMocks.sendShopWatchdogAlert).toHaveBeenCalledTimes(1)
    // Not marked as alerted: the send failed.
    let after = await getReservation(created.id as number)
    expect(after.alertedAt ?? null).toBeFalsy()

    const retryRun = await runWatchdog(payload)
    expect(retryRun.ok).toBe(true)
    expect(mailMocks.sendShopWatchdogAlert).toHaveBeenCalledTimes(2)
    after = await getReservation(created.id as number)
    expect(after.status).toBe('expired')
    expect(after.alertedAt).toBeTruthy()
  })

  it('reports a found-but-unalerted count through runStuckReservationCheck', async () => {
    await insertReservation({ orderRef: 'ref-a' })
    await insertReservation({ orderRef: 'ref-b' })

    const result = await runStuckReservationCheck(payload)

    expect(result.found).toBe(2)
    expect(result.alerted).toBe(2)
    expect(result.orderRefs.sort()).toEqual(['ref-a', 'ref-b'])
    expect(mailMocks.sendShopWatchdogAlert).toHaveBeenCalledTimes(2)
  })
})

describe('daily pipeline self-checks', () => {
  it('force=1 runs all three checks and records the run', async () => {
    const result = await runWatchdog(payload, { force: true })

    expect(result.selfCheck.ran).toBe(true)
    expect(result.selfCheck.checks.smtp?.ok).toBe(true)
    expect(result.selfCheck.checks.db?.ok).toBe(true)
    expect(result.selfCheck.checks.paylink?.ok).toBe(true)
    expect(result.ok).toBe(true)
    expect(mailMocks.verifyMailTransport).toHaveBeenCalledTimes(1)

    const lastRun = await payload.kv.get<{ at: string }>('watchdog:selfcheck:lastRunAt')
    expect(lastRun?.at).toBe(result.ranAt)
  })

  it('skips self-checks when the last run is less than 24h ago', async () => {
    await payload.kv.set('watchdog:selfcheck:lastRunAt', { at: new Date().toISOString() })

    const result = await runWatchdog(payload)

    expect(result.selfCheck.ran).toBe(false)
    expect(mailMocks.verifyMailTransport).not.toHaveBeenCalled()
    expect(mailMocks.sendWatchdogSelfCheckAlert).not.toHaveBeenCalled()
  })

  it('collects every failing check and sends a single digest alert', async () => {
    mailMocks.verifyMailTransport.mockRejectedValue(new Error('auth failed'))
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ status: 503 })),
    )

    const result = await runWatchdog(payload, { force: true })

    expect(result.selfCheck.ran).toBe(true)
    expect(result.selfCheck.checks.smtp?.ok).toBe(false)
    expect(result.selfCheck.checks.db?.ok).toBe(true)
    expect(result.selfCheck.checks.paylink?.ok).toBe(false)
    expect(result.ok).toBe(false)
    expect(mailMocks.sendWatchdogSelfCheckAlert).toHaveBeenCalledTimes(1)
    const failures = mailMocks.sendWatchdogSelfCheckAlert.mock.calls[0][0] as string[]
    expect(failures).toHaveLength(2)
    expect(failures.some((failure) => failure.startsWith('smtp:'))).toBe(true)
    expect(failures.some((failure) => failure.startsWith('paylink:'))).toBe(true)
  })

  it('treats non-5xx paylink responses as healthy', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({ status: 302 })),
    )

    const result = await runWatchdog(payload, { force: true })

    expect(result.selfCheck.checks.paylink?.ok).toBe(true)
    expect(result.ok).toBe(true)
  })
})

describe('watchdog endpoint authorization', () => {
  const endpoint = 'http://localhost:3000/api/cron/watchdog'

  it('rejects a missing key with 401', async () => {
    const response = await handleWatchdogRequest(new Request(endpoint), payload)
    expect(response.status).toBe(401)
    expect(mailMocks.verifyMailTransport).not.toHaveBeenCalled()
  })

  it('rejects a wrong key with 401', async () => {
    const response = await handleWatchdogRequest(new Request(`${endpoint}?key=wrong-secret`), payload)
    expect(response.status).toBe(401)
    expect(mailMocks.verifyMailTransport).not.toHaveBeenCalled()
  })

  it('rejects every request when CRON_SECRET is unset (fail closed)', async () => {
    const original = process.env.CRON_SECRET
    delete process.env.CRON_SECRET
    try {
      const response = await handleWatchdogRequest(new Request(`${endpoint}?key=${CRON_SECRET}`), payload)
      expect(response.status).toBe(401)
    } finally {
      process.env.CRON_SECRET = original
    }
  })

  it('accepts the right key and returns a run report', async () => {
    const response = await handleWatchdogRequest(new Request(`${endpoint}?key=${CRON_SECRET}`), payload)
    expect(response.status).toBe(200)
    const body = (await response.json()) as { ok: boolean; forced: boolean }
    expect(body.ok).toBe(true)
    expect(body.forced).toBe(false)
  })

  it('parses force=1 behind the same secret', async () => {
    const response = await handleWatchdogRequest(
      new Request(`${endpoint}?key=${CRON_SECRET}&force=1`),
      payload,
    )
    expect(response.status).toBe(200)
    const body = (await response.json()) as { forced: boolean }
    expect(body.forced).toBe(true)
  })

  it('validates keys with isWatchdogKeyValid', () => {
    expect(isWatchdogKeyValid(CRON_SECRET)).toBe(true)
    expect(isWatchdogKeyValid('nope')).toBe(false)
    expect(isWatchdogKeyValid(null)).toBe(false)
    expect(isWatchdogKeyValid(undefined)).toBe(false)
    expect(isWatchdogKeyValid('')).toBe(false)
  })
})
