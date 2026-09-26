import crypto from 'node:crypto'
import type { Payload } from 'payload'
import {
  sendShopWatchdogAlert,
  sendWatchdogSelfCheckAlert,
  verifyMailTransport,
} from './mail'
import type { ReservationItem } from '../collections/ShopReservations'

/**
 * Shop watchdog: alerts when a paid shop order probably got lost, and runs
 * daily self-checks on the order pipeline (SMTP / DB / RaiseNow paylink).
 *
 * Triggered by an Infomaniak panel cron hitting
 *   GET /api/cron/watchdog?key=<CRON_SECRET>       (every 15–30 min)
 *   GET /api/cron/watchdog?key=<CRON_SECRET>&force=1   (manual test run)
 *
 * Exactly-once alerting: each reservation carries an `alertedAt` field that is
 * written only AFTER the alert mail was sent successfully, so a mail failure is
 * retried on the next run while a sent mail is never duplicated.
 */

const SELF_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000
const SELF_CHECK_LAST_RUN_KEY = 'watchdog:selfcheck:lastRunAt'
const DB_PROBE_KEY = 'watchdog:selfcheck:dbProbe'
const PAYLINK_TIMEOUT_MS = 15_000

export type WatchdogCheckResult = { ok: boolean; detail?: string }

export type WatchdogSelfCheckResult = {
  ran: boolean
  lastRunAt: string | null
  checks: {
    smtp?: WatchdogCheckResult
    db?: WatchdogCheckResult
    paylink?: WatchdogCheckResult
  }
}

export type WatchdogReservationResult = {
  /** reservations that expired unconsumed and were picked up by this run */
  found: number
  /** reservations for which an alert mail was actually sent */
  alerted: number
  orderRefs: string[]
}

export type WatchdogRunResult = {
  ranAt: string
  forced: boolean
  reservations: WatchdogReservationResult
  selfCheck: WatchdogSelfCheckResult
  failures: string[]
  ok: boolean
}

type RawReservation = {
  id: number | string
  orderRef?: unknown
  status?: unknown
  items?: unknown
  createdAt?: unknown
  expiresAt?: unknown
  alertedAt?: unknown
}

function errorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return String(error)
}

function readTrimmedEnv(name: string): string | undefined {
  const value = process.env[name]
  if (typeof value !== 'string') return undefined
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

/**
 * Constant-time comparison of the provided key against CRON_SECRET.
 * Hashing both sides first keeps timingSafeEqual happy about buffer lengths
 * and avoids leaking the secret length. Fails closed when CRON_SECRET is not
 * configured (the watchdog endpoint rejects every request).
 */
export function isWatchdogKeyValid(provided: string | null | undefined): boolean {
  const secret = readTrimmedEnv('CRON_SECRET')
  if (!secret) {
    console.error('[watchdog] CRON_SECRET is not configured — rejecting all watchdog requests')
    return false
  }
  if (!provided) return false
  const providedHash = crypto.createHash('sha256').update(provided).digest()
  const secretHash = crypto.createHash('sha256').update(secret).digest()
  return crypto.timingSafeEqual(providedHash, secretHash)
}

function parseItems(raw: unknown): Array<{ key: string; qty: number }> {
  if (!Array.isArray(raw)) return []
  return (raw as ReservationItem[])
    .filter((item) => item && typeof item.key === 'string' && Number(item.qty) > 0)
    .map((item) => ({ key: item.key, qty: Number(item.qty) }))
}

function formatDate(value: unknown): string | undefined {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? undefined : value.toISOString()
  }
  if (typeof value !== 'string' && typeof value !== 'number') return undefined
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString()
}

async function findCandidates(payload: Payload): Promise<RawReservation[]> {
  const now = new Date().toISOString()
  const result = await payload.find({
    collection: 'shop-reservations',
    // Catches both:
    // - active holds whose TTL lapsed (watchdog got there before any checkout)
    // - rows already swept to 'expired' by the shop stock logic, not yet alerted
    where: {
      or: [
        {
          and: [
            { status: { equals: 'active' } },
            { expiresAt: { less_than: now } },
          ],
        },
        {
          and: [
            { status: { equals: 'expired' } },
            { alertedAt: { exists: false } },
          ],
        },
      ],
    },
    limit: 0,
    depth: 0,
    overrideAccess: true,
  })
  return result.docs as unknown as RawReservation[]
}

