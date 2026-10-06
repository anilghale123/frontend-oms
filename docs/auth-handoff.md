# Authentication — the handoff, as built

> `docs/newAuth.md` is the brief this implements. `auth.md` at the repo root described an earlier,
> two-token design (a single-use handoff token exchanged for a short-lived session token plus a
> refresh round trip); **it is superseded.** The flow below has one token and no refresh, which is
> what the brief asked for and what removes most of the failure modes `auth.md` had to specify
> around. Its sections 8 (the message protocol), 9 (theme sync) and 12 (security rules) still hold
> — those parts were built as written.

Four services, each with one job.

| | Port | Repo | Job |
|---|---|---|---|
| Fonepoints Business portal | 4200 | `fonepoints-business` (Angular) | the merchant's window; frames OMS |
| Fonepoints backend | 4000 | `fonepoints-backend` (Express) | holds the OMS company API key |
| OMS frontend | 3000 | `oms-frontend` (Next.js) | the order screens; this repo |
| OMS backend | 3001 | `oms-backend` (Next.js) | issues tokens, owns the orders |

## The flow

```
                  ┌─────────────────── browser ───────────────────┐
                  │  portal (4200)                                │
  merchant        │    │                                          │
  presses OMS ────┼───▶│ 1. POST /api/oms/token ──────────┐        │
                  │    │    (portal session cookie)       │        │
                  │    │                                  ▼        │
                  │    │                      fonepoints backend (4000)
                  │    │                                  │        │
                  │    │                        2. x-api-key       │
                  │    │                                  ▼        │
                  │    │                          oms backend (3001)
                  │    │                                  │        │
                  │    │   3. access token ◀──────────────┘        │
                  │    │                                           │
                  │    ├── 4. postMessage host.auth.grant ──┐      │
                  │    │                                    ▼      │
                  │    │                        OMS iframe (3000)  │
                  │    │                                    │      │
                  │    │          5. POST /api/session ──────┤      │
                  │    │             → httpOnly cookie      │      │
                  │    │                                    │      │
                  │    │          6. GET /api/oms/orders ───┤      │
                  └────┴────────────────────────────────────┼──────┘
                                                            │
                                   proxy adds Bearer ───────┴──▶ oms backend (3001)
```

1. **The portal asks its own backend.** It cannot ask OMS: a browser holds no credential OMS
   accepts.
2. **The Fonepoints backend presents the company API key.** This is the only place that key is
   used, and it never reaches a browser.
3. **The OMS backend issues an access token** for the merchant the request named, after validating
   the key. The token **never expires**.
4. **The portal posts the token into the iframe** over the `postMessage` channel it already uses
   for the theme, as `host.auth.grant`, targeted at OMS's exact origin.
5. **OMS trades the token for an httpOnly cookie.** `POST /api/session` verifies it upstream
   first, then stores it.
6. **Every later request goes through `/api/oms/*`**, which reads the cookie server-side and
   attaches `Authorization: Bearer`.

## Why the token goes into a cookie

The brief said: *"as we need to handle accessToken from code, if we use sessionStorage then a route
change and back might restart the session, so instead we should use cookies."*

The cookie does more than survive navigation. Because it is set **by the server and read by the
server**, the token leaves page JavaScript entirely after step 5 — there is no store to read, and
it appears in no network panel and no client-side error report. That is why there is a proxy at
all: the cookie is only useful if something server-side is doing the reading.

Four flags, each answering a constraint of running in someone else's iframe
(`src/app/api/session/_cookie.ts`):

| Flag | Why |
|---|---|
| `httpOnly` | page JavaScript cannot read it; only `/api/oms/*` sees the token |
| `sameSite=none` | OMS is framed, so its own requests are third-party; `lax` would not be sent |
| `secure` | required for `sameSite=none`. Browsers treat `localhost` as secure, so dev works over HTTP |
| `partitioned` | CHIPS. Chrome blocks unpartitioned third-party cookies outright, and this keys the jar to the embedding site |
| *(no `maxAge`)* | a session cookie. The token does not expire, but there is no reason to leave a credential on disk |

