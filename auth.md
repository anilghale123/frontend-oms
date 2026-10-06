# OMS authentication & host integration

**Status:** design agreed. **§9 (theme sync) and the host channel it runs on are built and
verified**; everything to do with tokens is still design. This file is the single source for the
auth phase — it replaces the notes previously in this file and supersedes the "Noted for the auth
phase" paragraph in `omsImplementationPlan.md` §2.

**Scope rule for this phase:** the OMS frontend is built *for real* — real handshake, real token
exchange, real bearer header, real refresh, real failure states. Every **backend** in the picture
(Fonepoints backend, OMS backend) is **specified here and mocked locally**. No backend code is
written. The mock sits behind the same seams the real services will occupy, so switching over is
an environment change plus deleting one folder.

**Audience:** OMS frontend engineers build §7–§11. The OMS backend team owns §4, the Fonepoints
backend team §5, the Angular portal team §6 and §8. §15 is what we need from them before cutover.

---

## 1. The flow

No login page is ever shown. The merchant is already signed in to the Fonepoints portal; OMS
inherits that session through a short-lived handoff token.

```
┌─────────────┐                                            ┌──────────────────┐
│  Merchant   │  1. already signed in, clicks "OMS"        │  Fonepoints      │
│  (browser)  │ ─────────────────────────────────────────► │  portal (Angular)│
└─────────────┘                                            └────────┬─────────┘
                                                                    │
                        2. POST /oms/handoff  (portal session)      │
                           ◄── { token, expiresAt }  signed with    │
                               the shared secret                    ▼
                                                           ┌──────────────────┐
                                                           │  Fonepoints      │
                                                           │  backend         │
                                                           └──────────────────┘
       3. renders <iframe src="https://oms…/embed/orders">
                                    │
                                    ▼
                           ┌──────────────────┐
                           │  OMS frontend    │  4. postMessage: oms.ready
                           │  (in the iframe) │  ◄─ 5. host.auth.grant { token }
                           └────────┬─────────┘
                                    │  6. POST /auth/session { handoffToken }
                                    ▼
                           ┌──────────────────┐
                           │  OMS backend     │  7. verify signature, exp, aud, jti
                           │                  │     ─► { accessToken, refreshToken,
                           └──────────────────┘          merchant, user, permissions }
                                    │
                                    ▼
                           8. OMS renders the order queue.
                              Every later call carries Authorization: Bearer <accessToken>.
```

Written out:

1. The merchant is signed in to the Fonepoints portal and clicks **OMS** in the portal sidebar.
2. The portal asks the **Fonepoints backend** for a handoff token. The Fonepoints backend mints
   one signed with the secret it shares with the OMS backend.
3. The portal renders the OMS iframe (`/embed/orders`). The token is **not** in the URL.
4. OMS mounts, renders nothing but a "Connecting…" state, and posts `oms.ready` to the parent.
5. The parent replies `host.auth.grant { token, expiresAt }`, targeted at the OMS origin.
6. OMS exchanges the handoff token at its own backend: `POST /auth/session`.
7. The OMS backend verifies the signature with the shared secret, checks expiry, audience and
   single-use, and returns an OMS session.
8. OMS holds the session in memory, attaches it as a bearer token to every API call, and renders
   the order queue. The merchant never sees a form.

---

## 2. Why two tokens

The flow has two distinct tokens, and conflating them is the main way this design goes wrong.

| | **Handoff token** | **OMS session token** |
|---|---|---|
| Minted by | Fonepoints backend | OMS backend |
| Signed with | the shared secret | OMS's own session key |
| Purpose | prove "this browser is merchant X, vouched for by Fonepoints" | authorize OMS API calls |
| Lifetime | **90 seconds** | 15 min access + 8 h refresh |
| Uses | **exactly one** (replay rejected by `jti`) | many |
| Crosses the iframe boundary | yes, by `postMessage` | no — minted inside OMS |
| Sent to the OMS API | once, in the `/auth/session` body | on every call, as `Authorization: Bearer` |
| Stored | nowhere; consumed on arrival | in memory only (§12) |

The handoff token is the only thing that travels between two origins, so it is short-lived and
single-use. The session token never leaves OMS. If a handoff token leaks it is worthless within
90 seconds and after one use.

---

## 3. Responsibility split

### OMS frontend — we build this

| # | Responsibility |
|---|---|
| F1 | Run the child side of the handshake: announce `oms.ready`, listen for the grant, validate `event.origin` and `event.source` on every message. |
| F2 | Exchange the handoff token for a session (`POST /auth/session`) and hold the result **in memory only**. |
| F3 | Attach `Authorization: Bearer <accessToken>` to every OMS API request, in `lib/api/client.ts` and nowhere else. |
| F4 | Refresh proactively before expiry, and on a `401` refresh once and retry the request — **single-flight**, so N concurrent 401s cause one refresh. |
| F5 | When refresh fails, ask the host for a new grant (`oms.auth.renew`). Never redirect, never show a login form. |
| F6 | Gate the merchant and embedded surfaces on a live session. Render boot and failure states (§7.7). |
| F7 | Keep `/deliver` (rider) and `/api/mock/*` unauthenticated (§7.8). |
| F8 | Stop sending identity in request bodies and query strings — no `merchantId`, no `actor`, no `actorRole` (§11). |
| F9 | Apply the host's theme while embedded, and not persist it (§9). |
| F10 | Report route changes to the host so the portal's breadcrumb and URL can follow, and accept the host's deep-link requests. |
| F11 | Ship the dummy issuer (§10) so all of the above runs locally with no backend. |

### OMS backend — specified in §4, not built

| # | Responsibility |
|---|---|
| B1 | Verify the handoff token: signature, `exp`/`iat`/`nbf` with skew, `iss`, `aud`, and `jti` single-use. |
| B2 | Mint, rotate and revoke OMS session tokens. |
| B3 | **Derive merchant, user and permissions from the token on every request.** Ignore any client-supplied identity. |
| B4 | Scope `GET /orders` and every order route to the token's merchant; `404` (not `403`) for another merchant's order, so IDs can't be probed. |
| B5 | Write the audit-log actor from the token, never from the request body. |
| B6 | Enforce override permission from the token's permissions, never from a body field. |
| B7 | Hold the shared secret server-side only, and support rotation (accept two key IDs during overlap). |
| B8 | Return the documented error envelope `{ error: { code, message } }` with stable codes (§4.4). |

