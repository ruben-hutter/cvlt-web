# Ticket A (CRITICAL): Server-side shop order confirmation

**Priority:** Critical — orders are silently lost today
**Branch:** `feat/shop-server-side-confirm`
**Can run in parallel with:** B, C, D (see "Coordination" at the bottom)

## Problem (evidence from production incident 2026-09-26)

A customer paid CHF 55 via Twint on RaiseNow for 1× Giacca Fleece Uomo (Grigia, L),
but no order was saved and no email was sent.

Root cause: **the order is only confirmed client-side.** The flow today is:

1. `prepare` → server returns signed `orderToken` + RaiseNow checkout URL
   (`src/app/(frontend)/api/shop-order/route.ts`)
2. Client stores `orderToken` in `localStorage`, redirects to RaiseNow
3. Customer pays — possibly inside the Twint app, possibly never returning to the site
4. Only IF the browser lands on `/shop?shop_paid=1` with localStorage intact,
   `ShopContent.tsx` POSTs `{ action: 'confirm', orderToken }` → only THEN is the
   order written to `shop-orders` and the email sent

If step 4 never happens (closed tab, different browser, cleared localStorage,
redirect without `?shop_paid=1`, token older than `SHOP_RESERVATION_TTL_MS` = 2h),
the paid order is lost with **zero server-side trace**. DB proof on 2026-09-26:
reservation `f638fa51-2b3c-41b9-b202-bce46cce82d7` created 13:28 UTC, still `active`,
no `shop_orders` row, no error in `logs/server.log`.

## Goal

The server — not the customer's browser — must be the authority that finalizes an order.

## Required work

1. **RaiseNow webhook (preferred)** — research and implement: RaiseNow Paylink
   supports payment webhooks (verify exact setup in the RaiseNow Manager dashboard
   / docs). Add `POST /api/shop-webhook` that receives the payment success payload,
   matches the order via `reference.campaign_subid` (= our `orderRef`, already sent
   in `buildCheckoutUrl`), then finalizes: `consumeReservation` → `saveOrderToDb` →
   `sendShopOrderNotification`. Must be idempotent (`isOrderConfirmed` already exists).
   - Verify webhook authenticity as far as RaiseNow allows (shared secret / signature
     header if available; otherwise validate payload shape + rate-limit + logging).
   - Add env var(s) to `.env.example` (e.g. `SHOP_WEBHOOK_SECRET`).
2. **`/shop/confirm` result page** — RaiseNow redirect URL points to
   `/shop/confirm?order_ref=<orderRef>`; the page polls a new read-only endpoint
   (`POST /api/shop-order` action `status`, or GET) that returns order state for that
   orderRef (paid / pending / not found). No personal data beyond what the caller
   already knows; do NOT leak customer PII — return status only.
   - Keep the existing localStorage+`?shop_paid=1` confirm as a fallback for old
     redirect configs.
3. **TTL handling** — with a webhook, confirmation no longer depends on the 2h
   client token. Either extend `SHOP_RESERVATION_TTL_MS` (e.g. 24h) or decouple:
   reservation expiry should no longer block webhook confirmation (webhook proves
   payment). Document the decision in the ticket/commit.
4. **Infomaniak/RaiseNow config doc** — short section in this file or
   `docs/` describing exactly what to configure in the RaiseNow dashboard
   (webhook URL + redirect URL). The dashboard changes are manual steps for Ruben.

## Acceptance criteria

- [ ] Paying on RaiseNow and closing the browser immediately still results in a
      `shop-orders` row + confirmation email (webhook path, testable on staging
      or by curling the webhook endpoint with a fixture payload).
- [ ] Confirming twice (webhook + fallback client confirm) creates exactly one order.
- [ ] Redirect to `/shop/confirm?order_ref=…` shows the real order state even in a
      fresh browser (no localStorage).
- [ ] Old `?shop_paid=1` flow still works.
- [ ] No PII exposed via the status endpoint without possession of the orderRef.
- [ ] `npm run lint` + `npx tsc --noEmit` + `npm test` pass.
- [ ] Tests from Ticket D (or your own) cover webhook confirm, double-confirm
      idempotency, unknown orderRef, expired reservation + successful payment.

## Status update 2026-09-27: RaiseNow basic plan has NO webhooks

The club's RaiseNow package ("Pagamenti più" payment page "Shop CVLT", pay.raisenow.io/stpxb)
offers no webhook configuration in the dashboard. Consequences:

