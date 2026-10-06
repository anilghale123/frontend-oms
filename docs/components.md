# Components

Three tiers. Every piece of UI fits exactly one of them.

| Tier | Folder | What goes there |
|---|---|---|
| 1. Primitives | `src/components/ui` | Radian components, added with `npx radianui@latest add <name>`. Never hand-written. |
| 2. Shared components | `src/components/layout`, `src/components/data-display`, `src/components/feedback` | Domain-agnostic compositions of primitives and tokens, split by purpose. Data only through props. |
| 3. Features | `src/features/*` | OMS-specific components (orders, shells, rider validation…). |

Decision order: a Radian component exists → use it. Otherwise compose a pattern. Build
something custom only if neither fits, and say so explicitly.

Every pattern has typed props with JSDoc and an entry below. Import from the
each folder's own barrel: `import { Page, PageBody } from "@/components/layout"`,
`import { DataTableCard } from "@/components/data-display"`,
`import { EmptyState } from "@/components/feedback"`.

Sibling tier-2 imports are allowed — they share the same constraints, and the split creates real
ones (`data-display/data-table` renders `feedback`'s empty and error states). `IconComponent`,
needed by all three, lives at `@/components/types`.

---

## Page structure

### `Page` + `PageBody`
Outer frame of every screen: page padding, a `PageHeader`, then the body.
**Use** on every route. Take `title` from the route in `src/config/nav.ts`.
**Title only:** no subtext or explanation line under the title, on any page. Put record
details (customer, IDs) in the page body instead.

| Prop | Type | Notes |
|---|---|---|
| `title` | `ReactNode` | Required. Rendered as the page's `h1`. |
| `count` | `number` | Count chip after the title. |
| `badge` | `ReactNode` | Element after the title, e.g. a status badge. |
| `actions` | `ReactNode` | Right-aligned buttons. |
| `children` | `ReactNode` | Usually one `<PageBody>`. |

`PageBody` is a vertical stack (`gap-4`) that fills the remaining height. Props: `children`, `className`.

### `PageHeader`
The title row used by `Page`. Use on its own only for a sub-section that needs the same
layout. Props: the same as `Page` minus `children`, plus `className`.

---

## Shells and navigation

### `AppShell`
Desktop frame following Radian block sidebar-04: fixed viewport height (`h-svh`), inset
sidebar, borderless top bar, and page content in a rounded `bg-fill1` card that scrolls on its own.
**Use** for the merchant surface.

| Prop | Type | Notes |
|---|---|---|
| `sidebar` | `ReactNode` | Usually `AppSidebar`. Required. |
| `header` | `ReactNode` | Required. Usually `AppHeader`. |
| `children` | `ReactNode` | Page content. |
| `defaultOpen` | `boolean` | Whether the sidebar starts expanded on desktop. Default `true`. |
| `defaultWidth` | `string` | Initial sidebar width. Default `15rem` (a little narrower than Radian's `16.25rem`). |

### `AppSidebar`
Inset sidebar following Radian block sidebar-04: workspace row, nav sections (labeled ones
get an uppercase `SidebarGroupLabel`), optional footer. Collapses to icons; the only toggle is
the `SidebarTrigger` in the top bar. Renders inside `AppShell`.

| Prop | Type | Notes |
|---|---|---|
| `brand` | `{ name, subtitle?, href }` | Top link via `WorkspaceHeader`. |
| `sections` | `NavSection[]` | Nav sections, top to bottom. Use `merchantNav` from the nav config. |
| `footer` | `ReactNode` | Bottom slot, e.g. `SidebarProfile` for the merchant. |
| `theme` | Radian sidebar theme | Default `gray-body`. |

### `SidebarProfile`
Sidebar footer row (Meat-Management shop row): 32px square logo (initials when no logo), name,
and a muted second line. Collapsed, only the logo shows and the text moves into a tooltip.
Props: `name`, `detail?` (e.g. location), `logoUrl?`. The merchant surface fills it from
`MOCK_MERCHANTS` in `src/config/constants.ts`.

### `WorkspaceHeader`
Sidebar brand row: the Fonepoints wordmark (`FonepointsLogo`) plus a short product name such as
"OMS". Collapsed to icons, only the square `FonepointsMark` shows. Props: `label` (full name,
used as the link's accessible name), `product?`, `href`, `className`.

### `FonepointsLogo` / `FonepointsMark`
In `src/components/icons/fonepoints-logo.tsx`. The official wordmark, traced to SVG from
`public/brand/fonepoints-logo.png`. "fone" and the star use the `brand` token; "points" uses
`currentColor`, so set a text color (`text-fg`, `text-sidebar-fg`) and it works in dark mode.
Size by height (`h-5 w-auto`). `FonepointsMark` is the "f" on a brand-red rounded tile, for
collapsed sidebars and the favicon (`src/app/icon.svg`). The `brand` color is for the logo
only, never for UI state.

### `AppHeader`
Sticky top bar. Layout only; contents come through slots.

| Prop | Type | Notes |
|---|---|---|
| `leading` | `ReactNode` | Sidebar trigger + breadcrumbs, or `NavTabs`. |
| `actions` | `ReactNode` | Right side. |
| `variant` | `"default" \| "inset"` | `inset` is the borderless bar above the content card in `AppShell`. `default` is a bordered 56px bar. |

### `AppearanceSync`
Mounted once in the root layout. Applies the saved appearance (and follows system dark mode),
and owns the global **`D`** shortcut that switches light/dark via `toggleDarkMode()` from
`@/lib/appearance`. The shortcut is ignored while typing, inside menus, and while Settings is
previewing a draft. There is no theme icon in the header; the user menu has "Switch theme" (D).

### `NavMain`
Sidebar link list (size 32, neutral). The active item follows the pathname; when the
sidebar is collapsed, the label shows as a tooltip. Renders inside a Radian `Sidebar`. An item with `newTab` opens in a new browser tab
(`target="_blank"`, trailing `ArrowUpRight` glyph, "opens in a new tab" for screen readers) and is
never shown as active; use it for links to another surface, such as the delivery portal.
Props: `items: NavLinkItem[]`.

### `NavTabs`
Underline tabs where each tab is a link, and the active tab follows the pathname.
**Use** for switching between sibling routes inside a page.
Props: `items: NavLinkItem[]`, `label` (accessible name), `className`.

### `NavBreadcrumbs`
A breadcrumb trail. Entries without `href` render as the current page.
Props: `items: { label, href? }[]`, `className`. Build `items` with `buildBreadcrumbs()` from
`@/lib/nav/match`, never by hand.

### `MobileShell`
A mobile-first frame for single-task flows: a compact top bar and one centered column,
designed at 360px and capped at `max-w-md`. No sidebar. **Use** for the rider portal.

| Prop | Type | Notes |
|---|---|---|
| `title` | `ReactNode` | Shown in the top bar. |
| `leading` | `ReactNode` | Before the title, e.g. a logo tile. |
| `actions` | `ReactNode` | Right side of the top bar. |
| `children` | `ReactNode` | The single column. |

### `NavLinkItem` (type)
`{ label: string; href: string; icon?: IconComponent; newTab?: boolean }`. Nav icons are Lucide
(`lucide-react`), Radian UI's icon library.

### `NavSection` (type)
`{ label?: string; items: NavEntry[] }`. One sidebar group. Omit `label` for the unlabeled
top section.

---

## States

### `EmptyState`
Placeholder for a view with nothing to show. Built on Radian `Empty`.
**Use** for empty lists and for pages that aren't built yet.

| Prop | Type | Notes |
|---|---|---|
| `icon` | `IconComponent` | In a tinted tile above the title. |
| `title` | `ReactNode` | Required. |
| `description` | `ReactNode` | What would be here, and how to get it there. |
| `action` | `ReactNode` | Optional call to action. |
| `variant` | `"bordered" \| "plain"` | Default `bordered` (dashed outline). Use `plain` inside tables and cards. |

### `ErrorState`
Shown when a data view fails to load. Built on Radian `Empty` with error tokens and `role="alert"`.

| Prop | Type | Notes |
|---|---|---|
| `title` | `ReactNode` | Default "Something went wrong". |
| `description` | `ReactNode` | What happened and what to do next. |
| `onRetry` | `() => void` | Shows "Try again". Pass it from client components only. |
| `retrying` | `boolean` | Puts the retry button in its loading state. |

Loading states use Radian `Skeleton` directly; `DataTable` has its own skeleton rows.

---

## Data display

### `StatTile` + `StatTileGrid`
One key number with a label, an optional icon and a delta badge. Built on Radian `Card` + `Badge`.
`StatTileGrid` lays tiles out in 1, 2 or 4 columns depending on screen width.

| Prop | Type | Notes |
|---|---|---|
| `label` | `string` | What is counted. |
| `value` | `ReactNode` | Already formatted. |
| `icon` | `IconComponent` | Top-right. |
| `delta` | `string` | Short change note. |
| `tone` | `"success" \| "warning" \| "error" \| "info" \| "neutral"` | Delta badge color. |

### `Panel` + `PanelTitle` + `PanelHint`
Bordered content surface matching DataTable cards (`rounded-xl bg-bg ring-1 ring-border`).
**Use** for detail sections (order summary, rider, activity). Not for forms that already
live in a Dialog.

| Prop | Type | Notes |
|---|---|---|
| `children` | `ReactNode` | Required. |
| `flush` | `boolean` | Drops the built-in padding and gap so `PanelHeader` / `PanelContent` or a full-width table set their own spacing. Default `false`. |
| `className` | `string` | Optional. |

`PanelTitle` is a small section heading; `PanelHint` is secondary helper text.

**Header anatomy (`flush`):** `PanelHeader` is the title row: `children` (usually a
`PanelTitle`) on the left, an optional `action` node (count, meta or button) on the right,
and a divider below. `PanelContent` is the padded body. Tables inside a panel run full width
(no inner bordered box).
Order detail is built from separate headed panels (`Panel flush` + `PanelHeader` +
`PanelContent`) arranged in rows; see `OrderDetailPage`.

### `DataTableCard` and `DataTable`
The table card, following the Meat-Management list pattern:
- **Toolbar:** optional leading content on the left (e.g. status tabs). On the right: search, one filter, then a compact **icon group**: **Show columns** (`Columns3`), **Row size** (`Rows3`, five densities), and **Full screen** (`Maximize2`/`Minimize2`; Escape exits).
- **Body:** sortable headers that stick while rows scroll, rows, and pagination.
- **States:** built-in loading, empty and error states.

It's built on TanStack Table v8 and Radian `Table`, `Input`, `Select`, `Skeleton`, `Button` and `DropdownMenu`. Filtering is client-side only.

**Page-level actions such as Export go in `Page actions` / `PageHeader actions`, not in the toolbar** (the same place as Meat-Management's "Print queue tokens" and "New order").
- **When a page action needs the table** (export reads its filtered rows and visible columns): create it with `useDataTable` and render `DataTableCard table={table}`. See `OrderQueuePage`.
- **When nothing outside needs the table:** use `DataTable`. It takes the `useDataTable` options (`data`, `columns`, `pageSize`, `initialSorting`, `getRowId`, `initialColumnVisibility`) plus every `DataTableCard` prop.

`DataTableCard` props:

| Prop | Type | Notes |
|---|---|---|
| `table` | `Table<TData>` | Required. From `useDataTable`. |
| `searchPlaceholder` | `string` | Shows the search box. |
| `filter` | `{ columnId, allLabel, options }` | A single-select column filter. |
| `toolbarLeading` | `ReactNode` | Left side of the toolbar. |
| `columnToggle` | `boolean` | Shows the **Show columns** icon button. It looks pressed while any column is hidden. |
| `initialRowSize` | `"xs" | "sm" | "md" | "lg" | "xl"` | Starting density. Default `md`. |
| `allowFullscreen` | `boolean` | Shows the **Full screen** button. Default `true`. |
| `toolbarActions` | `ReactNode` | Extra toolbar controls after the icon group. Use rarely; prefer `Page actions`. |
| `pageSizes` | `number[]` | Rows-per-page choices. Default `[10, 20, 50]`. |
| `loading` | `boolean` | Shows skeleton rows. |
| `error` | `{ title?, description? } | null` | Replaces the rows with an `ErrorState`. |
| `onRetry` | `() => void` | Retry button inside the error state. |
| `empty` | `EmptyState` props | Shown when no rows match. |
| `onRowClick` | `(row) => void` | Makes rows clickable and focusable; Enter activates the row. Clicks on buttons, links and menu items (including portaled dropdowns) are ignored. |

Column `meta`:
- `className`: classes for the header and cells.
- `label`: the name used in Show columns and as the export header.
- `export`: the export spec; see `tableToExport`.

`enableHiding: false` keeps a column out of Show columns.

Building blocks for custom layouts, e.g. server-side paging:
- `useDataTable`: options `data`, `columns`, `pageSize`, `initialSorting`, `getRowId`, `initialColumnVisibility`.
- `DataTableView`: adds `rowSize` and `className` (use `flex-1` to fill a full-screen card).
- `DataTableToolbar`: its `columnToggle`, `rowSize`/`onRowSizeChange` and `isFullscreen`/`onToggleFullscreen` props switch on the icon group.
- `DataTablePagination`: Radian's table pagination. It has "Rows per page" (label hidden below `sm`) with a size 32 `Select`, the range ("1–10 of 208") aligned right, and first, previous, next and last outline `IconButton`s inside the Radian `Pagination` primitive. Props: `table`, `pageSizes`.
- `DataTableColumnHeader`: use it as `header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />`.
- `DataTableViewOptions`: the Show columns icon button and menu (a checkbox per hideable column, plus "Show all columns"). Props: `table`.
- `DataTableRowSizeMenu`: the Row size icon button and menu. Props: `value`, `onValueChange`. The sizes are in `DATA_TABLE_ROW_SIZES`.
- `useDataTableFullscreen()` and `dataTableFullscreenClassName(isFullscreen)`: full-screen state (Escape exits, page scroll locked) and the fixed-inset classes.
- `tableToExport(table)`: turns the filtered and sorted rows (all pages) and the visible columns into `{ headers, rows }`. A column's `meta.export` (`{ label, value(row) }[]`) overrides its default output. Several entries split one column; `[]` skips it.

### `ExportMenu`
"Export" button with **Export as CSV** and **Export as Excel** options. **Use** in `Page actions` (page header), not in the table toolbar. The caller builds the file, usually with `exportTable(tableToExport(table), format, basename)` from `@/lib/utils/export`, which writes RFC 4180 CSV (with BOM) or a real `.xlsx` without extra dependencies.

| Prop | Type | Notes |
|---|---|---|
| `onExport` | `(format: "csv" | "xlsx") => void` | Required. |
| `summary` | `string` | Menu header, e.g. "248 orders". |
| `disabled` | `boolean` | Disable when there is nothing to export. |