### Fonepoints backend — specified in §5, not built

| # | Responsibility |
|---|---|
| P1 | Expose `POST /oms/handoff`, authenticated by the portal session. |
| P2 | Mint the handoff token with the agreed claims, 90 s expiry, a fresh `jti` each time. |
| P3 | Refuse to mint for a merchant the caller isn't entitled to, and for users without the OMS entitlement. |
| P4 | Hold the shared secret server-side only. |

### Angular portal — specified in §6, not built by us

| # | Responsibility |
|---|---|
| H1 | Own all chrome: sidebar, top bar, page frame. OMS `/embed/*` renders none of it (already true). |
| H2 | On **every** `oms.ready` — including after an iframe reload or HMR — fetch a **fresh** handoff token and send it. Handoff tokens are single-use and must not be cached. |
| H3 | Target `postMessage` at the exact OMS origin, never a wildcard. |
| H4 | Mint a fresh grant on `oms.auth.renew`. |
| H5 | Push theme changes to the iframe. |
| H6 | Keep OMS's origin in its own CSP `frame-src`, and stay in OMS's `NEXT_PUBLIC_EMBED_HOST_ORIGINS`. |

---

## 4. OMS backend contract (specification only)

Base path is `NEXT_PUBLIC_OMS_API_BASE`. The mock implements all of this at `/api/mock`.

### 4.1 `POST /auth/session` — exchange a handoff token

```http
POST /auth/session
Content-Type: application/json

{ "handoffToken": "<jwt>" }
```

```jsonc
// 200
{
  "accessToken": "<jwt>",
  "expiresAt": "2026-10-05T09:15:00.000Z",   // access token expiry, ISO 8601 UTC
  "refreshToken": "<opaque>",
  "refreshExpiresAt": "2026-10-05T17:00:00.000Z",
  "user":     { "id": "usr_7f3a", "name": "Sabina Shrestha", "email": "sabina@hamromobile.com" },
  "merchant": { "id": "mch_001", "name": "Hamro Mobile", "location": "New Road, Kathmandu",
                "logoUrl": "https://…/merchant-001.png" },
  "permissions": ["orders:read", "orders:fulfil"]
}
```

Verification steps, all mandatory:

| Check | On failure |
|---|---|
| Signature matches the shared secret (by `kid`) | `401 invalid_grant` |
| `exp` in the future, `iat`/`nbf` not in the future — **±60 s skew allowed** | `401 grant_expired` |
| `iss` is the agreed Fonepoints issuer | `401 invalid_grant` |
| `aud` is the agreed OMS audience | `401 invalid_grant` |
| `jti` not seen before — recorded until `exp` | `401 grant_replayed` |
| Merchant exists and is active | `403 merchant_inactive` |
| User has the OMS entitlement | `403 not_entitled` |

Failure messages must not reveal which check failed beyond these codes.

### 4.2 `POST /auth/refresh`

```http
POST /auth/refresh
{ "refreshToken": "<opaque>" }
```

Returns the same shape as `/auth/session`. The refresh token **rotates** — the old one is
invalidated on use, and a reused one invalidates the whole chain (`401 refresh_reused`).

### 4.3 `GET /auth/me`

Returns `{ user, merchant, permissions }` for the bearer token. Used to re-validate on tab focus
after a long idle, and as the health check in §14.

### 4.4 Error envelope and codes

Same envelope as the rest of the OMS API: `{ error: { code, message } }`.

| HTTP | `code` | Frontend reaction |
|---|---|---|
| 401 | `invalid_grant` | ask the host for a new grant (once), then fail |
| 401 | `grant_expired` | ask the host for a new grant (once), then fail |
| 401 | `grant_replayed` | fail — never auto-retry a replay |
| 401 | `token_expired` | refresh, then retry the original request |
| 401 | `refresh_reused` | fail hard, clear the session, ask the host for a new grant |
| 403 | `not_entitled` | terminal: "This account doesn't have access to OMS" |
| 403 | `merchant_inactive` | terminal: "This merchant account is inactive" |
| 403 | `forbidden` | the action is refused; the session stays valid |

### 4.5 Required change to the existing order routes

Every order route becomes identity-derived. Nothing below is a new endpoint — it is a change to
how the existing ones read identity. See §11.

- `GET /orders` — returns the **token's** merchant's orders. The `?merchantId=` parameter is
  removed; if sent, it is ignored.
- `GET /orders/:omsOrderId` — `404` when the order belongs to another merchant.
- `PATCH /orders/:omsOrderId/status` — `actor` and `actorRole` are **removed from the body**. The
  actor written to the activity log, and the override-permission check, both come from the token.
- `PATCH /orders/:omsOrderId/rider` — unchanged shape, merchant-scoped.
- `POST /validate` — **stays unauthenticated.** The rider has no account. Its brute-force guard
  stays the 5-attempt limit (domain rule 8).

---

## 5. Fonepoints backend contract (specification only)

### `POST /oms/handoff`

Authenticated by the portal's own session (cookie or bearer — the portal's existing scheme).

```jsonc
// request
{ "merchantId": "mch_001" }   // optional; omit when the user has exactly one merchant

// 200
{ "token": "<jwt>", "expiresAt": "2026-10-05T09:01:30.000Z" }
```

### Handoff token claims

```jsonc
{
  "iss": "fonepoints",            // agreed issuer string
  "aud": "fonepoints-oms",        // agreed audience string
  "sub": "usr_7f3a",              // Fonepoints user id
  "merchant_id": "mch_001",
  "roles": ["merchant_owner"],
  "iat": 1791187200,
  "exp": 1791187290,              // iat + 90s
  "jti": "01JC5Z8Q2K7M4N",        // unique per mint — the single-use key
  "ver": 1                        // claim-set version, so claims can evolve
}
```

The header carries `kid`, so the secret can be rotated without downtime.

Rules:

- A fresh `jti` and a fresh `exp` on **every** mint. Never return a cached token.
- `exp - iat` is 90 s. The child exchanges it within milliseconds; a longer window only widens
  the replay surface.
- `403` when the caller isn't entitled to `merchant_id`, or has no OMS entitlement at all.

---

## 6. Angular portal contract (specification only)

`fonepoints-business` already renders the iframe with a load timeout and retry
(`src/app/pages/oms/oms-page.ts`). What it gains:

