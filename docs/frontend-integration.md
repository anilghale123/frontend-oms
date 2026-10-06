# Frontend integration guide — iframe, auth, session, tokens

> Read from the codebase on 2026-10-06. Companion to [auth.md](../auth.md), which is the
> authoritative spec for the auth phase; this file is the frontend-side orientation for it and
> covers what is **built** today alongside what is **designed**.
>
> Scope: frontend only. Backend contracts are summarised where the frontend depends on them, and
> specified in full in `auth.md` §4–§6.

---

## The one thing to know first

Two different concerns share **one** postMessage channel, and they are at very different stages:

| Concern | Status |
|---|---|
| **Theme sync** (host pushes light/dark + accent) | **Built, wired, verified 14/14 in a real browser** |
| **Auth / tokens** (handoff → session → bearer) | **Designed only.** Message types are declared, no handler, no `src/lib/auth/`, no `AuthProvider` |

So today there is **no login, no token, no `Authorization` header anywhere** in the live app.
What stands in for a session is a fake role in `localStorage`. [auth.md](../auth.md) is the spec
for the real thing; its status line says so plainly.

This guide covers what exists first, then the designed flow, and marks every boundary.

---

## 1. The four surfaces

| Route | Shell | Auth | Framable |
|---|---|---|---|
| [src/app/(merchant)/](<../src/app/(merchant)/>) | Full sidebar + header | designed: gated | no (`'self'`) |
| [src/app/embed/](../src/app/embed/) | **None** — portal supplies chrome | designed: gated | **yes**, from allowlist |
| [src/app/(rider)/deliver](<../src/app/(rider)/deliver/page.tsx>) | Minimal | **never** — rider has no account | no |
| [src/app/backup-orders/](../src/app/backup-orders/) | Frozen spike vs real Providhy API | its own `TokenProvider` | no |

`/embed` and `(merchant)` render the **same** feature components. The only difference is the
layout file: [src/app/embed/layout.tsx](../src/app/embed/layout.tsx) renders no `AppShell`, adds
`HostSync`, and wraps children in `OrderRoutesProvider basePath="/embed"` so internal links stay
inside the iframe instead of jumping the merchant out to the standalone dashboard.

---

## 2. Iframe communication — BUILT

### 2.1 Files and what each owns

| File | Responsibility |
|---|---|
| [src/lib/host/messages.ts](../src/lib/host/messages.ts) | The protocol: `PROTOCOL_VERSION`, the two message unions, type guards. No transport. |
| [src/lib/host/channel.ts](../src/lib/host/channel.ts) | The transport: origin-validated listener, `send`, `on`, announces `oms.ready`. No React. |
| [src/providers/HostSync.tsx](../src/providers/HostSync.tsx) | React glue: opens the channel, subscribes `host.theme`, applies it. Renders `null`. |
| [src/app/embed/layout.tsx](../src/app/embed/layout.tsx) | Mounts `HostSync` — **only** on `/embed`. |
| [next.config.ts](../next.config.ts) | `frame-ancestors` CSP. Without this the browser refuses to frame OMS at all. |
| [src/config/env.ts](../src/config/env.ts) | `EMBED_HOST_ORIGINS` — the runtime allowlist. |

### 2.2 The envelope

Every message is `{ source, v, type, ...payload }`:

```ts
PROTOCOL_VERSION = 1
OMS_SOURCE  = "fonepoints-oms"    // what OMS sends
HOST_SOURCE = "fonepoints-host"   // what OMS accepts
```

A receiver **drops** anything whose `source`/`v` it does not recognise. That is what lets either
side ship `v: 2` without breaking the other.

### 2.3 The three validation axes — all required

In `channel.ts`:

```ts
if (!allowedOrigins.includes(event.origin)) return;  // 1. who sent it
if (event.source !== window.parent) return;          // 2. is it actually our parent
if (!isHostMessage(event.data)) return;              // 3. is it our protocol
```

This is not defensive decoration. Next's HMR client, React DevTools and browser extensions
**all** post messages to this window — the envelope check alone stops the handlers firing on that
noise. Drop any one of the three and the channel becomes an injection point.

### 2.4 The child drives the handshake

The parent **cannot** know when the OMS bundle parsed and attached its listener, so the portal
never speaks first. Sequence:

```
OMS mounts → channel.start() attaches listener → send({ type: "oms.ready" })
                                                      ↓
                                      portal answers with current theme
```

Note the order in `HostSync.tsx`: subscribe **then** `start()`. Announcing before subscribing
would let the reply arrive with nobody listening.

**`oms.ready` fires again after every reload**, including HMR. The portal must re-answer every
time, not once per session. That is the invariant the auth handoff depends on, because a handoff
token is single-use and must be freshly minted per `oms.ready`.

### 2.5 The `parentOrigin` trick

Before the host has spoken, OMS does not know which origin holds the frame. So `channel.ts` posts
`oms.ready` to **each candidate origin separately** in a try/catch — a mismatched target throws
rather than delivering. Once the first validated message arrives, `parentOrigin` is recorded and
every later reply targets that exact origin. Never `"*"`: a wildcard hands the message to
whatever origin happens to occupy the frame.

### 2.6 Message tables

**OMS → host** (`source: "fonepoints-oms"`):

| `type` | Payload | Wired? |
|---|---|---|
| `oms.ready` | — | **yes** |
| `oms.route.changed` | `{ path, title }` | declared, not sent |
| `oms.auth.ok` | `{ merchantId }` | declared, not sent |
| `oms.auth.failed` | `{ reason }` | declared, not sent |
| `oms.auth.renew` | — | declared, not sent |

**Host → OMS** (`source: "fonepoints-host"`):

| `type` | Payload | Wired? |
|---|---|---|
| `host.theme` | `{ mode, accent? }` | **yes** |
| `host.route.request` | `{ path }` | declared, no handler |
| `host.auth.grant` | `{ token, expiresAt }` | declared, no handler |
| `host.auth.denied` | `{ reason }` | declared, no handler |

The auth types were declared up front deliberately — when auth lands it **adds handlers to this
channel**, it does not open a second one.

### 2.7 Handshake invariants

- **The child drives.** The parent never sends first; it answers `oms.ready`.
- **The parent never caches the grant.** One `oms.ready`, one mint. A cached handoff token is
  rejected as a replay on second use, which looks exactly like a broken integration.
- **`host.route.request` is validated** against known OMS routes before `router.push`. The host
  is trusted-ish, but a path arriving from another window is still input.
- **`oms.route.changed` carries no order data** — only path and page title. The host does not
  need, and should not receive, customer or order detail.

Reserved but not implemented: `oms.height { px }` (the portal gives OMS 100% height) and
`host.ping` / `oms.pong` (liveness). Named so neither side invents a conflicting meaning.

---

## 3. Theme sync — the one live feature on the channel

While embedded, **the host owns the appearance.** OMS has its own full appearance system
([src/lib/appearance.ts](../src/lib/appearance.ts): mode, 19 accents, 3 fonts, `localStorage`,
applied pre-paint). Three rules stop the two systems fighting.

**Rule 1 — apply transiently.** [HostSync.tsx](../src/providers/HostSync.tsx) calls
`applyAppearance()`, **never** `saveAppearance()`. Persisting the host's theme would make it
stick next time the merchant opens OMS standalone, and would fire a change event for something
the user never did. Note it reads `loadAppearance()` first so the merchant's **font** survives —
the host has no opinion on font, only mode and accent.

**Rule 2 — `AppearanceSync` stands down.** This is the one that actually bit. The root layout's
[AppearanceSync](../src/components/layout/appearance-sync.tsx) applies stored appearance on
mount, and its effect runs *before* anything inside `/embed` — so it overwrote the theme the host
had already put in the document, and the global `D` shortcut fought the next `host.theme`
message.

The fix is `hostOwnsAppearance()` in `src/lib/appearance.ts`:

```ts
return window.parent !== window && window.location.pathname.startsWith(EMBED_BASE_PATH);
```

A **function of the environment**, not a flag one component sets for another — precisely because
there is no mount order in which such a flag would be set early enough. Both the mount apply and
the `D` shortcut check it.

**Rule 3 — Settings → Appearance is hidden on `/embed/*`.** A control the next host message
overwrites is worse than no control.