`sameSite=none` means `SameSite` does no CSRF work, so `POST`/`DELETE` on `/api/session` and every
mutation through the proxy check the `Origin` header instead. Browsers always send it on a
mutating request and page script cannot change it.

### The fallback, and why it exists

A browser that refuses the partitioned cookie would leave the merchant looking at a sign-in failure
on a working setup. So `src/lib/auth/token.ts` also keeps the token in a **module variable**, and
the client sends it as `x-oms-token` when it is there; the proxy accepts either source.

It is memory only — not `localStorage`, not `sessionStorage`, not a readable cookie — so nothing
survives a reload and there is no stored credential for a later XSS to find. And the token arrived
over `postMessage` into that same JavaScript context, so it adds no exposure the handoff did not
already have. When cookies work, a reload re-reads the cookie and the fallback is never consulted.

## Why one non-expiring token and no refresh

The brief specified it, and it removes a class of problems rather than hiding them:

- **No refresh storm.** `auth.md` had to specify single-flight refresh because four parallel
  requests hitting a 401 together would otherwise fire four refreshes. There is no refresh.
- **No silent expiry mid-session.** A merchant who leaves a tab open over lunch comes back to a
  working page.
- **Revocation is exact.** The backend stores the token's hash and re-reads the record on every
  request, so a revoke takes effect on the *next call* — not whenever a signature would have
  expired. That is strictly better than a short-lived JWT, which cannot be withdrawn at all.

The portal session is what ends. When it does, the next handoff produces a new token and the old
one is revoked.

## What the frontend owns

```
src/
  lib/auth/
    types.ts                   MerchantProfile — no token field anywhere in it
    token.ts                   the in-memory fallback, and why it is acceptable
  app/api/
    session/route.ts           POST token → cookie · GET the session · DELETE revoke
    session/_cookie.ts         the cookie's name and flags, decided once
    session/_verify.ts         asks the OMS backend who a token belongs to
    session/dev/route.ts       development-only mint, for working without the portal
    oms/[...path]/route.ts     the proxy: reads the cookie, attaches the Bearer
  providers/
    HostChannelProvider.tsx    ONE postMessage channel, shared by auth and the theme
    AuthProvider.tsx           the boot sequence and the two token sources
    HostSync.tsx               follows the host's theme (unchanged, now on the shared channel)
  features/shell/
    components/session-gate.tsx   holds a surface back until there is a session
  config/
    server-env.ts              server-only values, behind `import "server-only"`
```

### The boot sequence

`AuthProvider` always tries the cookie first (`GET /api/session`). That is what makes a reload
inside the iframe free — the session is already proven, and nothing has to be said to the host.
Only with no valid cookie does the handoff run.

With no cookie, where a token comes from depends on the surface:

| Surface | `source` | No cookie → |
|---|---|---|
| `/embed/*` | `host` | wait for `host.auth.grant`; also send `oms.auth.renew` |
| `(merchant)` standalone | `standalone` | `POST /api/session/dev` — development only |
| `(rider)` `/deliver` | *no provider* | nothing. A rider has no account |

### Ordering, which is load-bearing

`HostChannelProvider` owns the single channel and calls `start()` — which posts `oms.ready` — in
its own effect. React runs **child** effects before **parent** effects, so `AuthProvider` and
`HostSync` have both subscribed by the time the announcement goes out. That is what makes it
impossible to miss the host's reply. Moving `start()` into the render body, or into a child, breaks
it.

The channel is shared for the same reason: two channels would mean two `oms.ready` messages, the
portal answering twice, and each half of the conversation hearing replies meant for the other.

### The rider surface has no session, deliberately

`/deliver` renders for someone holding only a link. The Order ID + voucher pair **is** the
credential, and requiring a merchant token would mean that token travelling to a rider's phone —
strictly worse, since the pair authorises exactly one delivery.

