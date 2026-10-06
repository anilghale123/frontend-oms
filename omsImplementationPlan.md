# OMS — Implementation Plan

> **Audience:** the OMS frontend developer implementing this, and whoever reviews progress against it.
> **Companion doc:** `omsPrompt.md` (the brief). Phase 1 analysis findings are summarised in §1–§3 here.
> **Status:** approved plan, not yet executed. Branch `oms-frontend`.

---

## 1. Goal

Build OMS as **Next.js + TypeScript**, combining:

- **Design** from `Fonepoints-oms` — the visual and UX source of truth
- **Engineering discipline** from `miniapp-esewa` — the team's production standards

The result should read as a natural evolution of the eSewa MiniApp's engineering standards applied to the
Fonepoints OMS design — not a merge of two codebases, and not an over-engineered rewrite.

### Premise corrections carried over from Phase 1

Two statements in `omsPrompt.md` turned out to be wrong, and they change the shape of the work:

| `omsPrompt.md` says | Reality | Consequence |
|---|---|---|
| Design repo is "Next.js + JavaScript/JSX" | `Fonepoints-oms` is already **Next.js 16 App Router + TypeScript**, ~19,000 LOC, lint-enforced layering | There is **no JSX→TSX migration**. The brief's Phase 3 collapses into "port layer by layer". |
| eSewa is "Next.js + TypeScript" | `miniapp-esewa` is a **Vite + React Router 7 SPA** | **No Next.js patterns exist in eSewa to copy.** Nothing about routing, layouts or server/client boundaries transfers. Its value is the production layer: HTTP, errors, auth structure, tests, tooling. |

Because the design repo is the better-engineered of the two on nearly every axis, the job is to **port it
faithfully** and graft on the operational discipline it lacks — it has no auth, no tests, no CI, and a
mock-only backend.

---

## 2. Decisions settled

| Topic | Decision |
|---|---|
| **Shell** | OMS runs **embedded in an iframe** inside the Fonepoints portal (Angular). The full standalone shell is still built now; see §9.1. |
| **Rider portal** | **In scope.** A standalone page, not inside any app. The merchant sends the link to riders manually. The sidebar shortcut stays for convenience. |
| **Authentication** | **Deferred** to a later phase. No `TokenProvider`, no token plumbing in this phase. |
| **Backend** | **Dummy / mock only.** See §4. |
| **Status machine** | The **fulfillment** lifecycle: `preparing → ready_for_delivery → delivering → delivered`, exception `failed`. |
| **Tier-2 folder naming** | Split by purpose: `components/layout/`, `components/data-display/`, `components/feedback/`. Replaces the design repo's single `components/patterns/`. |

### Consequences of deferring auth

The real Providhy Sales API (`dev-sales-api.providhy.com`) needs a bearer token on every call, so it is
unreachable this phase. That settles two things without further input:

1. **The mock backend is the backend** for this phase, behind `lib/api/contracts.ts`.
2. **The Providhy sales-order statuses** (`draft → submitted_for_approval → approved → cancelled`) from the
   existing spike are **out of scope** and get preserved in `backup-orders/`. If both lifecycles turn out
   to coexist, that is a later additive change, not a rewrite.

### Noted for the auth phase

The existing spike's `postMessage` handshake targets **apps-frontend** (a Next.js app at `localhost:3001`,
per the comment in `app/token-context.tsx`). The real host is the **Angular** Fonepoints portal. The `MSG`
constants and `PARENT_ORIGIN` are therefore placeholders, and the real protocol must be agreed with the
Angular team. The spike code is preserved in `backup-orders/` as the starting point.

---

## 3. Scope

### In scope this phase

- Merchant surface: Order Queue, Order detail
- Mark ready, Assign rider
- Rider surface: `/deliver` — Order ID + voucher validation, QR scan, attempt counter
- Full design system: tokens, primitives, tier-2 components
- Mock backend with deterministic dummy data
- Engineering guardrails: lint boundaries, tests, formatting, pre-commit, env config

### Explicitly out of scope / deferred