```ts
// core/config.ts — additions
export const OMS_ORIGIN = 'http://localhost:3000';              // already present
export const OMS_EMBED_URL = `${OMS_ORIGIN}/embed/orders`;      // already present
export const OMS_PROTOCOL_VERSION = 1;
export const OMS_MESSAGE_SOURCE = 'fonepoints-oms';             // messages FROM oms
export const HOST_MESSAGE_SOURCE = 'fonepoints-host';           // messages FROM the portal
```

Parent-side logic:

```ts
// On every oms.ready — including reloads. Handoff tokens are single-use, so never cache one.
window.addEventListener('message', async (event) => {
  if (event.origin !== OMS_ORIGIN) return;                       // hard origin check
  if (event.source !== this.frame.nativeElement.contentWindow) return;
  const msg = event.data;
  if (msg?.source !== OMS_MESSAGE_SOURCE || msg.v !== OMS_PROTOCOL_VERSION) return;

  switch (msg.type) {
    case 'oms.ready':
    case 'oms.auth.renew':
      await this.grant();                                        // fresh mint, every time
      this.sendTheme();
      break;
    case 'oms.auth.ok':      this.loaded.set(true); break;
    case 'oms.auth.failed':  this.showAuthError(msg.reason); break;
    case 'oms.route.changed': this.syncBreadcrumb(msg.path, msg.title); break;
  }
});

private async grant() {
  try {
    const { token, expiresAt } = await firstValueFrom(
      this.http.post<HandoffResponse>('/api/oms/handoff', {}),
    );
    this.post({ type: 'host.auth.grant', token, expiresAt });
  } catch {
    this.post({ type: 'host.auth.denied', reason: 'mint_failed' });
  }
}

private post(msg: object) {
  this.frame.nativeElement.contentWindow.postMessage(
    { source: HOST_MESSAGE_SOURCE, v: OMS_PROTOCOL_VERSION, ...msg },
    OMS_ORIGIN,                                                  // the exact origin, never '*'
  );
}
```

The existing 12 s `load` timeout stays — it catches a **refused frame**, which fires no event at
all (see `omsContext.md` → Embedding). Auth failures are reported over the channel instead, and
OMS also renders its own failure state inside the frame.

---

## 7. Frontend implementation — what we build

### 7.1 Files

```
src/lib/host/                    BUILT (section 9) — the host channel, shared by both concerns
  messages.ts         protocol constants, the message union, type guards
  channel.ts          origin-validated postMessage channel; announces oms.ready
  index.ts

src/lib/auth/                    no React, no fetch
  types.ts            Session, HandoffClaims, AuthPhase, AuthFailureReason
  session-store.ts    in-memory session holder + single-flight refresh
  host-bridge.ts      HostBridge, built ON `lib/host/channel` — the grant rides the same
                      envelope as the theme, so this adds handlers, not a second channel
  mock-bridge.ts      DUMMY — dev issuer standing in for the portal. Deleted at cutover.
  index.ts

src/lib/api/
  auth.ts             exchangeHandoff() / refreshSession() / fetchMe() via apiClient
  client.ts           MODIFIED — bearer header + single-flight 401 retry

src/providers/
  AuthProvider.tsx    runs the handshake, owns the boot phase, exposes useAuth()

src/features/auth/
  components/auth-gate.tsx      renders children only when the session is live
  components/auth-boot.tsx      the connecting / exchanging / failed states
  hooks/use-auth-session.ts     useMerchant(), usePermissions(), useCan()
  index.ts

src/app/api/mock/auth/          DUMMY — the fake OMS backend. Deleted at cutover.
  session/route.ts
  refresh/route.ts
  me/route.ts
  _tokens.ts          HMAC sign/verify, jti replay set, scenario injection
src/app/api/mock/dev/handoff/   DUMMY — the fake Fonepoints backend. Deleted at cutover.
  route.ts
```

Boundary note: add `src/lib/auth/**` to `eslint.boundaries.mjs` with the same restriction block
as `src/lib/api/**` (no React, no `@/features/*`, no `@/components/*`, no `@/lib/mock`). It is
infrastructure, not a feature. `src/lib/host/**` wants the same block.

### 7.2 The protocol module

**Built** as `src/lib/host/messages.ts`, with the auth message types already declared so this
phase adds handlers rather than a second envelope. Reproduced here as the contract:

```ts
// src/lib/host/messages.ts
export const PROTOCOL_VERSION = 1;
export const OMS_SOURCE = "fonepoints-oms";
export const HOST_SOURCE = "fonepoints-host";

export type AuthFailureReason =
  | "no_host"          // not in an iframe, or the host never answered
  | "grant_timeout"    // host.auth.grant never arrived
  | "grant_denied"     // the host couldn't mint
  | "grant_rejected"   // the OMS backend refused the handoff token
  | "not_entitled"
  | "merchant_inactive"
  | "unreachable";     // network

export type OmsToHost =
  | { type: "oms.ready" }
  | { type: "oms.auth.ok"; merchantId: string }
  | { type: "oms.auth.failed"; reason: AuthFailureReason }
  | { type: "oms.auth.renew" }
  | { type: "oms.route.changed"; path: string; title: string };

export type HostToOms =
  | { type: "host.auth.grant"; token: string; expiresAt: string }
  | { type: "host.auth.denied"; reason: string }
  | { type: "host.theme"; mode: "light" | "dark"; accent?: string }
  | { type: "host.route.request"; path: string };

type Envelope = { source: string; v: number };

/**
 * Next's HMR, React DevTools and browser extensions all post messages to this window, so the
 * `source` discriminator is not decoration — without it the handshake picks up noise.
 */
export function isHostMessage(data: unknown): data is HostToOms & Envelope {
  if (typeof data !== "object" || data === null) return false;
  const msg = data as Partial<Envelope> & { type?: unknown };
  return msg.source === HOST_SOURCE && msg.v === PROTOCOL_VERSION && typeof msg.type === "string";
}
```

### 7.3 The host bridge

One interface, two implementations. This is the seam that makes the dummy layer disposable:
`AuthProvider` never learns which one it got.

