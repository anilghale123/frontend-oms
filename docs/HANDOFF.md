# Fonepoints OMS — developer handoff

Start here. This page gives an overview and links to the detailed docs.

## 1. What it is
- An Order Management System for Fonepoints orders. It adds the fulfillment lifecycle, rider handling,
  voucher validation and an activity log on top of the Providhy Sales Order. It is not a separate order engine.
- **Frontend prototype with no real backend.** All data comes from an in-memory mock API
  (`src/app/api/mock`). Restarting the dev server resets it to the seed data.
- **Two surfaces:**
  - **Merchant** (`/orders`): sidebar dashboard with the Order Queue and Order detail pages. Home (`/`) and
    Settings (`/settings`) are placeholders.
  - **Rider** (`/deliver`): mobile-first delivery portal. The rider enters the Order ID and voucher (or scans
    a QR code) and confirms delivery. The merchant opens it from the sidebar ("Delivery portal") in a new tab.

## 2. Stack and running it
Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS v4 (tokens in `src/app/globals.css`, no
`tailwind.config`), Radian UI components (Radix-based), TanStack Query and Table, react-hook-form with zod,
and Lucide icons.

```bash
npm install
npm run dev            # http://localhost:3000
npm run lint           # also enforces the architecture and styling rules
npm run build
npm run format         # Prettier
```

> This Next.js version has breaking changes compared with older versions. Check
> `node_modules/next/dist/docs/` before relying on older APIs (see `AGENTS.md`).

## 3. Folder map (three component tiers)
```
src/components/ui/        Tier 1: Radian primitives (Button, Table, Select…). Added via the Radian CLI; don't fork.
src/components/layout/        Tier 2: screen structure + nav (Page, PageHeader, Panel, AppShell, NavMain)
src/components/data-display/  Tier 2: DataTable, StatTile, ExportMenu
src/components/feedback/      Tier 2: EmptyState, ErrorState, CopyButton
src/features/             Tier 3: OMS-specific code
  orders/                   components/queue (Order Queue), components/detail (Order detail),
                            StatusBadge, DetailField, hooks, api
  fulfillment/              Mark ready and Assign rider dialogs
  delivery-validation/      rider portal
  shell/                    MerchantShell, RiderShell
src/lib/domain/           business rules: status machine, types, validation messages
src/lib/api/              fetch client, contracts, query keys
src/lib/mock/             in-memory db and seed data
src/app/api/mock/         route handlers acting as the backend
src/config/nav.ts         sidebar items
```
Full map: `docs/architecture.md`.

## 4. Rules (ESLint enforces most of them)
1. **Tokens only.** No hex colors and no arbitrary Tailwind values (`text-[13px]`, `w-[240px]`).
   `eslint.boundaries.mjs` turns them into lint errors.
2. **Status logic lives in one place:** `src/lib/domain/status.ts` (transition table and labels).
   Never put status rules inside a page.
3. **Status colors come only from `StatusBadge`.** Don't pick badge colors per page.
4. **UI never imports `@/lib/mock`.** It goes through `@/lib/api` and the feature hooks, so switching to
   the real backend only touches the API layer.
5. **Import other features only through their `index.ts`** (`@/features/orders`, not deep paths).
6. **Reuse before building.** Check `docs/components.md` and `src/components/ui` first. New UI must fit
   one of the three tiers.
7. **Icons are Lucide only** (`lucide-react`). The only custom SVG is the Fonepoints logo in
   `src/components/icons`.
8. **Copy** is sentence case with active verbs ("Mark ready", "Assign rider"), never ALL CAPS.

## 5. Design basics
Full reference: `.claude/rules/design-system.md` (tokens, components, decisions log).
- **Spacing:** Tailwind default scale, 1 step = 4px. `gap-1`–`gap-2` inside components, `gap-3` between
  related blocks, `p-4`/`gap-4` for card padding and between sections. Prefer `gap-*` over margins.
- **Control sizes:** Radian controls take `size` = height in px (`28`–`48`), which sets their padding,
  font and icon size. Use 32 in toolbars and tables and 44/48 for rider touch targets. Don't add padding.
- **Colors:** semantic tokens such as `bg`, `fill1`, `fg`, `fg-secondary`, `border`, `primary-*`,
  `success-*`. Light and dark are both supported (press `D` to toggle). `brand` (Fonepoints red) is for
  the logo only, never status.
- **Cards:** `Panel` (`rounded-xl`, `ring-1 ring-border`, no shadow) with `PanelHeader` and `PanelContent` (`p-4`).
- **Type:** Geist Sans. `text-sm` is the default, `text-xs` for labels and hints, `text-base` for page titles.

## 6. Order status flow
```
Preparing → Ready for Delivery → Delivering → Delivered
                                      └──────→ Failed
```
- Merchant: **Mark ready** (with a confirmation dialog), then **Assign rider** (moves the order to Delivering).
- Rider: confirms with the order's voucher. **5 attempts per order** (`MAX_VALIDATION_ATTEMPTS`).
- Activity records every change. A CS override shows as "Status overridden from X to Y".
- Business rules in detail: `docs/domain-rules.md`.

## 7. Switched off for now (code kept, easy to turn back on)
| What | Where |
|---|---|
| **Assign rider** button disabled | queue row action and order detail next-step bar; remove `disabled` |
| **Failed orders hidden** from every list | `HIDE_FAILED` in `src/features/orders/hooks/use-orders.ts` |
| Failed and Delivering **status filters** | commented out in `OrderStatusTabs` and `OrderListPanel` |
| Queue **date filter, Show columns** | commented out in `OrderQueuePage` |
| **Row size, Full screen** | commented out in `DataTableCard` |
| Page-header **Export** | commented out in `OrderQueuePage` |

## 8. Prototype-only pieces (remove before production)
- `/api/mock/dev/voucher/[id]`: backdoor for the simulated QR scan.
- `/api/mock/dev/delivering` and the **Simulate delivery** button on the rider portal.
- The mock session always starts as Merchant A (`src/providers`), and there's no login.
- Tabs sync through `BroadcastChannel("oms-sync")` in `QueryProvider`. A real backend may replace this
  with server push.

## 9. Moving to the real backend
Replace the handlers in `src/app/api/mock/*`, or point `src/lib/api/client.ts` at the real API, and keep
the request and response shapes in `src/lib/api/contracts.ts`. Pages and components shouldn't need to change,
because UI only talks to `@/lib/api` through the feature hooks.

## 10. Docs to read
| File | What's in it |
|---|---|
| `.claude/rules/design-system.md` | Tokens, components, and a **decisions log** explaining why the UI looks the way it does. Read first. |
| `docs/architecture.md` | Folder map |
| `docs/components.md` | Pattern components and their props |
| `docs/domain-rules.md` | Status and validation rules |
| `docs/prd.md` | Product requirements |
| `docs/fonepoints-customer-side.md` | Where order data comes from (the customer redeem form) |
| `.claude/rules/*.md` | Per-area rules (API client, mock API, forms, merchant and rider portals) |

## 11. Not built yet
- Real backend, auth and login
- Toast notifications (no primitive yet; `CopyButton` uses a tooltip)
- Home and Settings pages (placeholders)