| Item | Why |
|---|---|
| Authentication, token handling, SSO | Deferred by decision |
| Real Providhy API integration | Blocked on auth |
| Providhy sales-order status lifecycle | Not this model; preserved in `backup-orders/` |
| Shared locale catalog / i18n | **Decided: skip.** eSewa's `shared/locale` is a one-language copy catalog, not i18n — no language switching, no plurals, no placeholders; applied in only 35 of 136 files, and its Title Case values violate the design repo's sentence-case rule. OMS has ~126 copy strings with only ~10 repeating across files, and the copy that must be shared (status labels, exact rider validation messages) already lives in `lib/domain`. If a second language is ever needed, use a real i18n library per the Next 16 guide (`app/[lang]`, server dictionaries), not a hand-rolled catalog. |
| Settings → Appearance panel, profile dialog | Only if Settings becomes real; Settings is a placeholder page |
| CS and dev surfaces | Already removed from the design repo (2026-10-04); not revived |

---

## 4. Dummy data policy

All data and values in this phase are dummy. Specifically:

- **Source:** `src/lib/mock/seed.ts` — deterministic fixtures with fixed IDs, held in memory, reset on
  dev-server restart.
- **Served by:** Next route handlers under `src/app/api/mock/*`, which behave like a real backend —
  validate request bodies with zod, enforce rules server-side via `lib/domain`, return proper HTTP status
  codes, append activity-log entries, and add 300–800 ms latency so loading states are visible.
- **Seed coverage:** every status, a duplicate reference ID, an order with 1 attempt left, a blocked order,
  an already-redeemed voucher, a pending reconciliation, a failed status sync.
- **Attempt counting is server-side**, never trusted from the client — the dummy backend must not weaken a
  domain rule just because it is dummy.
- **Swap seam:** `src/lib/api/contracts.ts` holds every request and response shape, shared by the mock
  handlers and the feature `api.ts` wrappers. When the real API arrives, point `NEXT_PUBLIC_OMS_API_BASE`
  at it and keep the contracts; screens do not change.

**Rule:** no component hardcodes data. Even dummy values flow
`component → hook → api.ts → client → contracts`.

---

## 5. Target architecture

```
src/
  app/
    (merchant)/                      # merchant surface — sidebar dashboard
      layout.tsx                     # MerchantShell. ALL shell composition lives here (see §9.1)
      page.tsx                       # /            Home (placeholder)
      settings/page.tsx              # /settings    Settings (placeholder)
      orders/
        page.tsx                     # /orders      Order Queue
        (detail)/layout.tsx          # keeps the order list panel mounted between orders
        (detail)/[omsOrderId]/page.tsx   # /orders/[omsOrderId]   Order detail
    (rider)/                         # rider surface — mobile-first, no sidebar, no login
      layout.tsx                     # RiderShell
      deliver/page.tsx               # /deliver     Confirm delivery
    backup-orders/                   # PRESERVED SPIKE — real Providhy API (see Step 0)
      layout.tsx  page.tsx  [id]/page.tsx  token-context.tsx
    api/mock/                        # dummy backend
      orders/route.ts
      orders/[omsOrderId]/{route,status/route,rider/route}.ts
      validate/route.ts
      dev/{voucher/[omsOrderId],delivering}/route.ts
    layout.tsx  globals.css  utility.css

  components/
    ui/                              # TIER 1 — Radian primitives (30 files, see §6)
    layout/                          # TIER 2 — screen structure + navigation
    data-display/                    # TIER 2 — tables, metrics, export
    feedback/                        # TIER 2 — empty, error, confirmation
    icons/                           # logo

  features/                          # TIER 3 — OMS-specific
    orders/        components/{queue,detail}/  hooks/  api.ts  export.ts  index.ts
    fulfillment/   components/  schema.ts  index.ts
    delivery-validation/  components/  hooks/  api.ts  schema.ts  index.ts
    shell/         components/  index.ts

  lib/
    domain/        # pure TS business rules + vitest tests
    api/           # client.ts  contracts.ts  query-keys.ts  endpoints.ts  errors.ts
    mock/          # in-memory db, seed, Fonepoints simulator
    nav/           # route matching, breadcrumbs
    utils/         # cn, formatting, export

  config/          # nav.ts  constants.ts  env.ts
  providers/       # QueryProvider  SessionProvider
```