```ts
// src/lib/auth/host-bridge.ts
export interface Grant {
  token: string;
  expiresAt: string;
}

export interface HostBridge {
  /** Announce readiness and resolve with the first grant, or reject on timeout/denial. */
  requestGrant(signal: AbortSignal): Promise<Grant>;
  /** Ask for a replacement grant once the refresh chain is exhausted. */
  renew(signal: AbortSignal): Promise<Grant>;
  /** Host-driven theme changes; no-op in mock mode. Returns an unsubscribe. */
  onTheme(cb: (theme: { mode: "light" | "dark"; accent?: string }) => void): () => void;
  /** Host-driven deep links; no-op in mock mode. */
  onRouteRequest(cb: (path: string) => void): () => void;
  /** Tell the host what happened; no-op in mock mode. */
  notify(message: OmsToHost): void;
}

export const GRANT_TIMEOUT_MS = 8_000;

export function createPostMessageBridge(allowedOrigins: string[]): HostBridge { /* … */ }
```

`requestGrant` in the real bridge:

```ts
function requestGrant(signal: AbortSignal) {
  return new Promise<Grant>((resolve, reject) => {
    if (window.parent === window) return reject(new AuthError("no_host"));

    const onMessage = (event: MessageEvent) => {
      if (!allowedOrigins.includes(event.origin)) return;   // origin allowlist, never a wildcard
      if (event.source !== window.parent) return;           // and it must be our parent
      if (!isHostMessage(event.data)) return;               // and our protocol

      if (event.data.type === "host.auth.grant") {
        cleanup();
        resolve({ token: event.data.token, expiresAt: event.data.expiresAt });
      }
      if (event.data.type === "host.auth.denied") {
        cleanup();
        reject(new AuthError("grant_denied"));
      }
    };

    const timer = setTimeout(() => {
      cleanup();
      reject(new AuthError("grant_timeout"));
    }, GRANT_TIMEOUT_MS);

    window.addEventListener("message", onMessage);
    signal.addEventListener("abort", cleanup);
    // The child drives the handshake: the parent cannot know when our JS ran.
    notify({ type: "oms.ready" });
  });
}
```

The parent's origin is not known in advance, so the allowlist is
`NEXT_PUBLIC_EMBED_HOST_ORIGINS` — the same variable `next.config.ts` already uses for
`frame-ancestors`. One list governs both who may frame us and whose messages we trust.

### 7.4 The session store

A plain module, so `lib/api/client.ts` can read it without importing React.

```ts
// src/lib/auth/session-store.ts
let session: Session | null = null;
let refreshing: Promise<Session | null> | null = null;

/** Installed by AuthProvider. Keeps lib/auth free of lib/api, so there is no import cycle. */
let refresher: ((refreshToken: string) => Promise<Session>) | null = null;
let onLost: (() => void) | null = null;

export const getAccessToken = () => session?.accessToken ?? null;
export const getSession = () => session;
export const setSession = (next: Session | null) => { session = next; };
export const setRefresher = (fn: typeof refresher) => { refresher = fn; };
export const setOnSessionLost = (fn: typeof onLost) => { onLost = fn; };

/**
 * Single-flight: a burst of 401s from parallel queries must cause exactly one refresh.
 * Later callers await the same promise and never send a second request.
 */
export function refreshSession(): Promise<Session | null> {
  if (refreshing) return refreshing;
  const token = session?.refreshToken;
  if (!token || !refresher) return Promise.resolve(null);

  refreshing = refresher(token)
    .then((next) => { session = next; return next; })
    .catch(() => { session = null; onLost?.(); return null; })
    .finally(() => { refreshing = null; });

  return refreshing;
}
```

`onLost` is where `AuthProvider` calls `bridge.renew()` — the recovery path is always the host,
which is exactly why OMS needs no login form.

### 7.5 Changes to `lib/api/client.ts`

Two additions to the existing `request()`. Nothing else in the file moves.

```ts
import { getAccessToken, refreshSession } from "@/lib/auth";

/** The auth endpoints themselves must never trigger the refresh-and-retry path. */
const AUTH_PATHS = ["/auth/session", "/auth/refresh"];

async function request<T>(path: string, init?: RequestInit, retry = true): Promise<T> {
  const token = getAccessToken();

  let res: Response;
  try {
    res = await fetch(`${OMS_API_BASE}${path}`, {
      ...init,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...init?.headers,
      },
    });
  } catch (cause) { /* unchanged network branch */ }

  // Expired access token: refresh once, then replay the original request.
  // `retry` makes this strictly one attempt — no recursion loop on a genuinely dead session.
  if (res.status === 401 && retry && AUTH_PATHS.every((p) => !path.startsWith(p))) {
    const next = await refreshSession();
    if (next) return request<T>(path, init, false);
  }

  if (!res.ok) { /* unchanged ApiError branch */ }
  // …
}
```

Deliberately **not** copied from the eSewa MiniApp: its interceptor sets
`window.location.href` on a 401. Inside an iframe that navigates the frame to a URL the host
never asked for, and OMS has nowhere to navigate *to* — there is no login route. Recovery is
`bridge.renew()`.

### 7.6 AuthProvider

```tsx
export type AuthPhase = "connecting" | "exchanging" | "ready" | "failed";

export interface AuthValue {
  phase: AuthPhase;
  session: Session | null;
  reason: AuthFailureReason | null;
  retry: () => void;
}
```

Sequence on mount:

1. `phase = "connecting"` → `bridge.requestGrant()`.
2. On a grant: `phase = "exchanging"` → `exchangeHandoff(token)`.
3. On success: `setSession()`, install the refresher and the lost-session callback, schedule a
   proactive refresh at `expiresAt - 60s`, `notify({ type: "oms.auth.ok" })`, `phase = "ready"`.
4. On failure: map `ApiError.code` to an `AuthFailureReason`,
   `notify({ type: "oms.auth.failed", reason })`, `phase = "failed"`.
5. `retry()` restarts at step 1 with a fresh `AbortController`.

It mounts **inside** `QueryProvider` (so a refresh can invalidate queries) and **replaces**
`SessionProvider` (§11.3).

### 7.7 Boot and failure states

`AuthGate` renders children only at `phase === "ready"`. Everything else is a centered panel. No
new components: `ErrorState` from `@/components/feedback` plus `Spinner` from `@/components/ui`,
per the design system.