**First paint.** The host's theme cannot arrive until after OMS paints, so a dark portal would
flash light. The portal appends `#theme=dark&accent=emerald` to the iframe `src`, and
`APPEARANCE_BOOT_SCRIPT` reads it before paint. A **fragment**, not a query string — fragments
never reach a server log or `Referer` header. It is a hint only; the message that follows is
authoritative, and it is used for the initial `src` only, so a theme change never reloads the
frame.

**Unknown accent is ignored, not guessed** (`asAppearanceTheme` in `messages.ts`). The accent is
an opaque string on the wire, so the two apps deploy independently.

**Brand is not accent.** The portal keeps `--fp-brand` (Fonepoints red) for the wordmark and
merchant tile, separate from `--fp-accent`. Picking an accent must not recolour the logo.

---

## 4. The auth flow — what happens when the merchant presses "OMS"

**Designed, not built.** Here is the full sequence with who does what.

```
1. Merchant already signed in to the Fonepoints portal, clicks "OMS"
                    │
2. PORTAL  → POST /oms/handoff  (authenticated by the portal session)
   FONEPOINTS BACKEND mints a handoff JWT, signed with the secret it
   shares with the OMS backend.  90 seconds. Single use.
                    │
3. PORTAL  renders <iframe src="https://oms…/embed/orders#theme=dark">
   ── the token is NOT in the URL ──
                    │
4. OMS FRONTEND mounts → phase "connecting" → renders a small spinner
   and nothing else → posts  oms.ready
                    │
5. PORTAL replies  host.auth.grant { token, expiresAt }  → exact OMS origin
                    │
6. OMS FRONTEND  phase "exchanging" → POST /auth/session { handoffToken }
                    │
7. OMS BACKEND verifies signature, exp (±60s skew), iss, aud, jti single-use
   → returns { accessToken, refreshToken, merchant, user, permissions }
                    │
8. OMS FRONTEND holds it IN MEMORY, installs the refresher,
   schedules refresh at expiresAt − 60s, posts oms.auth.ok,
   phase "ready" → renders the order queue.
```

**The merchant never sees a form.** There is no login page, no login route, nothing to redirect
to.

### 4.1 Why two tokens

Conflating these is the main way the design goes wrong.

| | **Handoff token** | **OMS session token** |
|---|---|---|
| Minted by | Fonepoints backend | OMS backend |
| Signed with | the shared secret | OMS's own session key |
| Purpose | prove "this browser is merchant X" | authorize OMS API calls |
| Lifetime | **90 seconds** | 15 min access + 8 h refresh |
| Uses | **exactly one** (`jti` replay set) | many |
| Crosses the iframe | **yes**, by postMessage | **no** — minted inside OMS |
| Sent to OMS API | once, in the `/auth/session` body | every call, as `Bearer` |
| Stored | nowhere; consumed on arrival | **memory only** |

The handoff token is the only thing crossing two origins, so it is short-lived and single-use. If
it leaks it is worthless within 90 seconds and after one use. The session token never leaves OMS.

### 4.2 The frontend's responsibilities

| # | Responsibility |
|---|---|
| F1 | Run the child side of the handshake; validate `event.origin` and `event.source` on every message. |
| F2 | Exchange the handoff token (`POST /auth/session`) and hold the result **in memory only**. |
| F3 | Attach `Authorization: Bearer` in `lib/api/client.ts` **and nowhere else**. |
| F4 | Refresh proactively before expiry, and on a `401` refresh once and retry — **single-flight**. |
| F5 | When refresh fails, ask the host for a new grant (`oms.auth.renew`). Never redirect, never show a login form. |
| F6 | Gate the merchant and embedded surfaces on a live session; render boot and failure states. |
| F7 | Keep `/deliver` (rider) and `/api/mock/*` unauthenticated. |
| F8 | Stop sending identity in bodies and query strings — no `merchantId`, no `actor`, no `actorRole`. |
| F9 | Apply the host's theme while embedded, and do not persist it. |
| F10 | Report route changes to the host; accept the host's deep links. |
| F11 | Ship the dummy issuer so all of the above runs locally with no backend. |

### 4.3 The functions the frontend will call