### Tier-2 file assignment

Replaces the design repo's single `components/patterns/` folder. There are ~45 references to it across 30
files; renaming during a fresh port costs nothing, which is why it happens now and not later.

| Folder | Files |
|---|---|
| `layout/` | `app-shell`, `app-sidebar`, `app-header`, `workspace-header`, `sidebar-profile`, `mobile-shell`, `page`, `page-header`, `panel`, `nav-main`, `nav-tabs`, `nav-breadcrumbs`, `types.ts` |
| `data-display/` | `data-table/` (11 files, keeps its own barrel), `stat-tile`, `export-menu` |
| `feedback/` | `empty-state`, `error-state`, `copy-button` |
| `layout/` (reversed deferral) | `appearance-panel`, `appearance-sync`, `profile-dialog` — see note below |

Two judgment calls, recorded so they can be revisited:

- `nav-*` sits in `layout/` rather than its own `navigation/` folder, because `AppSidebar` already renders
  `NavMain` and the nav types belong next to what consumes them.
- `copy-button` sits in `feedback/` because its entire purpose is the "Copied" confirmation — it exists
  precisely because there is no toast primitive.

> Corrected during implementation: `appearance-panel` and `profile-dialog` were going to be deferred,
> but `ShellHeader` needs `ProfileDialog` for the user menu. Dropping it would have been an arbitrary
> visual change, which the brief forbids, so all three appearance files were ported into `layout/`.

### Dependency direction

```
app → features → components/{layout,data-display,feedback} → components/ui → lib/utils
                           ↘ lib/api → lib/domain
```

Never the reverse. Enforced by `eslint.boundaries.mjs` (Step 9).

| Layer | May import | Must not import |
|---|---|---|
| `app/` | features, components, lib/api, lib/domain | `lib/mock` (except `app/api/mock`) |
| `app/api/mock/` | lib/mock, lib/domain, lib/api/contracts | features, components |
| `features/<x>/` | components, lib/api, lib/domain, other features via `index.ts` | lib/mock, deep paths into other features |
| `components/ui/` | lib/utils | everything else |
| tier-2 folders | components/ui, lib/utils, lib/nav | features, config, providers, lib/api, lib/domain, lib/mock |
| `lib/domain/` | only other `lib/domain` files | React, Next, anything else |

---

## 6. Dependencies

Measured from actual imports, not copied from the design repo's `package.json`. Only **31 of its 51**
primitives are reachable from the screens, which avoids 17 packages.

> Corrected during implementation: the first count of 30 missed `spinner`, which `button.tsx`
> imports relatively (`./spinner`) rather than through `@/components/ui/*`. `tsc` caught it.

**Already present:** `next@16.3.7`, `react@19.2.8`, `react-dom`, `tailwindcss@4`, `@tailwindcss/postcss`,
`typescript`, `eslint`, `eslint-config-next`, `@types/*`

### Add — runtime

```
@radix-ui/react-accordion      @radix-ui/react-alert-dialog   @radix-ui/react-avatar
@radix-ui/react-collapsible    @radix-ui/react-dialog         @radix-ui/react-dropdown-menu
@radix-ui/react-label          @radix-ui/react-popover        @radix-ui/react-scroll-area
@radix-ui/react-select         @radix-ui/react-separator      @radix-ui/react-slot
@radix-ui/react-tabs           @radix-ui/react-toggle         @radix-ui/react-toggle-group
@radix-ui/react-tooltip
@tanstack/react-query          @tanstack/react-table
react-hook-form                @hookform/resolvers            zod
class-variance-authority       clsx                           tailwind-merge
lucide-react                   date-fns                       tw-animate-css
react-day-picker  (calendar)   cmdk  (command)                vaul  (drawer)
nanoid  (mock ids)             zustand  (session store)       sonner  (toast — our addition)
```

### Add — dev

```
vitest  @vitejs/plugin-react  jsdom
@testing-library/react  @testing-library/jest-dom  @testing-library/dom
prettier  prettier-plugin-tailwindcss  husky
```

### Deliberately NOT added