- The deployed `/api/shop-webhook` stays **dormant** (answers 503 fail-closed) until
  either the plan changes or RaiseNow support enables webhooks/API — worth one support email.
- `SHOP_WEBHOOK_SECRET` does NOT need to be set for now.
- Order confirmation remains the **browser flow**: RaiseNow redirect → `/shop?shop_paid=1`
  → localStorage token → `confirm` POST. Do NOT repoint the RaiseNow success redirect to
  `/shop/confirm` — that page only polls the read-only status endpoint, it cannot finalize orders.
- The **watchdog (Ticket C) is the active safety net**: expired-unconsumed reservations
  (= probable lost order) trigger one alert email each to `SHOP_EMAIL`; Ruben then completes
  the order manually using the RaiseNow transaction data.
- RaiseNow's own "transaction confirmation copy" email (Settings → Notifiche → shop@cvlt.ch)
  is the independent payment signal — it was NOT arriving as of 2026-09-26; troubleshoot
  (spam, Infomaniak mail logs, test payment, RaiseNow support).

## Coordination with other tickets

- **D (tests)** may already add route tests against the *current* API; keep the
  existing `action: 'prepare' | 'confirm'` contract intact and only ADD
  actions/endpoints, so D's tests keep passing.
- **C (watchdog)** consumes reservation state (`shop_reservations.status`); if you
  introduce new status values (e.g. `webhook_confirmed`), list them here:
  **None.** The webhook reuses the existing statuses only (`active`,
  `fulfilled`, `released`) — `fulfilled` stays the single terminal
  "order recorded" state, so C's watchdog logic needs no changes. The webhook
  logs under the `[shop-webhook]` prefix (console.error / console.log only, so
  `scripts/start.mjs` tees it into `logs/server.log`).
- **B (logging)** adds structured logging; use its logger util if it has landed,
  otherwise plain `console.error`/`console.log` (never `console.info`, see Ticket B).

---

## Implementation notes (feat/shop-server-side-confirm)

### Decision: payment proof beats reservation expiry (TTL handling)

The 2h `SHOP_RESERVATION_TTL_MS` is kept **unchanged** (it still bounds how long
an unpaid checkout holds stock). Webhook confirmation no longer depends on it:

- Reservation `active` → `consumeReservation` (decrements stock, status →
  `fulfilled`), exactly like the client confirm path.
- Reservation `released` (expired / swept) or expired-but-not-yet-swept → the
  webhook tries `decrementStockForSale`; if the item sold out in the meantime it
  logs `[shop-webhook] stock no longer available for paid order, recording
  anyway` and **still records the order and sends the email**. An oversell that
  the comitato can resolve is strictly better than a silently lost paid order
  (the 2026-09-26 incident). The stock shortfall is logged loudly for Ticket C
  to alert on.
- Reservation `fulfilled` (webhook redelivery, or crash between consume and
  save) → stock untouched, order row written once.
- No reservation at all for the `campaign_subid` → HTTP 404 + loud log (should
  not happen: the reservation is created before the checkout URL exists).

Idempotency: `isOrderConfirmed` short-circuit + the unique `orderRef` index on
`shop-orders` + a post-create re-check on unique-constraint errors ⇒ webhook
double deliveries and webhook-vs-client-fallback races produce **exactly one**
order row and one email. Persistence lives in `src/lib/shop-orders.ts`, shared
by both confirmation paths.

### New/changed pieces

