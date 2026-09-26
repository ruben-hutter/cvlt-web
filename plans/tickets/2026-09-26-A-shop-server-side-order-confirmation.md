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

## Coordination with other tickets

- **D (tests)** may already add route tests against the *current* API; keep the
  existing `action: 'prepare' | 'confirm'` contract intact and only ADD
  actions/endpoints, so D's tests keep passing.
- **C (watchdog)** consumes reservation state (`shop_reservations.status`); if you
  introduce new status values (e.g. `webhook_confirmed`), list them here:
  _(fill in before merging)_.
- **B (logging)** adds structured logging; use its logger util if it has landed,
  otherwise plain `console.error`/`console.log` (never `console.info`, see Ticket B).
