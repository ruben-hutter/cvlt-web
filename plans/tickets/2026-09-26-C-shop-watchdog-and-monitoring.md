# Ticket C: Shop watchdog — alert on lost orders, expired reservations, dead email

**Priority:** High — "I never want a customer to be the one telling me it's broken"
**Branch:** `feat/shop-watchdog`
**Can run in parallel with:** A, B, D

## Problem

During the 2026-09-26 incident the system failed *silently*: a paid order produced
no DB row, no email, no log line, and no alert. The only signal was an
`active` row in `shop_reservations` that nobody looks at. There is no monitoring
of any kind today.

## Required work

1. **Stuck-reservation alert** — a scheduled job that runs every ~15–30 min:
   - find `shop_reservations` rows still `active` whose `expiresAt` has passed
   - mark them `expired` (new status — coordinate with A if it adds statuses)
   - if a reservation expired **without being consumed**, send an email alert to
     `SHOP_EMAIL` (reuse `src/lib/mail.ts`): "possible lost shop order",
     orderRef, items, created_at, and a link to the RaiseNow backoffice.
     Rate-limit/digest so one bad day doesn't spam (e.g. one mail per orderRef,
     max N/day).
2. **Daily pipeline self-check** (same scheduler):
   - SMTP: verify transport configuration (connect + authenticated send to self,
     or dry-run verification that transport.verify() passes — pick what nodemailer
     supports without sending junk daily; a real mail once a week to SHOP_EMAIL
     is fine too)
   - DB: a trivial write/read against `payload_kv` or similar
   - RaiseNow paylink: `fetch(SHOP_PAYLINK_URL)` expects 2xx/3xx
   - On failure → email alert to `SHOP_EMAIL` (and log `[watchdog]`).
   - Keep the check itself resilient: one failing check must not block the others.
3. **Scheduling mechanism** — Infomaniak shared hosting has no shell cron for us.
   Options (pick one, document in `docs/`):
   - Infomaniak panel cron hitting a protected endpoint
     `GET /api/cron/watchdog?key=<CRON_SECRET>` (add `CRON_SECRET` to `.env.example`,
     constant-time compare) — simplest, recommended
   - in-process `setInterval` in `scripts/start.mjs` or an instrumentation hook
   - Payload Jobs API if already available in this Payload version
4. **README/docs**: one paragraph in `docs/` (or this file → summary in README)
   describing what the watchdog checks, the alert recipient, and how to test it
   (`?force=1` style manual trigger guarded by the same secret).

## Acceptance criteria

- [ ] An unconsumed expired reservation reliably produces exactly one alert email
      (test by inserting a fake expired reservation and triggering the job).
- [ ] Killing SMTP config produces a daily alert within one check cycle.
- [ ] Watchdog endpoint without the secret returns 401/403.
- [ ] Watchdog failures never crash the main app process.
- [ ] `npm run lint` + `npx tsc --noEmit` + `npm test` pass.

## Coordination

- Uses reservation `status` values — align with Ticket A's final state list.
- Uses `src/lib/mail.ts` — if B changes logging there, rebase trivially.