The design repo has these; nothing we port uses them: `recharts`, `react-shiki`, `embla-carousel-react`,
`react-resizable-panels`, `react-currency-input-field`, the `radix-ui` meta package, and the Radix packages
for `aspect-ratio`, `checkbox`, `context-menu`, `hover-card`, `menubar`, `navigation-menu`,
`one-time-password-field`, `progress`, `radio-group`, `slider`, `switch`.

**Note on `sonner`:** the design repo lists it in `package.json` but never imports it — its only trace is a
TODO comment in `app/layout.tsx`. The toast is therefore new work, adapted from eSewa's two-tier toast
concept, not a port.

### The 30 primitives to port

`accordion` `alert` `alert-dialog` `avatar` `badge` `breadcrumb` `button` `calendar` `card` `collapsible`
`command` `dialog` `divider` `drawer` `dropdown-menu` `empty` `form` `input` `label` `pagination`
`popover` `scroll-area` `select` `sidebar` `skeleton` `spinner` `table` `tabs` `toggle` `toggle-group`
`tooltip`

28 are imported directly by screens; `collapsible`, `toggle` and `spinner` are pulled in transitively.

---

## 7. Implementation steps

Bottom-up: each layer compiles and runs before the next lands. The brief's Phase 2 ("architecture setup")
and Phase 3 ("UI migration") merge here, because there is no JS→TS conversion between them.

### Step 0 — Preserve the existing spike

Per the brief: keep the current orders pages as a backup, renamed, since OMS starts fresh.

1. **Commit first.** `app/orders/[id]/page.tsx` has an uncommitted `any → unknown` cleanup (11 insertions,
   5 deletions). Commit it so the backup captures the latest work.
2. Move:
   - `app/page.tsx` → `app/backup-orders/page.tsx`
   - `app/orders/[id]/page.tsx` → `app/backup-orders/[id]/page.tsx`
   - `app/token-context.tsx` → `app/backup-orders/token-context.tsx`
3. Fix the relative import depth in both moved pages (`../../token-context` → `../token-context`).
4. **Add `app/backup-orders/layout.tsx`** providing `TokenProvider`. It currently lives in the root layout,
   which Step 7 replaces — without this the backup pages break.
5. Delete the now-empty `app/orders/`.

**Done when:** `/backup-orders` and `/backup-orders/[id]` build and render, showing the "Waiting for access
token…" state — which is correct, since there is no token source yet.

---

### Step 1 — Restructure to `src/`

- `app/` → `src/app/`
- `tsconfig.json`: `"@/*": ["./src/*"]` (currently `["./*"]`)
- Add `components.json` with `hasSrcDir: true`, `iconLibrary: "lucide"`, and matching aliases

**Why required:** every ported import assumes `@/` resolves to `src/`.

**Done when:** `npx tsc --noEmit` passes and `/backup-orders` still renders.

---

### Step 2 — Dependencies

Install §6. Add scripts: `tsc:check`, `format`, `format:check`, `test`, `test:run`.

**Done when:** `npm run tsc:check` passes clean.

---

### Step 3 — Design system foundation

This **is** the design. Ported verbatim; not a place for judgment.

- `src/app/globals.css` — 542 lines: semantic tokens, status and theme remaps, light + `.dark`, font and
  heading utilities
- `src/app/utility.css` — 326 lines: raw Radian color scales
- `src/lib/utils/index.ts` (`cn`) and `src/lib/utils/format.ts` (`formatRs`, `formatOrderValue`,
  `formatDate`, `formatDateTime`, `formatPhone`, `initialsOf`)
- `src/app/layout.tsx`: Geist Sans + Geist Mono, `bg-fill1` on body

**Done when:** a scratch page renders token colors correctly in both light and dark.

---

### Step 4 — Tier 1: `components/ui/`

Port the 30 primitives from §6. Verified portable — they depend only on `react`, `@radix-ui/*`,
`class-variance-authority`, `lucide-react`, `@/lib/utils` and a handful of public packages. No proprietary
runtime and no registry access needed.

**Rule:** these are generated artifacts. Do not hand-edit or fork them; they stay identical to source.

**Done when:** every primitive type-checks, and a scratch page renders Button, Input, Select, Badge, Table,
Dialog and Tabs at their documented sizes.

