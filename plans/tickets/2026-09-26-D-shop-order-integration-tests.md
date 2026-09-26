# Ticket D: Integration tests for the shop order pipeline

**Priority:** High — the failure shipped because nothing exercised the flow
**Branch:** `test/shop-order-flow`
**Can run in parallel with:** A, B, C

## Problem

The shop pipeline (prepare → reservation → confirm → DB row → email) had zero
test coverage; the stock-tracking tests in `tests/stock.test.ts` cover only the
reservation primitives. The 2026-09-26 lost-order bug lived exactly in the
untested gap (confirm never called ⇒ silence).

## Required work

Use the existing setup: vitest (`vitest.config.ts`, `npm test`),
`tests/helpers/`, and the pattern of `tests/stock.test.ts`
(Payload instance against SQLite — check how the helper boots Payload and reuse it).

1. **Token round-trip** — `signOrderPayload` / `verifyOrderToken`
   (`src/app/(frontend)/api/shop-order/route.ts`): tampered signature, wrong
   payload shape, expired `createdAt` (> `SHOP_RESERVATION_TTL_MS`).
   (Extract these helpers into `src/lib/` if that makes them importable without
   the route — allowed, keep the route thin.)
2. **Route-level tests** (call the POST handler with mocked `Request`):
   - `prepare` happy path (twint): returns checkoutUrl on pay.raisenow.io with
     `reference.campaign_subid` = orderRef, amount prefilled, creates an
     `active` reservation
   - `prepare` with invoice: creates the order immediately, sends email
     (mock `sendShopOrderNotification`), decrements stock
   - `prepare` rejects: honeypot filled, missing fields, bad email domain,
     unknown product key, non-2-decimal total, invalid payment method
   - `confirm` happy path: order row exists, `paymentStatus` correct, email sent,
     reservation consumed (status change), second confirm → `alreadyConfirmed`
     and still exactly ONE order row
   - `confirm` with expired token → 400; confirm with expired/missing reservation
     → 409
   - `InsufficientStockError` → 409 with the Italian message
   - rate limit: 4th request within a minute from same IP → 429
3. **End-to-end regression for the incident**: prepare → (simulate "never
   returned": do nothing) → assert NO order row exists but reservation is active;
   then after Ticket A lands, the webhook path test asserts the order IS created.
   Write this test now against the webhook contract described in Ticket A
   (`POST /api/shop-webhook` fixture payload), mark `describe.skip` with a TODO
   referencing Ticket A if the endpoint doesn't exist yet — unskip in A's branch.
4. **Mail failure resilience**: mocked `sendShopOrderNotification` throwing must
   still return success:true (order saved), and log the failure.

## Acceptance criteria

- [ ] `npm test` green; new suite covers every branch of the route file
      (aim: no uncovered `if` in `shop-order/route.ts`).
- [ ] Tests do not send real emails (mock at module boundary) and do not hit
      network (checkout URL asserted as string).
- [ ] `fileParallelism: false` respected (shared SQLite file).
- [ ] `npm run lint` + `npx tsc --noEmit` pass.

## Coordination

- Tests target the CURRENT contract (`action: 'prepare' | 'confirm'`); Ticket A
  only ADDS endpoints. Don't refactor the request/response shape here.
- If A lands first, unskip the webhook regression test in the same PR or a
  trivial follow-up.