- `POST /api/shop-webhook` — verifies `SHOP_WEBHOOK_SECRET` (header
  `X-Webhook-Secret`, or `Authorization: Bearer <secret>` fallback) with a
  constant-time compare (sha256 + `timingSafeEqual` so length doesn't leak);
  fails closed with 503 when the env var is unset, 401 on missing/wrong secret;
  rate-limited 60/min/IP. Matches the order via `reference.campaign_subid`,
  tolerates RaiseNow payload shape drift (supporter/reference/amount looked up
  at several documented paths; unknown status vocabulary logs an error and
  proceeds, failed/pending statuses answer `200 {ignored:true}` so RaiseNow
  stops retrying). Amounts are read as minor units (cents) and cross-checked
  against the catalog-recomputed total (mismatch → error log, catalog total
  wins so items ↔ total stay consistent).
- `POST /api/shop-order` gained a read-only `action: 'status'` (body
  `{ orderRef }`) answering `{ status: 'paid' | 'pending' | 'not_found' }` —
  no PII, valid-UUID required, its own 30/min/IP rate-limit bucket so the
  confirm page can poll without starving prepare/confirm (still 3/min).
- `/shop/confirm?order_ref=…` — polls the status action every 3s for up to 3
  minutes, then shows a contact-the-comitato message. If `order_ref` is missing
  (static redirect config) it decodes the orderRef from the localStorage order
  token (same browser only) before giving up. The old `?shop_paid=1` client
  confirm in `ShopContent.tsx` is untouched as the legacy fallback.
- Tests: `tests/webhook.test.ts` (17 tests) — happy path, double-delivery
  idempotency, client-confirm race, unknown orderRef, expired + released
  reservation, oversell, 401/503 secret handling, payload validation, and the
  status action. Email sending is mocked at the `@/lib/mail` module boundary;
  `vitest.config.ts` aliases `@payload-config` → `src/payload.config.ts` and
  sets deterministic env in `tests/helpers/test-env.ts`.

### Authenticity status / follow-up

RaiseNow's native webhook **signature** support (HMAC header) could not be
confirmed from public docs — check the webhook configuration form in the
RaiseNow dashboard (step 2 below). If a signature scheme exists there, adapt
`extractProvidedSecret`/`secretsMatch` in `src/app/(frontend)/api/shop-webhook/route.ts`
to verify it and keep the shared secret only as a fallback. Until then the
shared-secret header is enforced and the endpoint fails closed.

---

## RaiseNow dashboard configuration (manual steps for Ruben)

Everything below happens in the RaiseNow Manager / dashboard for the existing
shop paylink (`SHOP_PAYLINK_URL`, currently `pay.raisenow.io/…`). Do it once on
the production paylink; nothing needs to change in the paylink URL parameters.

1. **Webhook (critical — this is the fix):**
   - RaiseNow dashboard → the shop paylink / campaign → connection or
     integration settings → add a **webhook** (may be labelled "Webhook",
     "Notification URL" or "Server-to-server callback").
   - URL: `https://cvlt.ch/api/shop-webhook`
   - Method: `POST`, body format: `JSON`.
   - Trigger on: **successful/completed payments only** (statuses like
     `finalized`/`success`); failed or pending notifications are tolerated
     (answered and ignored) but just add noise.
   - Authentication: add a **custom HTTP header** to the webhook configuration:
     `X-Webhook-Secret: <value of SHOP_WEBHOOK_SECRET>` (generate with
     `openssl rand -base64 32`, store it in the Infomaniak env as
     `SHOP_WEBHOOK_SECRET` **before** enabling the webhook — the endpoint
     answers 503 until the env var exists).
   - If the form instead offers a built-in **signature/HMAC secret**, note the
     header name it uses and tell Ruben/devs: the route must then verify that
     signature (see "Authenticity status" above). If no header can be
     configured at all, do NOT enable the webhook unprotected — the endpoint
     will keep rejecting it and orders keep flowing through the legacy browser
     fallback.
   - Reference field: confirm the paylink keeps sending
     `reference.campaign_subid` in the webhook body (it is the same value the
     checkout URL receives; verify with the first test payment's payload in
     `logs/server.log` under `[shop-webhook]`).
2. **Redirect URL (UX only — orders are already safe via the webhook):**
   - Paylink settings → "Redirect after successful payment" / "Thank-you page":
     `https://cvlt.ch/shop/confirm?order_ref={campaign_subid}`
     If the dashboard does not support the `{campaign_subid}` placeholder,
     use the plain `https://cvlt.ch/shop/confirm` — the page then falls back to
     the localStorage order token, and the webhook confirms the order
     regardless of what the browser does.
   - Optional failure redirect: `https://cvlt.ch/shop?shop_failed=1` (existing
     handling in `ShopContent.tsx`).
3. **Verification checklist after configuration:**
   - Make a small real Twint payment, close the browser tab immediately after
     authorizing in the Twint app.
   - Expect within ~1 min: a row in Payload `/admin` → **ShopOrders** with
     `paymentStatus = paid`, the confirmation email to `SHOP_EMAIL`, and
     `[shop-webhook] order confirmed via webhook` in `logs/server.log`.
   - Visit `https://cvlt.ch/shop/confirm?order_ref=<orderRef from the admin>`
     in a fresh browser (private window): it must show "Ordine confermato!".
   - Curl smoke test of the auth layer (no payment needed):
     `curl -i -X POST https://cvlt.ch/api/shop-webhook -H 'content-type: application/json' -d '{}'`
     must answer `401` (and `503` while `SHOP_WEBHOOK_SECRET` is unset).
   - Re-deliver the same webhook event twice from the dashboard (or resend):
     still exactly one ShopOrders row.
