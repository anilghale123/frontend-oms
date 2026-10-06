# OMS

Order Management System for Fonepoints orders. It adds the fulfillment lifecycle, rider handling,
voucher validation and an activity log on top of the Providhy Sales Order — it is not a separate
order engine.

Two surfaces:

- **Merchant** (`/orders`) — Order Queue and Order detail, in a sidebar dashboard. Runs embedded in
  the Fonepoints portal.
- **Rider** (`/deliver`) — a standalone mobile-first page with no login. The merchant sends riders
  the link; they enter the OMS Order ID and voucher number (or scan the QR) to confirm delivery.

> **This phase runs entirely on dummy data**, but the authentication is real. Orders come from the
> OMS backend (`oms-backend`, port 3001) scoped by a merchant access token the Fonepoints portal
> hands to the iframe. Every value on screen is still seed data, because the real Providhy Sales API
> is unreachable. See `docs/auth-handoff.md` and `omsImplementationPlan.md`.

## Getting started

OMS is one of four services. Started in this order, nothing needs configuring — every value has a
development default, and both backends default to the same placeholder API key:

| | Repo | Command | |
|---|---|---|---|
| 1 | `oms-backend` | `npm run dev` | `:3001` — issues tokens, owns the orders |
| 2 | `fonepoints-backend` | `npm run dev` | `:4000` — holds the OMS company API key |
| 3 | `oms-frontend` | `npm run dev` | `:3000` — this repo |
| 4 | `fonepoints-business` | `npm start` | `:4200` — the Angular portal that frames OMS |

Then either open `http://localhost:4200` and press **OMS** — the real path, through the handoff —
or open `http://localhost:3000/orders` directly, which uses the development mint
(`OMS_AUTH_MODE=dev`, refused in production).

To work on a screen with none of that running:

```bash
npm install
echo "NEXT_PUBLIC_OMS_API_BASE=/api/mock" > .env.local
npm run dev          # http://localhost:3000 — the in-repo mock, no session needed
```

| Script | What it does |
|---|---|
| `npm run dev` | Dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint, including the architecture and styling boundaries |
| `npm run tsc:check` | Type check |
| `npm run test:run` | Vitest once |
| `npm run test` | Vitest in watch mode |
| `npm run verify:handoff` | Walks the four-service auth chain and checks each link. Needs all four running. |
| `npm run format` | Prettier |

`lint`, `tsc:check` and `test:run` run on every commit via husky.

## Stack

Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 with CSS-variable tokens (no
`tailwind.config`), Radian UI primitives (Radix-based), TanStack Query and Table, react-hook-form
with zod, Lucide icons, sonner for toasts.

## Layout

```
src/components/ui/            Tier 1: Radian primitives. Generated — never hand-edit or fork.
src/components/layout/        Tier 2: screen structure + navigation
src/components/data-display/  Tier 2: tables, metrics, export
src/components/feedback/      Tier 2: empty, error, confirmation
src/features/                 Tier 3: orders, fulfillment, delivery-validation, shell
src/lib/domain/               Business rules. Pure TypeScript.
src/lib/api/                  client, contracts, endpoints, errors, query keys
src/lib/mock/                 in-memory db and seed
src/app/backup-orders/        Preserved first pass against the real API. Frozen.
```

Dependencies run one way: `app → features → components/{layout,data-display,feedback} →
components/ui → lib/utils`. ESLint enforces it.

## Docs

| File | What's in it |
|---|---|
| `AGENTS.md` | The rules, in short. Start here. |
| `.claude/rules/design-system.md` | Tokens, components, and a decisions log explaining why the UI looks the way it does. **Read before changing any UI.** |
| `docs/architecture.md` | Folder map and layer rules |
| `docs/auth-handoff.md` | The token handoff, the cookie, and the proxy. **Read before touching `src/app/api`, `src/lib/auth` or `src/providers`.** |
| `docs/deployment.md` | Deploying the demo: Vercel for the two frontends, one EC2 box for both backends, Atlas for MongoDB |
| `docs/domain-rules.md` | Status machine, validation, permissions |
| `docs/components.md` | Tier-2 components and their props |
| `docs/HANDOFF.md` | Developer entry point |
| `omsImplementationPlan.md` | How this was built, and what is deferred |

## The backend

`src/lib/api/client.ts` reads `NEXT_PUBLIC_OMS_API_BASE`, which defaults to `/api/oms` — this app's
own proxy. The proxy reads the access token from an httpOnly cookie **on the server** and forwards
to the OMS backend, so no screen holds a credential and every request a screen makes is
same-origin.

Request and response shapes live in `src/lib/api/contracts.ts` and are honoured by the backend and
the mock alike, so switching between them is a configuration change. The real Providhy Sales API is
the remaining step; the first pass against it is preserved unchanged at `/backup-orders`.
