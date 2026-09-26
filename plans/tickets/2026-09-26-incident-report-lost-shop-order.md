# Incident 2026-09-26: Paid shop order silently lost

## Timeline & evidence

- **2026-09-26 13:28:44 UTC** — unknown customer completed `prepare` for
  1× Giacca Fleece Uomo, Grigia, L (CHF 55). Reservation created:
  `shop_reservations` id 1, orderRef `f638fa51-2b3c-41b9-b202-bce46cce82d7`.
- Customer paid successfully on RaiseNow (per their report to the club).
- **No** `shop_orders` row, **no** confirmation email, **no** error in
  `logs/server.log` (covered 2026-09-16 → 2026-09-26 20:39).
- Reservation still `status='active'` → consumeReservation never ran.

## Root cause

Order confirmation is **client-side only**: it happens only if the buyer's browser
returns to `/shop?shop_paid=1` with the signed token still in `localStorage`
(`src/app/(frontend)/shop/ShopContent.tsx`). Closing the tab after paying in the
Twint app (or any redirect/localStorage failure) loses the paid order with zero
server-side trace. Also: `console.info('[shop-order] checkout prepared', …)` is
invisible in production because `scripts/start.mjs` only tees
`log`/`error`/`warn` into `server.log` — the one diagnostic line we had was dropped.

## Follow-ups

| Ticket | Scope |
|:---|:---|
| `plans/tickets/2026-09-26-A-shop-server-side-order-confirmation.md` | Server/webhook-driven confirmation (critical fix) |
| `plans/tickets/2026-09-26-B-fix-console-info-logging-gap.md` | Patch `console.info`, structured order logging |
| `plans/tickets/2026-09-26-C-shop-watchdog-and-monitoring.md` | Alerts for stuck reservations, SMTP/paylink/DB checks |
| `plans/tickets/2026-09-26-D-shop-order-integration-tests.md` | Route-level integration test suite |

## Immediate remediation (manual, requires RaiseNow access)

1. RaiseNow backoffice → payments from 2026-09-26 ~15:28 CEST, CHF 55.00,
   Twint → export buyer contact data.
2. Register the order manually in Payload `/admin` → collection
   **ShopOrders** (`shop-orders`): items = Giacca Fleece Uomo / ed. 2023 /
   Grigia / L × 1, total 55, paymentMethod `twint`, paymentStatus `paid`,
   orderRef `f638fa51-2b3c-41b9-b202-bce46cce82d7` (reuse it so the reservation
   matches), then email the customer their confirmation manually.
3. Optionally set that reservation's status to `consumed` so stock math stays tidy
   (expired reservations are already ignored by stock counting after 2h).
