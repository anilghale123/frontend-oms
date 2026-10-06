---
paths:
  - "src/components/**"
  - "src/features/**/components/**"
  - "src/app/**/page.tsx"
  - "src/app/**/layout.tsx"
---
# UI rules

## Three tiers — every piece of UI fits exactly one
1. `src/components/ui` — Radian primitives only, added with `npx radianui@latest add <name>`,
   never hand-written.
2. `src/components/{layout,data-display,feedback}` — domain-agnostic compositions (AppShell, Page, EmptyState,
   DataTable…). Built only from `ui/` + tokens. Data comes in through props; no imports from
   features, config, providers, lib/api, lib/domain. See `components.md`.
3. `src/features/*` — OMS-specific components.

Decision order: a Radian component exists → use it. Otherwise compose a pattern. Build
something custom only if neither fits, and say so explicitly in your summary.

## Files and imports
- File names are **kebab-case** everywhere (that is what the Radian CLI generates):
  `src/components/ui/button.tsx`, `layout/page-header.tsx`, `hooks/use-orders.ts`.
  Exports are PascalCase components / camelCase hooks: `import { Button } from "@/components/ui/button"`.
- Import tier-2 components from their folder barrel: `import { Page, PageBody } from "@/components/layout"`.
- Edit files in `src/components/ui` only to add a variant or adjust tokens, and say so in
  your summary. Never fork a Radian component into a feature folder. They are excluded from
  Prettier so CLI re-adds diff cleanly.

## Styling
- Radian tokens and Tailwind scale values only. No hex colors, no arbitrary values like
  `text-[#123456]`, `p-[13px]`, `[grid-template-columns:…]` (lint-enforced outside `ui/`).
  State variants such as `data-[state=open]:` are fine.
- Status colors and labels come only from `StatusBadge` in `features/orders`.

## Pages
- Page headers are title only: no description/subtext line under the title. Record details
  (customer, IDs) belong in the page body.
- Every page renders `<Page title actions>` + `<PageBody>`. `title` comes from the route in
  `src/config/nav.ts`, never a string typed into the page.
- Every data view has loading (Skeleton), empty (EmptyState), and error (ErrorState) states.
- Server Components by default. Add `"use client"` only to the smallest interactive leaf.

## Accessibility and copy
- Icon-only buttons need `aria-label`. Keep visible focus. Touch targets ≥ 44px on mobile.
- Copy: sentence case, plain verbs, the same action name from button to toast
  ("Assign rider" → "Rider assigned"). Errors say what happened and what to do next.
