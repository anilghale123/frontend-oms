---
paths:
  - "src/components/layout/**"
  - "src/components/data-display/**"
  - "src/components/feedback/**"
  - "docs/components.md"
---
# Shared component rules (tier 2)

- A tier-2 component is domain-agnostic: no order, merchant, rider or status vocabulary in its
  names, props or copy. If it needs OMS knowledge, it belongs in `src/features/*`.
- Build only from `@/components/ui/*`, `@/lib/utils`, `@/lib/nav/match` and tokens. No
  imports from features, config, providers, lib/api or lib/domain (lint-enforced).
- Data comes in through props. Patterns never fetch, read the session or read the nav config.
- Every exported tier-2 component ships both of these in the same change:
  1. typed props with a JSDoc line on the component and on any prop that isn't obvious;
  2. an entry in `docs/components.md` (what it is, when to use it, props);
- Export it from its folder's `index.ts` (`layout`, `data-display` or `feedback`). Files are kebab-case.
- Pick the folder by purpose: screen structure and navigation -> `layout`; tables, metrics and
  export -> `data-display`; empty, error and confirmation states -> `feedback`.
- Sibling tier-2 imports are fine. Shared types used by all three go in `@/components/types`.
- Add `"use client"` only when the pattern uses hooks or context itself.
- Don't reproduce what a Radian primitive already does (Card, Badge, Tabs…). Use the primitive.
