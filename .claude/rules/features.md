---
paths:
  - "src/features/**"
---
# Feature module rules

- Shape: `components/ hooks/ api.ts schema.ts index.ts`. Use the `new-feature` skill.
  Features with no data or forms (e.g. `shell`) omit `hooks/`, `api.ts`, `schema.ts`.
- Other code imports a feature only through its `index.ts`. No deep imports.
- Inside a feature, use relative imports (`../api`), not `@/features/<self>/...`.
- Components never call `fetch`. Data flows: component → hook (TanStack Query) →
  `api.ts` → `@/lib/api/client`.
- Query keys come from `@/lib/api/query-keys`. Mutations invalidate the affected keys
  (list + detail + activity).
- Business decisions (can this transition happen? how many attempts left?) are made by
  functions in `@/lib/domain`, not inline in components.
- Never import `@/lib/mock`.