---

### Step 5 — Tier 2: `layout/`, `data-display/`, `feedback/`

Port per the assignment table in §5, each folder with its own `index.ts` barrel. Rewrite
`@/components/patterns` imports to the three new paths.

**Rule:** tier-2 components are domain-agnostic — no order, merchant, rider or status vocabulary in their
names, props or copy. Data arrives through props. They never fetch and never read the session.

**Done when:** `Page` + `Panel` + `DataTableCard` render with static props on a scratch page, including
their loading, empty and error states.

---

### Step 6 — `lib/` foundation

Where the eSewa engineering standards actually land.

| File | Source | Notes |
|---|---|---|
| `lib/domain/{types,status,permissions,validation,index}.ts` | design repo | Ported as-is. Pure TS. |
| `lib/domain/*.test.ts` | **new** | **First tests.** Pure TS, no React — the highest-ROI test surface in the codebase. Cover `canTransition`, `consumesAttempt`, `isValidationBlocked`, `nextAttemptsRemaining`. |
| `lib/api/client.ts` | design repo, **fixed** | Two documented-but-missing fixes: actually read `NEXT_PUBLIC_OMS_API_BASE` (it hardcodes `/api/mock` today), and give `ApiError` a `code` field (its own rule file specifies `{code, message, status}`). |
| `lib/api/errors.ts` | **eSewa pattern** | Adapted from `shared/utils/error.ts` — collapses the several backend error envelopes (`details` object or string, `error`, `non_field_errors`, bare `message`) into one user-facing string. |
| `lib/api/endpoints.ts` + `config/env.ts` | **eSewa pattern** | Adapted from eSewa `constants.ts`: one typed env module, one endpoint map. Nothing else hardcodes a URL. |
| `lib/api/contracts.ts`, `query-keys.ts` | design repo | The swap seam and the query-key factory. |
| `lib/mock/{db,seed,fonepoints}.ts` + `app/api/mock/*` | design repo | The dummy backend per §4. |
| `lib/nav/match.ts`, `lib/utils/export.ts` | design repo | Route matching; CSV/XLSX export. |

**Done when:** `npm run test:run` passes on the domain tests, and `/api/mock/orders` returns seeded orders
in the browser.

---

### Step 7 — Providers, config, shell

- `providers/QueryProvider.tsx` — TanStack Query client, 30s `staleTime`, `BroadcastChannel("oms-sync")`
  cross-tab invalidation
- `providers/SessionProvider.tsx` — zustand session store (the only zustand use), `skipHydration` plus
  rehydrate on mount so server and first client render match
- `config/nav.ts`, `config/constants.ts` — typed routes; sidebars, breadcrumbs and page titles all derive
  from here, never typed into a page
- `src/app/layout.tsx` — providers, fonts, `Toaster` (sonner)
- `features/shell/` — `MerchantShell`, `RiderShell`, `ShellHeader`
- `src/app/(merchant)/layout.tsx`, `src/app/(rider)/layout.tsx`
- Placeholder pages: `/` and `/settings`

**Done when:** the sidebar, header and empty page container render; light/dark toggles; `/deliver` loads
chrome-free; `/backup-orders` still works.

---

### Step 8 — Tier 3: features

| Feature | Contents |
|---|---|
| `features/orders/` | `components/queue/` (queue page, columns, status tabs, date filter, row action, customer and item cells), `components/detail/` (detail page, list panel, fulfillment tracker, summary, side panel, customer / delivery / rider panels), `status-badge.tsx`, `detail-field.tsx`, `hooks/`, `api.ts`, `export.ts` |
| `features/fulfillment/` | `MarkReadyDialog`, `AssignRiderDialog`, `schema.ts` |
| `features/delivery-validation/` | `DeliveryValidationForm`, `AttemptsCounter`, `QrScanSheet`, `DeliveryConfirmed`, `SimulateDeliveryButton`, hooks, `schema.ts`, `api.ts` |

**Rules:**

- Components never call `fetch`. Data flows `component → hook (TanStack Query) → api.ts → lib/api/client`.
- Business decisions (can this transition happen? how many attempts are left?) come from `lib/domain`
  functions, never inline in a component.
