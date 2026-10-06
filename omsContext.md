# OMS — context handoff

Paste this at the start of a new session. It is the minimum needed to work on OMS without
re-deriving decisions or breaking rules that lint enforces.

## Projects (siblings under `C:\Users\A S P I R E 3\Documents\`)

| Folder | What | Role |
|---|---|---|
| `oms-frontend` | Next.js 16 + TS. **The project.** Branch `oms-frontend`. | What we build |
| `fonepoints-business` | Angular 22 merchant portal that embeds OMS in an iframe | Integration host |
| `Fonepoints-oms` | Next.js 16 + TS, complete OMS design | **UI source of truth** |
| `miniapp-esewa` | Vite + React Router 7 SPA (NOT Next.js) | **Engineering standards** |

**Goal:** Fonepoints design + eSewa engineering discipline + proper TypeScript.

Two premise corrections that matter: the design repo is **already TypeScript** (no JSX→TSX
migration exists), and eSewa is **Vite, not Next** (no routing/layout patterns transfer from it).

## State: done and working

- Full OMS ported: order queue, order detail, mark ready, assign rider, rider voucher portal
- Runs on an in-memory mock (`src/app/api/mock`), reset on dev restart. **All data is dummy.**
- `lint` + `tsc:check` + 24 unit tests + clean build all pass; husky runs them pre-commit
- 23/23 browser checks on OMS; 21/21 on the iframe integration
- 4 commits on `oms-frontend`, 1 on `fonepoints-business`

## Architecture (lint-enforced — `eslint.boundaries.mjs`)

```
src/components/ui/            Tier 1: 31 Radian primitives. GENERATED — never hand-edit or fork.
src/components/layout/        Tier 2: Page, Panel, AppShell, AppSidebar, Nav*, PageHeader
src/components/data-display/  Tier 2: DataTable, useDataTable, StatTile, ExportMenu
src/components/feedback/      Tier 2: EmptyState, ErrorState, CopyButton
src/components/types.ts       IconComponent (shared by all three tier-2 folders)
src/features/                 Tier 3: orders, fulfillment, delivery-validation, shell
src/lib/domain/               Business rules. PURE TS — no React, no fetch.
src/lib/api/                  client, contracts, endpoints, errors, query-keys
src/lib/mock/                 in-memory db + seed
src/config/                   nav.ts, constants.ts, env.ts
src/app/(merchant)/           /, /settings, /orders, /orders/[omsOrderId]
src/app/(rider)/deliver       mobile, no login
src/app/embed/orders          embedded surface — NO chrome (host supplies it)
src/app/backup-orders/        preserved spike vs the real API. FROZEN; exempt from lint.
```

`app → features → components/{layout,data-display,feedback} → components/ui → lib/utils`.
Never the reverse. Sibling tier-2 imports are allowed.

Tier 2 is **three purpose folders**, not the design repo's single `patterns` folder.

## Rules that will fail lint or review

1. **Tokens only.** No hex, no arbitrary Tailwind (`text-[13px]`, `w-[240px]`).
2. **UI never imports `@/lib/mock`.** Go through `@/lib/api` + feature hooks.
3. **Features imported via their `index.ts`**, never a deep path.
4. **Status rules live in `src/lib/domain/status.ts`.** Status colors come only from `StatusBadge`.
5. **No `fetch` in components:** component → hook (TanStack Query) → `api.ts` → `lib/api/client`.
6. **Never hardcode `/orders`.** Use `useOrderRoutes()` — the same components serve the
   standalone and embedded surfaces.
7. Forms: react-hook-form + `zodResolver`, schema in the feature's `schema.ts`.
8. **Tabs, not spaces.** kebab-case files, PascalCase exports, `use-x.ts` → `useX`.
9. Route params use domain names: `[omsOrderId]`, never `[id]`.
10. Icons Lucide only. Copy is sentence case, active verbs ("Mark ready").

**Read `.claude/rules/design-system.md` before any UI change.** It holds a ~45-entry dated
decisions log with rejected alternatives. It is the most valuable file in the repo.

## Settled decisions — do not re-litigate

