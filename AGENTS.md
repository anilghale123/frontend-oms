<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# OMS

Order Management System for Fonepoints orders: the fulfillment lifecycle, rider handling, voucher
validation and an activity log on top of the Providhy Sales Order. Merchants reach it embedded in
the Fonepoints portal; riders open a standalone link the merchant sends them.

**This phase runs entirely on dummy data**, but the authentication is real. OMS is one of four
services: the Angular portal frames it, the Fonepoints backend holds the OMS company API key, and
the OMS backend issues the merchant access token and owns the orders. The merchant's token arrives
over `postMessage`, is traded for an httpOnly cookie, and is attached server-side by the
`/api/oms/*` proxy — so no screen holds a credential and the order list is scoped by the token
rather than by a query string. **Read `docs/auth-handoff.md` before touching anything under
`src/app/api`, `src/lib/auth` or `src/providers`.** (`auth.md` at the repo root describes an
earlier two-token design and is superseded; `docs/newAuth.md` is the brief.)

The real Providhy API is still unreachable, so every value on screen is seed data — now served by
the OMS backend rather than the in-repo mock. The mock at `src/app/api/mock` was kept: set
`NEXT_PUBLIC_OMS_API_BASE=/api/mock` and the app runs with no backends at all, which is the
quickest way to work on a screen. Read `omsImplementationPlan.md` for scope and what is deferred.

## Where things live

```
src/components/ui/            Tier 1: Radian primitives. Generated — never hand-edit or fork.
src/components/layout/        Tier 2: screen structure + navigation (Page, Panel, AppShell, Nav*)
src/components/data-display/  Tier 2: DataTable, StatTile, ExportMenu
src/components/feedback/      Tier 2: EmptyState, ErrorState, CopyButton
src/features/                 Tier 3: OMS-specific (orders, fulfillment, delivery-validation, shell)
src/lib/domain/               Business rules. Pure TypeScript — no React, no fetch.
src/lib/api/                  client, contracts, endpoints, errors, query keys
src/lib/auth/                 session shapes + the in-memory token fallback. No React.
src/lib/host/                 the postMessage protocol and channel to the portal
src/lib/mock/                 in-memory db and seed (the optional no-backend fallback)
src/app/api/session/          token → httpOnly cookie. The cookie's flags live here.
src/app/api/oms/              the proxy: reads the cookie, attaches the Bearer
src/providers/                QueryProvider, HostChannelProvider, AuthProvider, HostSync
src/config/server-env.ts      server-only values, behind `import "server-only"`
src/app/backup-orders/        Preserved spike against the real API. Frozen; exempt from lint.
```

Full map: `docs/architecture.md`. Authentication and the iframe handoff:
`docs/auth-handoff.md`. Design tokens and the decisions log:
`.claude/rules/design-system.md` — **read it before changing any UI.**

## Rules (ESLint enforces most)

1. `app → features → components/{layout,data-display,feedback} → components/ui → lib/utils`.
   Never the reverse. Sibling tier-2 imports are fine.
2. **Tokens only.** No hex colors, no arbitrary Tailwind values (`text-[13px]`, `w-[240px]`).
3. **UI never imports `@/lib/mock`.** It goes through `@/lib/api` and the feature hooks.
4. **Import other features through their `index.ts`**, never a deep path.
5. **Status rules live in `src/lib/domain/status.ts`**, never inside a page. Status colors come
   only from `StatusBadge`.
6. Components never call `fetch`: component → hook (TanStack Query) → `api.ts` → `lib/api/client`.
   The one exception is `AuthProvider`, which calls `/api/session` directly — a boot sequence
   coupled to `postMessage` timing, not a data query (`docs/auth-handoff.md`).
7. Forms: react-hook-form + `zodResolver`, schema in the feature's `schema.ts`.
8. Icons are Lucide only. Copy is sentence case with active verbs ("Mark ready").

## Checks

```bash
npm run dev          # http://localhost:3000
npm run lint         # also enforces the architecture and styling rules
npm run tsc:check
npm run test:run
npm run format
npm run verify:handoff   # the four-service auth chain, end to end. Needs all four running.
```

`lint`, `tsc:check` and `test:run` all run on pre-commit (husky).