| Phase / reason | Copy | Action |
|---|---|---|
| `connecting` | "Connecting to Fonepoints…" + `Spinner` | — |
| `exchanging` | "Signing you in…" + `Spinner` | — |
| `grant_timeout` | "Couldn't connect to the Fonepoints portal." | **Try again** |
| `grant_denied` | "The portal couldn't start an OMS session." | **Try again** |
| `grant_rejected` | "Your session has expired. Reopen OMS from the portal." | **Try again** |
| `not_entitled` | "This account doesn't have access to OMS." | — (terminal) |
| `merchant_inactive` | "This merchant account is inactive." | — (terminal) |
| `no_host` | "Open OMS from the Fonepoints portal." | — (terminal) |
| `unreachable` | "Couldn't reach OMS. Check your connection." | **Try again** |

Copy is sentence case with active verbs, per AGENTS.md rule 8. All of it is user-facing — it
never names a token, a claim or an HTTP code.

The `connecting` and `exchanging` states must be **visually quiet**: the merchant has already
seen the portal's own spinner, so a second large one reads as a failure. A small centered spinner
on `bg-fill1`, no card, no logo.

### 7.8 Route matrix

Authentication is not global. `AuthGate` is mounted per route group.

| Route | Gated | Why |
|---|---|---|
| `/embed/*` | **yes** | the embedded surface — the host supplies the grant |
| `/(merchant)/*` | **yes** | the standalone dashboard; fails with `no_host` outside an iframe |
| `/(rider)/deliver` | **no** | the rider has no account. Deliberate, per `omsImplementationPlan.md` — the 5-attempt limit is the brute-force guard |
| `/api/mock/*` | **no** | the mock *is* the auth server |
| `/backup-orders/*` | **no** | frozen spike with its own `TokenProvider` |

The standalone merchant dashboard stays gated rather than being made public in dev: a surface
that silently works without a session is how identity assumptions leak back into the UI. In local
development `AUTH_MODE=mock` supplies the grant (§10), so it works with no portal.

---

## 8. Parent and child message protocol

Every message is `{ source, v, type, ...payload }`, with `v` at `1`. A receiver **drops** any
message whose `source` or `v` it does not recognise, which is what lets either side ship a `v: 2`
without breaking the other.

### Child to parent (`source: "fonepoints-oms"`)

| `type` | Payload | Meaning | Parent must |
|---|---|---|---|
| `oms.ready` | — | OMS mounted and listening. **Fires again after every reload.** | mint a **fresh** grant and send it, plus the current theme. **Wired** (theme half) |
| `oms.auth.ok` | `{ merchantId }` | session established | hide its own spinner |
| `oms.auth.failed` | `{ reason }` | auth failed; OMS shows its own state | optionally show a portal-level notice |
| `oms.auth.renew` | — | refresh chain exhausted | mint a fresh grant and send it |
| `oms.route.changed` | `{ path, title }` | the merchant navigated inside OMS | sync the breadcrumb / portal URL |

### Parent to child (`source: "fonepoints-host"`)

| `type` | Payload | Meaning | Child must |
|---|---|---|---|
| `host.auth.grant` | `{ token, expiresAt }` | a handoff token | exchange it immediately |
| `host.auth.denied` | `{ reason }` | the portal couldn't mint | fail with `grant_denied` |
| `host.theme` | `{ mode, accent? }` | host appearance | apply transiently (§9). **Wired** |
| `host.route.request` | `{ path }` | portal deep link / browser back | `router.push(path)` if it is a known OMS path |

### Handshake invariants

- **The child drives.** The parent cannot know when the child's JS ran, so it never sends first;
  it answers `oms.ready`.
- **The parent never caches the grant.** One `oms.ready`, one mint. A cached handoff token is
  rejected as a replay on second use, which looks exactly like a broken integration.
- **`host.route.request` is validated** against known OMS routes before `push`. The host is
  trusted-ish, but a path arriving from another window is still input.
- **`oms.route.changed` carries no order data** — only the path and page title. The host does not
  need, and should not receive, customer or order detail.

### Reserved, not implemented

