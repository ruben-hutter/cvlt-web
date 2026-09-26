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

---

## Implementation notes (feat/shop-watchdog, 2026-09-26)

### How it works

- **Check module**: `src/lib/watchdog.ts`
  - `runStuckReservationCheck()` finds `shop_reservations` rows that expired without
    being consumed and sends one alert mail per reservation to `SHOP_EMAIL`
    (orderRef, item keys, created_at, RaiseNow backoffice instructions).
  - `runSelfChecks()` runs the daily pipeline checks; each check is independent and
    failures are collected into a single digest alert:
    - **SMTP**: `transport.verify()` via `verifyMailTransport()` in `src/lib/mail.ts`
      (connect + authenticate, sends no mail).
    - **DB**: write + read-back of a nonce row in the internal `payload_kv` store
      (`payload.kv`, key `watchdog:selfcheck:dbProbe`).
    - **Paylink**: `fetch(SHOP_PAYLINK_URL)`, any status < 500 counts as alive.
- **Alerted state — design decision**: tracked via a new **`alertedAt` date field on
  the reservation itself** (not `payload_kv`), written only *after* the mail was sent
  successfully. Mail failure → not marked → retried on the next run; success → never
  duplicated. An in-process mutex serializes overlapping runs (cron + manual).
- **New reservation status `expired`** (labels: Attiva / Confermata / Scaduta /
  Rilasciata). `sweepExpiredReservations()` in `src/lib/shop-stock.ts` now writes
  `expired` instead of `released` — otherwise a checkout minutes after a hold lapses
  would flip the row to a “silent” state before the watchdog ever saw it, and the
  lost-order alert would be lost. `released` remains valid for historical rows.
- **Scheduling**: Infomaniak shared hosting has no shell cron, so the watchdog is a
  protected endpoint. **The production URL must be registered as an Infomaniak panel
  cron (every 15–30 min, plain HTTP GET):**

  ```
  GET https://cvlt.ch/api/cron/watchdog?key=<CRON_SECRET>
  ```

  `CRON_SECRET` is a new env var (see `.env.example`; generate with
  `openssl rand -base64 32`). The key is compared constant-time (both sides hashed
  before `timingSafeEqual`); missing/wrong key → `401`; **no secret configured →
  every request rejected (fail closed)**. A `503` body signals a run with failures.
- **Manual test mode**: `GET /api/cron/watchdog?key=<CRON_SECRET>&force=1` runs all
  self-checks immediately (ignores the 24 h gate) in addition to the reservation
  sweep. Safe to call from a browser or curl.
- **Daily gate**: self-checks run at most once per 24 h (last-run timestamp in
  `payload_kv`, key `watchdog:selfcheck:lastRunAt`). A persistent failure therefore
  alerts ~once/day instead of once per cron tick. Reservation alerts are NOT gated —
  exactly-once per reservation via `alertedAt`.
- The watchdog never throws out of the endpoint: every stage is wrapped, failures are
  logged with the `[watchdog]` prefix and reported in the JSON response.

### Testing

- `tests/watchdog.test.ts`: expired reservation → status flip + exactly-once alert
  (mail mocked at module boundary), race with the stock sweep, concurrent runs,
  SMTP-failure retry, self-check gating + digest, and 401s for missing/wrong key.
- Local manual test: `curl 'http://localhost:3000/api/cron/watchdog?key=...&force=1'`.
  Mail mocks mean `npm test` never sends real email.

### Acceptance criteria status

- [x] Unconsumed expired reservation → exactly one alert (unit-tested).
- [x] Broken SMTP config → digest alert within one check cycle (unit-tested via
      mocked transport failure).
- [x] Endpoint without the secret returns 401 (unit-tested on the shared handler).
- [x] Watchdog failures never crash the app (all stages wrapped; route catches
      Payload init errors).
- [x] `npx tsc --noEmit` + `npm test` pass. (`npm run lint`: this repo currently has
      no ESLint config — `npx next lint` is not runnable, skipped per repo convention.)
