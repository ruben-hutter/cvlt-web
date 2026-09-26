# Ticket B: Fix console.info logging gap + structured shop/order logging

**Priority:** High — we were blind during the incident
**Branch:** `feat/logging-console-info`
**Can run in parallel with:** A, C, D

## Problem

`scripts/start.mjs` tee-oses only `log`, `error`, `warn` into `logs/server.log`:

```js
for (const method of ['log', 'error', 'warn']) {
```

The only `console.info` in the codebase is the most important line during the
2026-09-26 incident — `console.info('[shop-order] checkout prepared', …)` in
`src/app/(frontend)/api/shop-order/route.ts` — so the production log contained
**zero** trace of checkout preparations. Note: dev's `start.mjs` already reworked
rotation (async append, 50MB cap) but still has the same method-list bug.

## Required work

1. **Patch `info` too** in `scripts/start.mjs` (add `'info'` to the method list).
   Keep the async append/rotation logic from dev intact.
2. **Structured, greppable logging in the shop-order route** — every state change
   logs one line with the orderRef:
   - `prepare` success (already exists — switch to the patched channel)
   - `prepare` rejected (reason: validation / antispam / stock / rate-limit) — log
     at warn level WITHOUT personal data (no email/phone/address; orderRef + reason
     + item keys are fine)
   - `confirm` success / already-confirmed / rejected (expired token, reservation
     gone) — same PII rule
   - email send success AND failure (currently failure logs via console.error with
     the full order — keep the error detail but never log full customer PII in the
     happy path)
3. Apply the same minimal logging pattern to `contact` and `membership` API routes
   (submission received / email failed) — they have the same silence problem.
4. Never log: email addresses, phone numbers, full names, addresses. OrderRef,
   item keys, statuses, IPs are OK.

## Acceptance criteria

- [ ] `console.info` output appears in `logs/server.log` in production runtime
      (verify locally with `npm run build && npm run start`).
- [ ] A grep for `[shop-order]` in server.log reconstructs the full lifecycle of
      an order (prepare → confirm → email) without exposing PII.
- [ ] Existing rotation logic untouched and still passing.
- [ ] `npm run lint` + `npx tsc --noEmit` pass.

## Coordination

- Tiny, self-contained; land it FIRST — A, C and D all benefit from visible logs.