| Function | Lives in | Does |
|---|---|---|
| `bridge.requestGrant(signal)` | `lib/auth/host-bridge.ts` | posts `oms.ready`, resolves with the first grant, rejects after `GRANT_TIMEOUT_MS = 8000` |
| `exchangeHandoff(token)` | `lib/api/auth.ts` | `POST /auth/session` |
| `setSession(next)` | `lib/auth/session-store.ts` | plain module variable — **no React**, so `client.ts` can read it without an import cycle |
| `getAccessToken()` | same | read by `client.ts` on every request |
| `refreshSession()` | same | **single-flight** refresh |
| `bridge.renew()` | `host-bridge.ts` | asks the host for a fresh grant when the refresh chain is exhausted |

### 4.4 The host bridge — one interface, two implementations

This is the seam that makes the dummy layer disposable. `AuthProvider` never learns which one it
got.

```ts
export interface HostBridge {
  requestGrant(signal: AbortSignal): Promise<Grant>;
  renew(signal: AbortSignal): Promise<Grant>;
  onTheme(cb: (theme: { mode: "light" | "dark"; accent?: string }) => void): () => void;
  onRouteRequest(cb: (path: string) => void): () => void;
  notify(message: OmsToHost): void;
}

export const GRANT_TIMEOUT_MS = 8_000;
```

### 4.5 Single-flight refresh — why it matters

A page with 4 parallel queries gets 4 simultaneous 401s. Without single-flight that is 4 refresh
calls, and with rotating refresh tokens 3 of them fail and kill the session:

```ts
export function refreshSession(): Promise<Session | null> {
  if (refreshing) return refreshing;   // ← later callers await the SAME promise
  const token = session?.refreshToken;
  if (!token || !refresher) return Promise.resolve(null);

  refreshing = refresher(token)
    .then((next) => { session = next; return next; })
    .catch(() => { session = null; onLost?.(); return null; })
    .finally(() => { refreshing = null; });

  return refreshing;
}
```

`onLost` is where `AuthProvider` calls `bridge.renew()`. **The recovery path is always the host**
— which is exactly why OMS needs no login form.

### 4.6 AuthProvider sequence

```ts
export type AuthPhase = "connecting" | "exchanging" | "ready" | "failed";
```

1. `phase = "connecting"` → `bridge.requestGrant()`.
2. On a grant: `phase = "exchanging"` → `exchangeHandoff(token)`.
3. On success: `setSession()`, install the refresher and lost-session callback, schedule a
   proactive refresh at `expiresAt − 60s`, `notify({ type: "oms.auth.ok" })`, `phase = "ready"`.
4. On failure: map `ApiError.code` to an `AuthFailureReason`,
   `notify({ type: "oms.auth.failed", reason })`, `phase = "failed"`.
5. `retry()` restarts at step 1 with a fresh `AbortController`.

It mounts **inside** `QueryProvider` (so a refresh can invalidate queries) and **replaces**
`SessionProvider`.

### 4.7 The boot and failure states

`AuthGate` renders children only at `phase === "ready"`. Everything else is a centered panel
built from existing components (`ErrorState` from `@/components/feedback` + `Spinner` from
`@/components/ui`), no new ones.

| Phase / reason | Copy | Action |
|---|---|---|
| `connecting` | "Connecting to Fonepoints…" | — |
| `exchanging` | "Signing you in…" | — |
| `grant_timeout` | "Couldn't connect to the Fonepoints portal." | Try again |
| `grant_denied` | "The portal couldn't start an OMS session." | Try again |
| `grant_rejected` | "Your session has expired. Reopen OMS from the portal." | Try again |
| `not_entitled` | "This account doesn't have access to OMS." | terminal |
| `merchant_inactive` | "This merchant account is inactive." | terminal |
| `no_host` | "Open OMS from the Fonepoints portal." | terminal |
| `unreachable` | "Couldn't reach OMS. Check your connection." | Try again |

Two design notes: the copy **never** names a token, claim or HTTP code (no diagnostic leakage),
and `connecting`/`exchanging` must be **visually quiet** — the merchant already saw the portal's
spinner, so a second large one reads as a failure. Small centered spinner on `bg-fill1`, no card,
no logo.

### 4.8 Route matrix

Authentication is not global. `AuthGate` is mounted per route group.