`oms.height { px }` (the portal gives OMS 100% height, so auto-sizing isn't needed) and
`host.ping` / `oms.pong` (liveness). Named here so neither side invents a conflicting meaning.

---

## 9. Theme sync — **built**

Theme sync is the one part of the host channel that is wired today, because it needed no
authentication. Everything below is implemented on both sides; the rest of this document is
still design.

| Side | What exists |
|---|---|
| OMS | `src/lib/host/` (protocol + channel), `src/providers/HostSync.tsx`, mounted in `src/app/embed/layout.tsx` |
| Portal | `src/app/core/theme.ts`, `src/app/core/oms-bridge.ts`, `shared/profile-menu.ts`, `shared/settings-dialog.ts` |

While embedded, **the host owns the theme.** OMS has a full appearance system
(`src/lib/appearance.ts`: mode, 19 accents, 3 fonts, persisted to `localStorage` and applied
pre-paint by `APPEARANCE_BOOT_SCRIPT`). Three rules keep the two from fighting:

1. **`host.theme` is applied transiently.** `HostSync` calls `applyAppearance()`, never
   `saveAppearance()`. Persisting the host's theme would make it stick the next time the
   merchant opens OMS standalone, and would fire `APPEARANCE_CHANGE_EVENT` for a change the user
   never made.
2. **`AppearanceSync` stands down on the embedded surface.** This is the one that bites. The
   root layout's `AppearanceSync` applies the merchant's stored appearance on mount, and its
   effect runs *before* anything inside `/embed` — so it overwrote the theme the host had
   already put in the document, and the global `D` shortcut fought the next `host.theme`
   message. `hostOwnsAppearance()` in `@/lib/appearance` is true when OMS is framed **and** on
   `EMBED_BASE_PATH`, and both the mount apply and the `D` shortcut check it. It is a function
   of the environment rather than a flag one component sets for another, precisely because
   there is no mount order in which such a flag would be set early enough.
3. **The appearance panel is hidden on `/embed/*`.** A control the next host message overwrites
   is worse than no control. Settings → Appearance stays on the standalone surface.

```ts
// src/providers/HostSync.tsx
const offTheme = channel.on("host.theme", ({ mode, accent }) => {
  if (!isHostThemeMode(mode)) return;
  // The stored preference supplies the font; the host has no opinion on it.
  const current = loadAppearance();
  const hostAccent = asAppearanceTheme(accent, APPEARANCE_THEMES);
  applyAppearance({ ...current, mode, theme: hostAccent ?? current.theme });
});
const stop = channel.start();   // attaches the listener, then announces oms.ready
```

Mapping: `mode` is `light` or `dark` only — `system` is the host's business, resolved by
`Theme.resolved()` before it sends. `accent` is an opaque string on the wire and must match an
`APPEARANCE_THEMES` id; an unknown one is ignored rather than guessed, so the two apps can ship
independently. The portal offers eight of OMS's nineteen accents (the visibly distinct span);
adding another is one entry in `ACCENTS` plus one `[data-accent]` rule in `styles.scss`, and
nothing in OMS changes.

**First paint.** The host's theme cannot arrive until after OMS has painted, so a dark portal
would show a light flash. `OmsBridge.embedUrl()` therefore appends `#theme=dark&accent=emerald`
to the iframe `src`, and `APPEARANCE_BOOT_SCRIPT` reads it before paint. A fragment, not a query
string, so it never reaches a server log or a `Referer` header. It is only a hint — the
authoritative value is the message that follows — and it is used for the initial `src` only, so
a theme change never reloads the frame.

**Brand is not accent.** The portal keeps `--fp-brand` (Fonepoints red) for the wordmark and the
merchant tile, and a separate `--fp-accent` for active nav, primary buttons and focus. Picking an
accent must not recolour the logo. The default accent is the brand red, so the portal looks
unchanged until someone changes it.

### Verified

Driven through a real browser against both dev servers — 14/14:
OMS loads framed · starts on the host's mode and accent · the top-bar toggle and the dialog both
reach OMS · the portal chrome follows the same accent · Reset returns both · **OMS is still dark
after reloading inside the frame** (the portal re-answers `oms.ready`, which is the invariant the
auth handoff will depend on) · standalone OMS keeps its own appearance and ignores the host ·
profile edits persist and update the avatar.

---

## 10. The dummy layer

The point of the dummy layer is **not** to skip auth. It is to supply a fake *issuer* to the real
auth pipeline. The handshake, the exchange, the bearer header, the refresh and every failure state
are the production code paths; only the two signing services are local.

```
          REAL (built now)                          DUMMY (deleted at cutover)
┌──────────────────────────────────┐        ┌────────────────────────────────────┐
│ AuthProvider  +  AuthGate        │        │  mock-bridge.ts                    │
│ host-bridge (postMessage)        │ ◄────► │  POST /api/mock/dev/handoff        │
│ session-store (+ refresh)        │        │  POST /api/mock/auth/session       │
│ client.ts bearer + 401 retry     │        │  POST /api/mock/auth/refresh       │
│ every boot & failure state       │        │  GET  /api/mock/auth/me            │
└──────────────────────────────────┘        └────────────────────────────────────┘
```

### 10.1 The fake Fonepoints backend

`POST /api/mock/dev/handoff` mints a real HS256 JWT with a **dev secret read from
`OMS_HANDOFF_SECRET` — a server-only variable, never `NEXT_PUBLIC_`.** The mock bridge calls this
route exactly as the Angular portal will call the real Fonepoints backend, so the secret is never
in the browser even in the dummy. Minting in the browser would have been two lines shorter and
would have trained the wrong habit.

```ts
// src/app/api/mock/dev/handoff/route.ts   (DUMMY — delete at cutover)
export async function POST(request: Request) {
  const { merchantId = "mch_001", scenario } = await request.json();
  return NextResponse.json(await mintHandoff(merchantId, scenario));
}
```

### 10.2 The fake OMS backend

`src/app/api/mock/auth/*` does the **real** verification work with `crypto.subtle` HMAC-SHA256:
signature, `exp` with ±60 s skew, `iss`, `aud`, and a `jti` replay set. Per
`.claude/rules/mock-api.md` — *"the mock must behave like the real OMS would, including the
unhappy paths"* — a mock that returns a session for any string would let real bugs reach the real
backend. Verification is about forty lines; there is no reason to fake it.

The `jti` set and the session table are in-memory and reset with `next dev`, like the rest of the
mock (`src/lib/mock/db.ts`).

Mock session lifetimes are deliberately short, so the refresh path is exercised during normal
development rather than discovered in production: **access 2 minutes, refresh 10 minutes.**

### 10.3 Failure injection

The voucher seed already carries failure vouchers (`REDEMPTION-FAILS`, `MISMATCH-CODE`,
`ALREADY-REDEEMED`). Auth gets the equivalent, as an `?authScenario=` parameter the mock bridge
forwards to the mint route:

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

Each row is one of the §7.7 states. Together they are the acceptance test for the auth UI, and
they stay useful after cutover by pointing the mock bridge at a staging grant.

### 10.4 The one switch

```ts
// src/config/env.ts — addition
/**
 * Where the handoff token comes from. `host` is the real postMessage handshake with the
 * Fonepoints portal. `mock` uses the in-repo dev issuer, so OMS boots standalone with no portal
 * and no backend. Both run the identical exchange, refresh and failure paths — `mock` replaces
 * the issuer, not the authentication.
 */
export const AUTH_MODE = (process.env.NEXT_PUBLIC_AUTH_MODE ?? "mock") as "host" | "mock";

/**
 * Origins allowed to frame OMS and to send it a handoff token.
 *
 * `next.config.ts` parses the same variable for `frame-ancestors`, and keeps its own copy: it is
 * loaded before the tsconfig path aliases are applied, so it cannot import `@/config/env`. The
 * duplication is one `split` of one variable — keep the two in sync, and do not let the lists
 * diverge, because they are two halves of one trust decision.
 */
export const EMBED_HOST_ORIGINS = (
  process.env.NEXT_PUBLIC_EMBED_HOST_ORIGINS || "http://localhost:4200"
)
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
```

```ts
// src/lib/auth/index.ts
export const hostBridge: HostBridge =
  AUTH_MODE === "host"
    ? createPostMessageBridge(EMBED_HOST_ORIGINS)
    : createMockBridge();          // tree-shaken out of the production bundle
```

That is the only branch in the frontend. Nothing in `src/features/**` or `src/components/**`
knows which mode is running.

### 10.5 Cutover checklist

When the real services exist:

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

## 11. Contract changes this forces

Three places currently take identity from the client. That is correct for a mock with a role
switcher, and wrong the moment a token exists. These changes land **with** the auth work, not
after it — the frontend stops sending the fields in the same commit the backend stops reading
them.

### 11.1 `merchantId` leaves the order list request

`GET /orders?merchantId=…` (`src/app/api/mock/orders/route.ts`, `src/lib/api/endpoints.ts`) lets
any caller read any merchant's orders. Under real auth the server scopes from the token.

- `endpoints.ts`: delete `merchantQuery()`; `orders.list` becomes a plain `/orders`.
- `use-orders.ts`: `useOrders()` takes no argument. The query key drops `{ merchantId }`.
- Call sites in `order-queue-page.tsx` and `order-list-panel.tsx` stop reading the session for it.

### 11.2 `actor` and `actorRole` leave the status request

`UpdateOrderStatusRequest` (`src/lib/api/contracts.ts`) carries `actor` and `actorRole`, and the
mock trusts them:

```ts
// src/app/api/mock/orders/[omsOrderId]/status/route.ts
if (!ROLES_WITH_OVERRIDE_PERMISSION.includes(body.actorRole)) { … }
```

A client can send `actorRole: "cs-agent"` and be granted override permission, and can write any
name it likes into the audit log. An audit log whose actor is client-supplied records nothing.

- `UpdateOrderStatusRequest` becomes `{ status: OrderStatus; override?: boolean }`.
- The actor is taken from the token server-side; `override` is authorized against the token's
  permissions.
- `order-status-action.tsx` and `order-detail-page.tsx` stop passing `actor` / `actorRole`.

This also simplifies the mock: `ROLES_WITH_OVERRIDE_PERMISSION` becomes a permission check on the
session, and `MOCK_ROLES` stops being an authorization input.

### 11.3 `SessionProvider` is replaced, not kept alongside

`src/providers/SessionProvider.tsx` is the zustand mock session; five components read
`useSession((s) => s.role)` and use it as a merchant id, an actor and a display key at once.

Replace it with `AuthProvider`. Two sources of identity is how the client-supplied-identity bugs
above get reintroduced.

| Today | After |
|---|---|
| `useSession((s) => s.role)` as a merchant id | server-side, from the token |
| `useSession((s) => s.role)` as an actor | server-side, from the token |
| `MOCK_MERCHANTS[role]` for the sidebar footer | `useMerchant()` → `session.merchant` |
| `MOCK_ROLES` for authorization | `session.permissions` + `useCan()` |

`MOCK_MERCHANTS` and `MOCK_ROLE_LABELS` in `src/config/constants.ts` move into the mock seed —
they are fixture data, not configuration. The five call sites are listed in §14, phase 4.

---

## 12. Security rules

Non-negotiable, in rough order of how badly each one bites.

1. **The shared secret never reaches the browser.** Not in `NEXT_PUBLIC_*`, not in a client
   component, not in the dummy. `NEXT_PUBLIC_*` is inlined into the JS bundle at build time and
   is readable by anyone who loads the page. The dev secret is `OMS_HANDOFF_SECRET` (server-only)
   precisely so the dummy can't normalise the mistake.
2. **Never post the token to a wildcard target.** `postMessage(token, "*")` delivers it to
   whatever origin happens to occupy the frame. Always the exact origin.
3. **Validate every inbound message on three axes** before reading it: `event.origin` against the
   allowlist, `event.source === window.parent`, and the `source`/`v` envelope. Dropping any one
   of the three turns the channel into an injection point.
4. **The session token lives in memory only.** Not `localStorage`, not `sessionStorage`, not a
   cookie. XSS can read both web storages; a reload costs one handshake, which is free.
5. **No token in the URL.** Not a query string, not a path. URLs reach `Referer` headers, server
   logs, browser history and the analytics of whatever loads next.
6. **The handoff token is single-use and ≤ 120 s.** Enforced by `jti` on the OMS backend, not by
   convention.
7. **Identity comes from the token, server-side, on every request.** Never from a body field,
   query parameter or header the client controls (§11).
8. **`404`, not `403`, for another merchant's order.** `403` confirms the ID exists, which turns
   the detail route into an order-ID oracle.
9. **`frame-ancestors` stays enforced.** `next.config.ts` already allows framing only on
   `/embed/*`, and only from `NEXT_PUBLIC_EMBED_HOST_ORIGINS`. The dashboard and the rider portal
   are `'self'` and must stay that way — the rider portal has no login, so it must not be
   framable.
10. **Failure messages say nothing diagnostic.** The §7.7 copy never reveals which check failed.
11. **Clock skew is tolerated, not assumed away.** ±60 s on `exp`/`iat`/`nbf`. Without it, a
    minute of drift on a merchant's laptop looks like a broken integration.
12. **`/validate` stays unauthenticated** — and therefore keeps its own guard: the 5-attempt
    limit, enforced server-side (domain rule 8), never trusted from the client.

---

## 13. Environment variables

| Variable | Where | Default | Purpose |
|---|---|---|---|
| `NEXT_PUBLIC_AUTH_MODE` | OMS, client | `mock` | `host` (real handshake) or `mock` (dev issuer) |
| `NEXT_PUBLIC_OMS_API_BASE` | OMS, client | `/api/mock` | OMS API base — **exists** |
| `NEXT_PUBLIC_EMBED_HOST_ORIGINS` | OMS, client | `http://localhost:4200` | Comma-separated. Both `frame-ancestors` **and** the postMessage allowlist — **exists** |
| `OMS_HANDOFF_SECRET` | OMS, **server only** | dev value | HMAC key for the dummy issuer. Deleted at cutover |

`NEXT_PUBLIC_EMBED_HOST_ORIGINS` exists today, but only as a local const inside
`next.config.ts`. The bridge needs the parsed list at runtime, so `src/config/env.ts` gains its
own `EMBED_HOST_ORIGINS` export (§10.4). That is the one place in this design where a variable is
parsed twice — `next.config.ts` is loaded before the tsconfig path aliases, so it cannot import
`@/config/env`. Both halves govern the same trust decision: who may frame OMS, and whose messages
OMS will read. They must not diverge.

Additions to `.env.example`:

```bash
# Where the handoff token comes from. `mock` uses the in-repo dev issuer, so OMS boots with no
# portal and no backend; `host` is the real postMessage handshake with the Fonepoints portal.
# Both run the same exchange, refresh and failure paths.
NEXT_PUBLIC_AUTH_MODE=mock

# Origins allowed to frame OMS AND to send it a handoff token. Comma-separated.
NEXT_PUBLIC_EMBED_HOST_ORIGINS=http://localhost:4200

# HMAC key for the DUMMY handoff issuer. Server-only — never prefix this NEXT_PUBLIC_, or it is
# inlined into the browser bundle. Deleted with the mock when real auth lands.
OMS_HANDOFF_SECRET=dev-only-not-a-real-secret
```

On the portal side, `OMS_ORIGIN` in `fonepoints-business/src/app/core/config.ts` becomes
environment-driven rather than a hard-coded `http://localhost:3000`.

---

## 14. Build order

Each phase ends green on `npm run lint && npm run tsc:check && npm run test:run`.

| Phase | Work | Done when |
|---|---|---|
| **1 — Protocol & types** | `lib/auth/types.ts`, `messages.ts`, `session-store.ts`. Boundary entry in `eslint.boundaries.mjs`. Unit tests for the type guards (envelope rejection) and single-flight refresh. | Pure TS, no React, tests green |
| **2 — Dummy issuer** | `api/mock/dev/handoff`, `api/mock/auth/{session,refresh,me}`, `_tokens.ts` with HMAC + `jti` set + scenarios. | `curl` mints a token and exchanges it; a second exchange returns `grant_replayed` |
| **3 — Bridge & provider** | `host-bridge.ts`, `mock-bridge.ts`, `lib/api/auth.ts`, `AuthProvider`, bearer + 401 retry in `client.ts`. | `AUTH_MODE=mock` boots the queue with a real session; `?authScenario=short-session` shows a refresh in the network panel |
| **4 — Gate & identity** | `features/auth` (`AuthGate`, `AuthBoot`, `useMerchant`, `useCan`). Delete `SessionProvider`. Apply §11.1 and §11.2. Migrate the five call sites: `merchant-shell.tsx`, `order-queue-page.tsx`, `order-detail-page.tsx`, `order-list-panel.tsx`, `order-status-action.tsx`. | No `useSession` import remains; no request body carries `actor` or `merchantId` |
| **5 — Failure states** | The nine §7.7 states. Walk every `?authScenario=`. | Each scenario shows its state; **Try again** recovers |
| **6 — Portal integration** | Parent-side handshake in `oms-page.ts`, portal `/api/oms/handoff` stub, theme push. `AUTH_MODE=host`. | The portal at :4200 boots OMS at :3000 through the real handshake; reloading the iframe re-mints |
| **7 — Routing** | `oms.route.changed`, `host.route.request`. Theme is already done (section 9). | The portal breadcrumb follows the OMS route |

Phases 1–5 need no portal and no backend. Phase 6 needs the Angular team — though the channel,
the envelope and the `oms.ready` handshake it depends on are already built and verified by the
theme work in section 9, so phase 6 adds the grant to a conversation that already runs.

---

## 15. To agree with the other teams

Each line blocks cutover, not the build. Phases 1–5 proceed on the values in this document.

### With the Fonepoints backend team

| # | Question | Our assumption |
|---|---|---|
| 1 | `iss` / `aud` strings | `fonepoints` / `fonepoints-oms` |
| 2 | Handoff token lifetime | 90 s |
| 3 | Algorithm and `kid`-based rotation | HS256 with the shared secret, `kid` in the header |
| 4 | Exact claim names | `sub`, `merchant_id`, `roles`, `jti`, `ver` (§5) |
| 5 | Handoff endpoint path and auth scheme | `POST /oms/handoff`, portal session |
| 6 | Multi-merchant users — does the portal pass `merchantId`? | optional in the request; one merchant per session for now |

> One factor worth putting on the record, since it is a backend-only choice: a **shared symmetric
> secret means both services can mint tokens the other will accept**, so a compromise on either
> side forges sessions on both, and rotation needs coordinated deploys. Asymmetric signing
> (Fonepoints holds a private key, OMS only the public key) removes both properties. **The
> frontend is identical either way** — it never sees the key — so this can be decided late and
> changed later without touching OMS. Building to the agreed shared-secret design now.

### With the OMS backend team

| # | Question | Our assumption |
|---|---|---|
| 7 | Access and refresh lifetimes | 15 min / 8 h, refresh rotating |
| 8 | Is `/auth/session` the agreed path and body? | `POST /auth/session { handoffToken }` (§4.1) |
| 9 | Permission strings | `orders:read`, `orders:fulfil`, `orders:override` |
| 10 | Do Providhy sales-order statuses (`draft → submitted_for_approval → approved`) coexist with fulfillment statuses? | out of scope; additive later if so (carried from `omsContext.md`) |
| 11 | Does `/validate` stay unauthenticated? | yes — the rider has no account |

### With the Angular portal team

| # | Question | Our assumption |
|---|---|---|
| 12 | Message names, envelope and `v` (§8) | as specified |
| 13 | Will the portal re-mint on **every** `oms.ready`, including reloads? | yes — required; a cached grant fails as a replay |
| 14 | Production OMS origin, for both `frame-ancestors` and the message allowlist | `https://oms.fonepoints.com` |
| 15 | Does the portal get a theme switcher, and will it push `host.theme`? | not yet; §9 is a no-op until it does |
| 16 | `#theme=dark` on the iframe URL to avoid the first-paint flash (§9)? | wanted, portal-side change |
| 17 | Deep-linking an order from the host URL | needs `host.route.request` + `oms.route.changed`; today the portal stays on `/oms` (carried from `omsContext.md`) |

---

## 16. What does not change

So reviewers can tell scope creep from the work:

- **No login page, ever.** Not a route, not a fallback, not a dev convenience. The host is the
  only identity source, and the only recovery path.
- **The rider portal stays public.** `/deliver` has no account and no session. Its guard is the
  5-attempt limit.
- **The domain layer is untouched.** Auth is not a business rule, so nothing under
  `src/lib/domain/` gains React, a fetch or a token.
- **`src/lib/api/contracts.ts` response shapes are untouched**, apart from removing the two
  client-supplied identity fields in §11.
- **No new UI library and no new component.** Boot and failure states reuse `ErrorState`,
  `Spinner` and the existing tokens.
- **The queue, detail, mark-ready and rider screens are untouched** beyond deleting the five
  `useSession` reads.
- **`/backup-orders` stays frozen.** It keeps its own `TokenProvider` and its lint exemption. Its
  `postMessage` constants target **apps-frontend**, not the Angular portal, so they are reference
  only — §8 is the protocol, not that file.
- **The 300–800 ms mock latency stays.** Auth adds two round trips at boot, and the loading
  states need to be visible under the same conditions as the rest of the app.