`validate`, `dev/voucher` and `dev/delivering` are therefore forwarded by the proxy with no token,
by name. Five attempts per Order ID — counted for Order IDs that do not exist too — and identical
responses for every failure are what contain an open endpoint.

## What this changed in existing code

Three things stopped being the client's business, and all three were previously taken on trust:

| Was | Now |
|---|---|
| `listOrders(merchantId)` — a query string the client chose | `listOrders()` — the token decides. Domain rule 14 is enforced, not requested |
| `UpdateOrderStatusRequest { status, actor, actorRole }` | `{ status }`. The actor comes from the token, so the activity log cannot be forged by the client writing to it |
| `SessionProvider` — a role in `localStorage` | `AuthProvider` — the merchant from the token. The sidebar company and activity actors both read from it |

The mock at `src/app/api/mock` was **kept**. Set `NEXT_PUBLIC_OMS_API_BASE=/api/mock` and the whole
app runs with no backends at all, which is still the quickest way to work on a screen.

### One deliberate exception to the data-flow rule

`AGENTS.md` rule 6 is *component → hook → `api.ts` → `lib/api/client`*. `AuthProvider` calls
`fetch` directly. The session is not a data query: it is a one-time boot sequence coupled to
`postMessage` timing, on routes (`/api/session`) that are not under `OMS_API_BASE`. Wrapping it in
TanStack Query would add a cache to something that must happen exactly once, in a known order.

## Running it

```bash
# oms-backend          npm run dev     :3001
# fonepoints-backend   npm run dev     :4000
# oms-frontend         npm run dev     :3000
# fonepoints-business  npm start       :4200
```

Nothing needs configuring to start: every value has a development default, and both backends
default to the same placeholder API key. `http://localhost:3001` says what is registered and what
is still a placeholder.

Then either open the portal at `http://localhost:4200` and press **OMS** — the real path — or open
`http://localhost:3000/orders` directly, which uses the development mint.

### Checking it

```bash
npm run verify:handoff
```

Walks the chain in order and checks the properties that are easy to lose in a refactor and hard to
notice: the cookie flags the iframe depends on, that one merchant cannot see another's orders, that
a cross-merchant lookup answers **404 rather than 403**, that a revoked token stops working at
once, and that the activity log records the token's merchant rather than whatever the request
claimed.

The one hop it cannot cover is the browser delivering a `postMessage` between two documents.
`src/providers/AuthProvider.test.tsx` covers that sequence in jsdom — cookie-first, grant exchange,
duplicate grants, denial, and the direct-visit case — and
`src/lib/host/channel.test.ts` covers the three validation axes (origin, `event.source`, envelope)
that a token on this channel depends on.

## Environment

`.env.example` in each repo is the full list. The three that matter:

| Variable | Where | |
|---|---|---|
| `OMS_COMPANY_API_KEY` | `oms-backend` | the company credential; only its hash is stored |
| `OMS_API_KEY` | `fonepoints-backend` | the same value. The whole chain fails if they differ |
| `MONGODB_URI` | `oms-backend` | **leave unset** to run on the in-memory store |

`OMS_AUTH_MODE=dev` in `oms-frontend` is what allows `/api/session/dev`. It is refused in
production whatever it is set to: a frontend that can mint its own sessions is not an
authentication boundary.

## Still to agree with the other teams

- **Order ingestion.** `POST /api/v1/orders` takes the company API key and is idempotent on
  `fonepointsReferenceId`. Who calls it when a redemption completes is not settled.
- **The portal's real identity.** Sign-in here is an email lookup with no password. What matters
  downstream is only `omsMerchantRef`, so replacing it touches `src/users.ts` and
  `src/routes/auth.ts` in `fonepoints-backend` and nothing else.
- **Merchant registration.** Reproduced from configuration on first boot
  (`oms-backend/src/data/bootstrap.ts`). A real deployment needs an operator-facing way to register
  a merchant and read back its `externalRef`.
