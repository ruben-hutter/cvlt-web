import { getPayload } from 'payload'
import config from '@payload-config'
import { handleWatchdogRequest } from '@/lib/watchdog'

export const dynamic = 'force-dynamic'

/**
 * Shop watchdog endpoint, hit by an Infomaniak panel cron every 15–30 min:
 *
 *   GET /api/cron/watchdog?key=<CRON_SECRET>
 *   GET /api/cron/watchdog?key=<CRON_SECRET>&force=1   (manual test run)
 *
 * See plans/tickets/2026-09-26-C-shop-watchdog-and-monitoring.md.
 */
export async function GET(request: Request): Promise<Response> {
  try {
    const payload = await getPayload({ config })
    return await handleWatchdogRequest(request, payload)
  } catch (error) {
    console.error('[watchdog] could not initialize Payload', error)
    return Response.json({ error: 'Watchdog failed unexpectedly' }, { status: 500 })
  }
}