| Topic | Decision |
|---|---|
| Validation | **zod** (not eSewa's yup) |
| Server state | **TanStack Query** (not eSewa's hand-rolled `useFetch`/`useInfiniteFetch`) |
| Styling | Tailwind v4 tokens (not eSewa's SCSS/styled-components) |
| UI kit | Radian primitives (not `esewa-ui-library`) |
| Global state | zustand for session only |
| Toasts | `sonner`, wired in the root layout |
| i18n | **Skipped.** eSewa's `shared/locale` is a one-language copy map, not i18n. If a second language is ever needed, use a real library per the Next 16 guide (`app/[lang]`), not a hand-rolled catalog. |
| Auth | **Deferred.** No token plumbing anywhere yet. |
| Backend | Mock only (auth is deferred, so the real API is unreachable) |
| Status machine | `preparing → ready_for_delivery → delivering → delivered`, exception `failed` |

**Not copied from eSewa, deliberately:** `pages/` + React Router, `useFetch`/`useInfiniteFetch`/
`useMutation` (~300 lines reimplementing TanStack Query), yup, SCSS, `useFormAlert` (defines a
component inside the hook body — remounts every render), scattered `sessionStorage` parsing,
`window.location.href` in interceptors, 400–600 line page components.

## Embedding (the Angular host)

- Portal owns **all** chrome. OMS `/embed/*` renders page header + content, no sidebar/header.
- `frame-ancestors` CSP governs framing: `/embed/*` allows `NEXT_PUBLIC_EMBED_HOST_ORIGINS`
  (default `http://localhost:4200`); **every other route is `'self'`**, so the dashboard and
  rider portal cannot be framed. Verified.
- A refused frame is **silent** — no error event. `OmsPage` uses a 12s timeout + retry.
- Run both: OMS `npm run dev` (:3000), portal `npm start` (:4200).

## Gotchas (expensive to rediscover)

- **The seed has failure-injection vouchers**: `REDEMPTION-FAILS`, `MISMATCH-CODE`,
  `ALREADY-REDEEMED`. Anything automated must avoid them or it will "fail" correctly.
- **Mock adds 300–800 ms latency** on purpose. Tests must wait on content, not fixed timeouts.
- The table renders **skeleton rows first** — wait for a real `OMS-\d+` before counting rows.
- Images come from a CDN and need network access.
- `@types/node` is pinned to `^24` to match the Node runtime (vitest requires it).
- `@tanstack/react-table` must stay **v8** (v9 is a breaking API change); `zod` must stay **v4**.

## Defects fixed during the port (do not reintroduce)

1. `lib/api/client.ts` hardcoded `/api/mock` while three docs claimed it read
   `NEXT_PUBLIC_OMS_API_BASE`. It now reads it via `@/config/env`.
2. `ApiError` lacked the `code` field its own rule file specified.
3. The mock emitted three different error envelopes. All failures now go through `mockError()`
   in `src/app/api/mock/_error.ts` → `{ error: { code, message } }`. `lib/api/errors.ts` still
   parses the other shapes defensively.

## Commands

```bash
npm run dev          # :3000
npm run lint         # also the architecture + styling boundaries
npm run tsc:check
npm run test:run     # 24 tests over lib/domain
npm run build
npm run format
```

## Open / next

| Item | Blocked on |
|---|---|
| Authentication | next phase. Spike preserved at `/backup-orders` — but it targets **apps-frontend**, while the real host is the **Angular** portal, so the `postMessage` protocol must be re-agreed. |
| Real Providhy API behind `contracts.ts` | auth |
| Deep-linking an order from the host URL | needs `postMessage` URL sync; today the portal stays on `/oms` |
| Whether Providhy sales-order statuses (`draft → submitted_for_approval → approved`) coexist with fulfillment statuses | product confirmation |

## Docs in repo

`AGENTS.md` (rules, short) · `.claude/rules/design-system.md` (**tokens + decisions log**) ·
`docs/architecture.md` · `docs/domain-rules.md` · `docs/components.md` ·
`omsImplementationPlan.md` (how it was built, what is deferred) · `omsPrompt.md` (original brief)