| Route | Gated | Why |
|---|---|---|
| `/embed/*` | **yes** | the embedded surface — the host supplies the grant |
| `/(merchant)/*` | **yes** | the standalone dashboard; fails with `no_host` outside an iframe |
| `/(rider)/deliver` | **no** | the rider has no account; the 5-attempt limit is the brute-force guard |
| `/api/mock/*` | **no** | the mock *is* the auth server |
| `/backup-orders/*` | **no** | frozen spike with its own `TokenProvider` |

The standalone dashboard stays gated rather than being made public in dev: a surface that
silently works without a session is how identity assumptions leak back into the UI. In local
development `AUTH_MODE=mock` supplies the grant, so it works with no portal.

---

## 5. How the token gets used — exactly one place

[src/lib/api/client.ts](../src/lib/api/client.ts) is the only module that touches `fetch`. Today
it has no credentials; the designed change is two additions to `request()`:

```ts
const AUTH_PATHS = ["/auth/session", "/auth/refresh"];  // must never self-retry

async function request<T>(path, init?, retry = true) {
  const token = getAccessToken();
  res = await fetch(`${OMS_API_BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init?.headers,
    },
  });

  if (res.status === 401 && retry && AUTH_PATHS.every((p) => !path.startsWith(p))) {
    const next = await refreshSession();
    if (next) return request<T>(path, init, false);   // ← `false` = strictly one attempt
  }
  // …unchanged ApiError branch
}
```

The `retry` flag is what makes it one attempt instead of infinite recursion on a genuinely dead
session.

**Deliberately not copied from the eSewa MiniApp:** its interceptor does
`window.location.href = "/login"` on 401. Inside an iframe that navigates the frame somewhere the
host never asked for — and OMS has nowhere to go, there is no login route. Recovery is
`bridge.renew()`.

Failures are normalised into `ApiError { code, message, status }` by
[src/lib/api/errors.ts](../src/lib/api/errors.ts), so callers get one shape whichever envelope
the backend used.

---

## 6. Session today vs. session tomorrow

### 6.1 Today: a fake role in localStorage

[src/providers/SessionProvider.tsx](../src/providers/SessionProvider.tsx) — a zustand store, the
only zustand in the app:

```ts
role: "merchant-a"        // persisted to localStorage as "oms-mock-session"
hydrated: false           // false until localStorage has been read
skipHydration: true       // rehydrated in an effect after mount
```

`skipHydration` + the `hydrated` flag exist to stop a hydration mismatch: the server renders
`merchant-a`, and `localStorage` is only read **after** mount so server and first client render
agree.

**Five call sites** read it, and the same value does three jobs at once — merchant id, audit
actor, and display key:

| File | Uses `role` as |
|---|---|
| `src/features/orders/components/queue/order-queue-page.tsx:37` | merchant id for the list query |
| `src/features/orders/components/detail/order-list-panel.tsx:50` | merchant id |
| `src/features/orders/components/detail/order-detail-page.tsx:60` | audit actor |
| `src/features/orders/components/queue/order-status-action.tsx:21` | audit actor |
| `src/features/shell/components/merchant-shell.tsx:17` | `MOCK_MERCHANTS[role]` for the sidebar footer |

### 6.2 Tomorrow: replaced, not kept alongside

| Today | After |
|---|---|
| `useSession(s => s.role)` as merchant id | server-side, from the token |
| `useSession(s => s.role)` as actor | server-side, from the token |
| `MOCK_MERCHANTS[role]` | `useMerchant()` → `session.merchant` |
| `MOCK_ROLES` for authorization | `session.permissions` + `useCan()` |

`AuthProvider` **replaces** `SessionProvider`. Two sources of identity is how
client-supplied-identity bugs get reintroduced. `MOCK_MERCHANTS` and `MOCK_ROLE_LABELS` move into
the mock seed — they are fixture data, not configuration.

---

## 7. Where the roles are — and the hole they leave

[src/config/constants.ts](../src/config/constants.ts):

```ts
MOCK_ROLES = ["merchant-a", "merchant-b", "cs-agent", "cs-agent-no-override", "rider"]
MOCK_ROLE_LABELS   // display strings
MOCK_MERCHANTS     // company name, location, logo for the sidebar footer
isMerchantRole()   // merchant roles double as merchant IDs in the seed
EMBED_BASE_PATH    // "/embed" — also keys hostOwnsAppearance()
```

There is **no role-based UI gating left** — `PermissionGate` and `RoleBadge` were deleted when
scope trimmed to two surfaces. The CS and rider roles survive only because the seeded activity
log names them as actors.

**Three places currently take identity from the client.** Correct for a mock with a role
switcher, wrong the moment a token exists. These land **with** the auth work, in the same commit
the backend stops reading them.

### 7.1 `merchantId` leaves the order list request

`GET /orders?merchantId=…` lets any caller read any merchant's orders. See
[src/features/orders/api.ts](../src/features/orders/api.ts) and `merchantQuery()` in
[src/lib/api/endpoints.ts](../src/lib/api/endpoints.ts).

- `endpoints.ts`: delete `merchantQuery()`; `orders.list` becomes a plain `/orders`.
- `use-orders.ts`: `useOrders()` takes no argument; the query key drops `{ merchantId }`.
- `order-queue-page.tsx` and `order-list-panel.tsx` stop reading the session for it.

### 7.2 `actor` and `actorRole` leave the status request

The mock does `if (!ROLES_WITH_OVERRIDE_PERMISSION.includes(body.actorRole))`. A client can send
`actorRole: "cs-agent"` and grant itself override permission, and write any name into the audit
log. **An audit log whose actor is client-supplied records nothing.**

- `UpdateOrderStatusRequest` becomes `{ status: OrderStatus; override?: boolean }`.
- The actor comes from the token server-side; `override` is authorized against the token's
  permissions.
- `order-status-action.tsx` and `order-detail-page.tsx` stop passing `actor` / `actorRole`.

### 7.3 `SessionProvider` is replaced

See §6.2.

---

## 8. The data flow rule, traced

Architecture is enforced by ESLint boundaries:

```
app → features → components/{layout,data-display,feedback} → components/ui → lib/utils
```

**Components never call `fetch`.** The chain is always:

```
component  →  hook (TanStack Query)  →  feature api.ts  →  lib/api/client  →  endpoints
```

Worked example — the order queue:

| Step | File |
|---|---|
| Component reads role, calls the hook | `src/features/orders/components/queue/order-queue-page.tsx` |
| Hook owns the query key + `select` | [src/features/orders/hooks/use-orders.ts](../src/features/orders/hooks/use-orders.ts) |
| Thin typed wrapper | [src/features/orders/api.ts](../src/features/orders/api.ts) |
| The only `fetch` | [src/lib/api/client.ts](../src/lib/api/client.ts) |
| Path strings | [src/lib/api/endpoints.ts](../src/lib/api/endpoints.ts) |
| Mock handler | [src/app/api/mock/orders/route.ts](../src/app/api/mock/orders/route.ts) |

Two details worth knowing in `use-orders.ts`:

- `HIDE_FAILED = true` drops failed orders via `select`, so rows **and** counts are consistent.
  Flip it to bring them back.
- Mutations invalidate both `orders.detail` and `orders.all`.

### 8.1 Cross-tab sync

[src/providers/QueryProvider.tsx](../src/providers/QueryProvider.tsx) wires a
`MutationCache.onSuccess` that posts on `BroadcastChannel("oms-sync")`; every other tab calls
`invalidateQueries()`. That is how the merchant tab shows "Delivered" live the moment the rider
confirms. A mutation that changes nothing opts out with `meta: { syncTabs: false }`.

---

## 9. Security rules you must not break

1. **The shared secret never reaches the browser.** `NEXT_PUBLIC_*` is inlined into the JS bundle
   at build time and is readable by anyone who loads the page. The dev secret is
   `OMS_HANDOFF_SECRET`, server-only, specifically so the dummy cannot normalise the mistake.
2. **Never `postMessage(token, "*")`.** A wildcard delivers to whatever origin occupies the
   frame. Always the exact origin.
3. **Validate all three axes** on every inbound message (§2.3).
4. **Session token in memory only.** Not `localStorage`, not `sessionStorage`, not a cookie — XSS
   reads both web storages. A reload costs one handshake, which is free.
5. **No token in the URL.** URLs reach `Referer` headers, server logs, browser history, and the
   analytics of whatever loads next.
6. **The handoff token is single-use and ≤ 120 s**, enforced by `jti` server-side, not by
   convention.
7. **Identity comes from the token, server-side, on every request** — never from a body field,
   query parameter or header the client controls.
8. **`404`, not `403`,** for another merchant's order. `403` confirms the ID exists, turning the
   detail route into an order-ID oracle.
9. **`frame-ancestors` stays enforced.** [next.config.ts](../next.config.ts) allows framing only
   on `/embed/*`, and only from `NEXT_PUBLIC_EMBED_HOST_ORIGINS`. The dashboard and rider portal
   are `'self'` and must stay that way — the rider portal has no login, so it must never become
   framable.
10. **Failure messages say nothing diagnostic.** The §4.7 copy never reveals which check failed.
11. **Clock skew is tolerated, not assumed away.** ±60 s on `exp`/`iat`/`nbf`.
12. **`/validate` stays unauthenticated** — its guard is the server-side 5-attempt limit, never
    trusted from the client.

---

## 10. Environment variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_OMS_API_BASE` | client | `/api/mock` | OMS API base — **exists** |
| `NEXT_PUBLIC_EMBED_HOST_ORIGINS` | client | `http://localhost:4200` | Comma-separated. Both `frame-ancestors` **and** the postMessage allowlist — **exists** |
| `NEXT_PUBLIC_AUTH_MODE` | client | `mock` | `host` (real handshake) or `mock` (dev issuer) — **designed** |
| `OMS_HANDOFF_SECRET` | **server only** | dev value | HMAC key for the dummy issuer. Deleted at cutover — **designed** |

`EMBED_HOST_ORIGINS` is the one variable parsed **twice**: once in
[src/config/env.ts](../src/config/env.ts) for the runtime bridge, once in
[next.config.ts](../next.config.ts) for the CSP. `next.config.ts` is loaded before the tsconfig
path aliases are applied, so it cannot import `@/config/env`. Both halves govern the same trust
decision — who may frame OMS, and whose messages OMS will read. **They must not diverge**: a list
that allows framing but not messaging (or the reverse) fails in a way that looks like a bug in
the host.

---

## 11. The dummy layer

The point is **not** to skip auth. It is to supply a fake *issuer* to the real auth pipeline. The
handshake, the exchange, the bearer header, the refresh and every failure state are the
production code paths; only the two signing services are local.

```
          REAL (built in the auth phase)            DUMMY (deleted at cutover)
┌──────────────────────────────────┐        ┌────────────────────────────────────┐
│ AuthProvider  +  AuthGate        │        │  mock-bridge.ts                    │
│ host-bridge (postMessage)        │ ◄────► │  POST /api/mock/dev/handoff        │
│ session-store (+ refresh)        │        │  POST /api/mock/auth/session       │
│ client.ts bearer + 401 retry     │        │  POST /api/mock/auth/refresh       │
│ every boot & failure state       │        │  GET  /api/mock/auth/me            │
└──────────────────────────────────┘        └────────────────────────────────────┘
```

The fake Fonepoints backend mints a **real** HS256 JWT with a server-only secret, called exactly
as the Angular portal will call the real service — so the secret is never in the browser even in
the dummy. The fake OMS backend does the **real** verification work with `crypto.subtle`
HMAC-SHA256: signature, `exp` with ±60 s skew, `iss`, `aud`, and a `jti` replay set. A mock that
returns a session for any string would let real bugs reach the real backend.

Mock lifetimes are deliberately short — **access 2 minutes, refresh 10 minutes** — so the refresh
path is exercised during normal development rather than discovered in production.

### 11.1 Failure injection

An `?authScenario=` parameter the mock bridge forwards to the mint route. Each row is one of the
§4.7 states; together they are the acceptance test for the auth UI.

| `?authScenario=` | Produces | Exercises |
|---|---|---|
| *(absent)* | a valid grant | the happy path |
| `expired` | `exp` in the past | `grant_expired` |
| `bad-signature` | signed with the wrong key | `invalid_grant` |
| `replayed` | a `jti` already in the set | `grant_replayed` |
| `unknown-merchant` | `merchant_id` not in the seed | `merchant_inactive` |
| `not-entitled` | a user without the OMS entitlement | `not_entitled` |
| `denied` | the bridge rejects instead of granting | `grant_denied` |
| `silent` | the bridge never resolves | `grant_timeout` (8 s) |
| `short-session` | a 10-second access token | proactive refresh + 401 retry |

### 11.2 The one switch

```ts
// src/lib/auth/index.ts
export const hostBridge: HostBridge =
  AUTH_MODE === "host"
    ? createPostMessageBridge(EMBED_HOST_ORIGINS)
    : createMockBridge();          // tree-shaken out of the production bundle
```

That is the **only** branch in the frontend. Nothing in `src/features/**` or `src/components/**`
knows which mode is running.

### 11.3 Cutover checklist

```bash
# 1. environment
NEXT_PUBLIC_AUTH_MODE=host
NEXT_PUBLIC_OMS_API_BASE=https://oms-api.fonepoints.com/v1
NEXT_PUBLIC_EMBED_HOST_ORIGINS=https://business.fonepoints.com

# 2. delete the dummy
rm -rf src/app/api/mock/auth src/app/api/mock/dev/handoff src/lib/auth/mock-bridge.ts

# 3. drop the mock branch in src/lib/auth/index.ts and AUTH_MODE from src/config/env.ts
```

**Unchanged:** every file under `src/features/**`, `src/components/**`, `src/lib/domain/**`, and
the response shapes in `src/lib/api/contracts.ts`. If any of those need editing at cutover, a
seam was missed.

---

## 12. The frozen spike — how tokens worked in the first pass

[src/app/backup-orders/token-context.tsx](../src/app/backup-orders/token-context.tsx) is the
preserved first OMS pass against the real Providhy Sales API. It is exempt from lint because its
value is being unchanged. Worth reading once, because it shows the same pattern at a quarter of
the size:

- `TokenProvider` in the layout so the token survives navigation.
- The same two origin checks (`event.origin`, `event.source === window.parent`).
- `OMS_IFRAME_READY` / `OMS_ACCESS_TOKEN` — the same child-driven handshake under different
  names.
- `salesGet` / `salesPost` attach `Authorization: Bearer` directly.

Two reasons it is not the model to follow: its `postMessage` handshake targets **apps-frontend**,
not the Angular Fonepoints portal, so that protocol still has to be agreed; and it passes the
**portal's own** access token straight through to the API, with no handoff exchange, no expiry
bound and no single-use guarantee.

---

## 13. What is actually left to build

`src/lib/auth/` does not exist. Neither does `AuthProvider`, `AuthGate`, `lib/api/auth.ts`, the
mock auth routes, nor `AUTH_MODE` in [src/config/env.ts](../src/config/env.ts) — it currently
exports only `OMS_API_BASE`, `IS_MOCK_API` and `EMBED_HOST_ORIGINS`.

The planned file layout:

```
src/lib/auth/                    no React, no fetch
  types.ts            Session, HandoffClaims, AuthPhase, AuthFailureReason
  session-store.ts    in-memory session holder + single-flight refresh
  host-bridge.ts      built ON lib/host/channel — the grant rides the same envelope as the theme
  mock-bridge.ts      DUMMY — deleted at cutover
  index.ts

src/lib/api/auth.ts   exchangeHandoff() / refreshSession() / fetchMe()
src/lib/api/client.ts MODIFIED — bearer header + single-flight 401 retry

src/providers/AuthProvider.tsx
src/features/auth/
  components/auth-gate.tsx
  components/auth-boot.tsx
  hooks/use-auth-session.ts     useMerchant(), usePermissions(), useCan()
```

Add `src/lib/auth/**` to `eslint.boundaries.mjs` with the same restriction block as
`src/lib/api/**` (no React, no `@/features/*`, no `@/components/*`, no `@/lib/mock`). It is
infrastructure, not a feature. `src/lib/host/**` wants the same block.

**One divergence to fix when you start:** the built
[src/lib/host/messages.ts](../src/lib/host/messages.ts) types `oms.auth.failed` as
`reason: string`, while `auth.md` §7.2 specifies the `AuthFailureReason` union. Tighten it when
the handler lands, otherwise the §4.7 state table is not type-checked.

---

## 14. Two mental anchors

1. **The child always drives the iframe handshake** and the host answers, re-answering on every
   reload — because the parent cannot know when our JS ran, and because the handoff token is
   single-use.
2. **Identity comes from the token, server-side** — never from a body field — which is why the
   three contract changes in §7 have to ship *with* the auth work rather than after it.