let alertMutex: Promise<unknown> = Promise.resolve()

function withAlertLock<T>(fn: () => Promise<T>): Promise<T> {
  const result = alertMutex.then(() => fn())
  alertMutex = result.then(
    () => undefined,
    () => undefined,
  )
  return result
}

/**
 * Marks lapsed reservations 'expired' and sends exactly one alert mail per
 * unconsumed reservation (alertedAt is written after a successful send).
 */
export async function runStuckReservationCheck(payload: Payload): Promise<WatchdogReservationResult> {
  return withAlertLock(async () => {
    const candidates = await findCandidates(payload)
    const result: WatchdogReservationResult = { found: candidates.length, alerted: 0, orderRefs: [] }

    for (const doc of candidates) {
      const wasActive = doc.status === 'active'
      if (doc.alertedAt) {
        // Safety net: already alerted, only normalize the status.
        if (wasActive) {
          await payload.update({
            collection: 'shop-reservations',
            id: doc.id,
            data: { status: 'expired' },
            overrideAccess: true,
          })
        }
        continue
      }

      const orderRef = typeof doc.orderRef === 'string' ? doc.orderRef : String(doc.id)
      const items = parseItems(doc.items)
      const createdAt = formatDate(doc.createdAt) ?? formatDate(doc.expiresAt)

      console.warn(
        `[watchdog] reservation ${orderRef} expired without a confirmed order — sending lost-order alert`,
      )
      // Send first, mark afterwards: a mail failure is retried on the next run,
      // while a successful send is never repeated.
      await sendShopWatchdogAlert({ orderRef, items, createdAt })
      await payload.update({
        collection: 'shop-reservations',
        id: doc.id,
        data: {
          ...(wasActive ? { status: 'expired' as const } : {}),
          alertedAt: new Date().toISOString(),
        },
        overrideAccess: true,
      })
      result.alerted += 1
      result.orderRefs.push(orderRef)
    }

    return result
  })
}

async function runCheck(name: string, fn: () => Promise<void>): Promise<WatchdogCheckResult> {
  try {
    await fn()
    return { ok: true }
  } catch (error) {
    console.error(`[watchdog] self-check "${name}" failed: ${errorMessage(error)}`)
    return { ok: false, detail: errorMessage(error) }
  }
}

function checkSmtp(): Promise<WatchdogCheckResult> {
  return runCheck('smtp', async () => {
    // transport.verify() connects and authenticates without sending a mail.
    await verifyMailTransport()
  })
}

function checkDb(payload: Payload): Promise<WatchdogCheckResult> {
  return runCheck('db', async () => {
    const nonce = `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`
    await payload.kv.set(DB_PROBE_KEY, { nonce })
    const readBack = await payload.kv.get<{ nonce: string }>(DB_PROBE_KEY)
    if (readBack?.nonce !== nonce) {
      throw new Error('payload_kv read-back did not return the written value')
    }
  })
}

function checkPaylink(): Promise<WatchdogCheckResult> {
  return runCheck('paylink', async () => {
    const paylinkUrl = readTrimmedEnv('SHOP_PAYLINK_URL')
    if (!paylinkUrl) throw new Error('SHOP_PAYLINK_URL is not configured')
    const response = await fetch(paylinkUrl, {
      redirect: 'follow',
      signal: AbortSignal.timeout(PAYLINK_TIMEOUT_MS),
      headers: { 'user-agent': 'cvlt-watchdog/1.0' },
    })
    if (response.status >= 500) {
      throw new Error(`paylink responded with HTTP ${response.status}`)
    }
  })
}