- Mutations invalidate the affected query keys — list, detail and activity.
- Forms: react-hook-form + `zodResolver`, schema in the feature's `schema.ts`, errors inline per field,
  submit disabled while pending.
- Status colors come only from `StatusBadge`. Never pick badge colors per page.

**Carry over the design repo's "switched off for now" list** so behavior matches the approved design:

| What | Where |
|---|---|
| Assign rider disabled | queue row action + detail next-step bar |
| Failed orders hidden from all lists | `HIDE_FAILED` in `features/orders/hooks/use-orders.ts` |
| Failed + Delivering status filters | commented in `OrderStatusTabs`, `OrderListPanel` |
| Queue date filter, Show columns | commented in `OrderQueuePage` |
| Row size, Full screen | commented in `DataTableCard` |
| Page-header Export | commented in `OrderQueuePage` |

**Done when:** the full flow works on dummy data — browse and filter the queue, open an order, mark it
ready, open `/deliver`, confirm a delivery with the right voucher, see a wrong voucher decrement the
attempt counter, and watch the merchant tab update live.

---

### Step 9 — Engineering guardrails

The rest of eSewa's discipline, which the design repo lacks entirely.

- **`eslint.boundaries.mjs`** — the layer table in §5 plus the styling bans (no hex, no arbitrary Tailwind
  values). Tier-2 needs **one** glob, not three: `src/components/{layout,data-display,feedback}/**` —
  brace globs already work in this config. The `@/components/patterns` entries in the other blocks expand
  to the three new paths.
- **Prettier** + `prettier-plugin-tailwindcss`, `.prettierrc.json`, `.prettierignore`, `.editorconfig`
- **vitest** + jsdom + Testing Library, `src/test/setup.ts`
- **husky** pre-commit running `lint` and `tsc:check`
- **`.env.example`** documenting `NEXT_PUBLIC_OMS_API_BASE` (default `/api/mock`)

**Done when:** `npm run lint`, `npm run tsc:check` and `npm run test:run` all pass, and a deliberate
boundary violation — a `@/lib/mock` import from a feature, or a hex color — fails lint.

---

### Step 10 — Documentation

The design repo's docs are its most valuable non-code asset — in particular a ~40-entry dated decisions log
explaining why each UI choice was made, including rejected alternatives. **Losing it would be the most
expensive mistake available.** Port it.

- `docs/architecture.md` — folder map, updated for the tier-2 split
- `docs/domain-rules.md` — statuses, validation, permissions
- `docs/components.md` — tier-2 props, now covering three folders
- `docs/HANDOFF.md` — developer entry point
- `.claude/rules/` — `patterns.md` → **`components.md`**, covering all three tier-2 folders; update folder
  names throughout `design-system.md`, `ui.md`, `features.md`, `forms.md`, `api-client.md`, `mock-api.md`
  and `domain.md`
- **Append new decision entries** for: the tier-2 split, the deferred auth, the dummy-data-only phase, the
  trimmed primitive set, and the `client.ts` / `ApiError` fixes

**Done when:** no doc references `components/patterns`, and the decisions log records this phase.

---

## 8. Conventions

| Concern | Rule | Source |
|---|---|---|
| Routing | Next App Router, route groups per surface | design repo |
| Styling | Tailwind v4 semantic tokens. No hex, no arbitrary values. | design repo |
| Validation | **zod**, not eSewa's yup | design repo |
| Server state | **TanStack Query**, not eSewa's hand-rolled `useFetch` | design repo |
| HTTP transport | `fetch` wrapper, plus eSewa's error normalization and per-service base-URL discipline | both |
| Forms | react-hook-form + `zodResolver` + Radian `Form` | design repo |
| Global state | zustand for session only; Context only for request-scoped values | design repo |
| User feedback | `sonner` toasts, following eSewa's two-tier concept | eSewa concept, new code |
| Tests | vitest + Testing Library, starting at `lib/domain` | eSewa |
| File names | kebab-case; exports PascalCase; one component per file | design repo |
| Hooks | file `use-x.ts`, export `useX` | design repo |
| Route params | domain names — `[omsOrderId]`, never `[id]` | design repo |
| Indentation | tabs | design repo (19k LOC vs 0) |
| Copy | sentence case, active verbs ("Mark ready"). No ALL CAPS except sidebar section labels. | design repo |

