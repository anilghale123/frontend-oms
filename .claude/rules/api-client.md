---
paths:
  - "src/lib/api/**"
---
# API client rules

- One fetch wrapper in `client.ts`; base URL from `NEXT_PUBLIC_OMS_API_BASE`
  (default `/api/mock`). Nothing else may hard-code a URL.
- All shapes live in `contracts.ts`, shared with the mock handlers.
- Errors are thrown as a typed `ApiError { code, message, status }`.
- Query keys are a factory in `query-keys.ts`: `queryKeys.orders.list(filters)`,
  `queryKeys.orders.detail(id)`, `queryKeys.orders.activity(id)`.
- No React code in this folder.