async function runSelfChecks(
  payload: Payload,
  forced: boolean,
  ranAt: string,
): Promise<WatchdogSelfCheckResult> {
  const lastRunRaw = await payload.kv.get<{ at: string }>(SELF_CHECK_LAST_RUN_KEY)
  const lastRunAt = typeof lastRunRaw?.at === 'string' ? lastRunRaw.at : null

  if (
    !forced &&
    lastRunAt &&
    Number.isFinite(new Date(lastRunAt).getTime()) &&
    Date.now() - new Date(lastRunAt).getTime() < SELF_CHECK_INTERVAL_MS
  ) {
    return { ran: false, lastRunAt, checks: {} }
  }

  // Each check is independent: a rejection inside one check must not block the others.
  const smtp = await checkSmtp()
  const db = await checkDb(payload)
  const paylink = await checkPaylink()

  // Persist the run regardless of the outcome so a persistent failure alerts
  // at most once per day instead of once per cron invocation.
  await payload.kv.set(SELF_CHECK_LAST_RUN_KEY, { at: ranAt })

  return { ran: true, lastRunAt, checks: { smtp, db, paylink } }
}

export async function runWatchdog(
  payload: Payload,
  options: { force?: boolean } = {},
): Promise<WatchdogRunResult> {
  const forced = options.force === true
  const ranAt = new Date().toISOString()
  const result: WatchdogRunResult = {
    ranAt,
    forced,
    reservations: { found: 0, alerted: 0, orderRefs: [] },
    selfCheck: { ran: false, lastRunAt: null, checks: {} },
    failures: [],
    ok: true,
  }

  try {
    result.reservations = await runStuckReservationCheck(payload)
    if (result.reservations.alerted > 0) {
      console.warn(
        `[watchdog] sent ${result.reservations.alerted} lost-order alert(s): ${result.reservations.orderRefs.join(', ')}`,
      )
    }
  } catch (error) {
    const failure = `stuck-reservation check failed: ${errorMessage(error)}`
    console.error(`[watchdog] ${failure}`)
    result.failures.push(failure)
  }

  try {
    const selfCheck = await runSelfChecks(payload, forced, ranAt)
    result.selfCheck = selfCheck

    if (selfCheck.ran) {
      const selfCheckFailures: string[] = []
      for (const [name, check] of Object.entries(selfCheck.checks)) {
        if (check && !check.ok) {
          selfCheckFailures.push(`${name}: ${check.detail ?? 'failed'}`)
        }
      }
      result.failures.push(...selfCheckFailures)

      if (selfCheckFailures.length > 0) {
        try {
          await sendWatchdogSelfCheckAlert(selfCheckFailures, ranAt)
          console.error(`[watchdog] self-check alert sent: ${selfCheckFailures.join(' | ')}`)
        } catch (error) {
          const failure = `failed to send the self-check alert email: ${errorMessage(error)}`
          console.error(`[watchdog] ${failure}`)
          result.failures.push(failure)
        }
      } else {
        // console.log (not .info): scripts/start.mjs tees only log/warn/error into server.log.
        console.log('[watchdog] daily self-checks passed (smtp, db, paylink)')
      }
    }
  } catch (error) {
    const failure = `self-check failed: ${errorMessage(error)}`
    console.error(`[watchdog] ${failure}`)
    result.failures.push(failure)
  }

  result.ok = result.failures.length === 0
  return result
}

/**
 * Request handler shared by the /api/cron/watchdog route. Lives here (not in
 * the route file) so the auth + run logic can be tested without Next.js.
 * Never throws: unexpected errors become a 500 JSON response.
 */
export async function handleWatchdogRequest(request: Request, payload: Payload): Promise<Response> {
  let url: URL
  try {
    url = new URL(request.url)
  } catch {
    return Response.json({ error: 'Invalid request URL' }, { status: 400 })
  }

  if (!isWatchdogKeyValid(url.searchParams.get('key'))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const force = url.searchParams.get('force') === '1'
  try {
    const result = await runWatchdog(payload, { force })
    // 503 so the Infomaniak cron log / any uptime monitor sees degraded runs too.
    return Response.json(result, { status: result.ok ? 200 : 503 })
  } catch (error) {
    console.error('[watchdog] unexpected failure', error)
    return Response.json({ error: 'Watchdog failed unexpectedly' }, { status: 500 })
  }
}