### Patterns deliberately NOT copied from eSewa

| Pattern | Reason |
|---|---|
| `pages/` folder + React Router | Excluded by the brief; App Router replaces it |
| `useFetch` / `useInfiniteFetch` / `useMutation` | ~300 hand-rolled lines reimplementing TanStack Query, requiring memoized `params` **and** `deps` at every call site behind `eslint-disable exhaustive-deps` |
| yup | zod infers types better and is the design standard |
| SCSS, styled-components, `esewa-ui-library` | Tailwind tokens + Radian are the design source of truth |
| `useFormAlert` returning a `FormAlert` component | The component is defined inside the hook body, so it gets a new identity every render and remounts the alert |
| Scattered `sessionStorage.getItem('user')` + `JSON.parse` | Duplicated and untyped across two files; one typed session module instead |
| `window.location.href = '/'` inside an interceptor | Wrong for an embedded app — it would navigate the frame |
| `redirect()` called from `logout()` | React Router's `redirect()` only works in loaders and actions; in an event handler it silently does nothing |
| Giant page components | `dashboard` 607 LOC, `customers/details` 589, `credit/form` 428 — each mixing fetching, payload assembly, schemas and presentation |

---

## 9. Risks and open items

### 9.1 Nested chrome inside the Angular iframe

Embedded in the Fonepoints portal, the OMS sidebar sits beside the host's own navigation — two sets of
chrome, roughly 250px of duplicated width.

**Decision:** build the full standalone shell now. Design is the source of truth, and the rider-portal
shortcut lives in the sidebar.

**Mitigation:** keep **all** shell composition inside `src/app/(merchant)/layout.tsx`. If the host later
needs OMS chrome-less, that is one layout file changing, not a refactor. The design repo tried a dual
`?embed=1` mode and rejected it as not worth the complexity; a single layout swap buys the same flexibility
for free.

### 9.2 The rider portal cannot be embedded

`/deliver` has no login by design — the Order-ID-plus-voucher pair is the credential, and the 5-attempt
limit is the brute-force guard. A public no-login page cannot live inside the host's authenticated frame,
so the rider portal must stay reachable standalone even once the merchant side is embedded. That matches
the intended usage: the merchant sends riders the link.

### 9.3 Deferred, to pick up later

| Item | Blocked on |
|---|---|
| Real Providhy API behind `contracts.ts` | auth |
| `postMessage` protocol with the Angular host | agreement with that team |
| Whether both status lifecycles coexist | product confirmation |
| Which endpoints exist for rider assignment, voucher validation, activity log | API docs |
| Settings → Appearance, profile dialog | whether Settings becomes real |

### 9.4 Known defects in the design repo, fixed during the port

1. `lib/api/client.ts` hardcodes `/api/mock` and never reads `NEXT_PUBLIC_OMS_API_BASE`, although
   `.env.example`, `.claude/rules/api-client.md` and `docs/architecture.md` all say it does.
2. `ApiError` carries only `{message, status}`; its own rule file specifies `{code, message, status}`.
3. `sonner` is installed but never imported — there is no toast anywhere.

---

## 10. Checkpoints

| After | Reviewable outcome |
|---|---|
| Step 0–2 | `/backup-orders` works; tree restructured to `src/`; deps installed; `tsc:check` clean |
| Step 3–5 | Tokens, primitives and tier-2 components render in light and dark. Nothing OMS-specific yet. |
| Step 6 | Domain tests pass; `/api/mock/orders` serves seeded dummy orders |
| Step 7 | The shell: sidebar, header, placeholder pages, theme toggle, chrome-free `/deliver` |
| Step 8 | Full working OMS on dummy data — queue, detail, mark ready, rider validation, cross-tab sync |
| Step 9–10 | Lint enforces the architecture; tests pass; docs match the code |

Steps 0–2 are mechanical and run as one pass. Steps 3–8 are the real work, with review stops at 5, 7 and 8.
