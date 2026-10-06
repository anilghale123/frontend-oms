---
paths:
  - "src/app/api/mock/**"
  - "src/lib/mock/**"
---
# Mock backend rules

The mock must behave like the real OMS would, including the unhappy paths.

- Request/response types come from `@/lib/api/contracts`. Validate every request body
  with zod and return `{ error: { code, message } }` with a proper HTTP status.
- Enforce rules server-side using `@/lib/domain` functions: transitions, rider info,
  attempt limit, override permission, merchant isolation (filter by session merchant).
- Order creation is idempotent on `fonepointsRef`.
- Voucher mismatch returns the identical generic response whether or not the order exists.
- Attempts are stored and decremented here, never trusted from the client.
- Every mutation appends an activity-log entry with actor and timestamp.
- Add 300–800 ms latency so loading states are visible.
- Seed data is deterministic (fixed IDs) and covers: every status, a duplicate reference,
  an order with 1 attempt left, a blocked order, an already-redeemed voucher, a pending
  reconciliation, a failed status sync.
- Test vouchers for the Fonepoints simulator are listed in `src/lib/mock/fonepoints.ts`.
