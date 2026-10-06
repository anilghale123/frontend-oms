# Auth, simply

How a merchant gets logged into OMS without ever seeing a login form.

> **Status:** this flow is **designed, not built yet**. The spec is [auth.md](auth.md); the full
> reference is [docs/frontend-integration.md](docs/frontend-integration.md). Today OMS uses a fake
> role in localStorage instead. Read this to understand what you are building toward.

---

## 1. The analogy (keep this in your head)

Imagine a **conference with two buildings**.

| In the analogy | In our system |
|---|---|
| **Main hall** — you're already badged in at the front desk | The **Fonepoints Business portal** (Angular) |
| **Workshop room** in the other building, run by a different team | **OMS** (our Next.js app) |
| A **one-time paper slip** the front desk writes for you | The **handoff token** |
| The **wristband** the workshop team gives you | The **access token** |
| A **stub** that gets you a new wristband without walking back | The **refresh token** |

The important bit: **the workshop team does not trust your main-hall badge.** They've never seen
it and can't verify it. What they *do* trust is a slip signed by the front desk, because the two
teams agreed on a secret signature beforehand.

So you don't carry your badge into the workshop. You carry a slip, you trade it for a wristband at
the door, and from then on you flash the wristband.

### Why the slip is so restricted

The slip says: *"Bearer is Hamro Mobile. Valid 90 seconds. One use only. — Front Desk ✍️"*

- **90 seconds**, because it's the only thing that physically travels between two buildings. If
  somebody picks it up off the floor, it's garbage by the time they reach the door.
- **One use**, because the workshop team writes down each slip's serial number. Present the same
  serial twice and you're turned away.

The wristband, by contrast, never leaves the workshop building — so it can last longer and be used
many times.

---

## 2. The journey, step by step

Our merchant is **Hamro Mobile**. They're already signed into the Fonepoints portal and they click
**OMS** in the sidebar.

---

### Step 1 — The click

**User sees:** the portal navigates to its OMS page.

**Nothing has happened in OMS yet.** It isn't loaded.

---

### Step 2 — The portal gets a slip

The portal asks its own backend for a handoff token:

```
PORTAL  →  POST /oms/handoff     (proves who it is with the portal session cookie)
FONEPOINTS BACKEND  →  { token: "eyJhbGc...", expiresAt: "2026-10-06T10:00:90Z" }
```

The Fonepoints backend signs that token with a secret **shared with the OMS backend**. That shared
secret is the whole basis of trust.

> 🔑 **Front desk writing the slip.** The portal cannot write its own slip — it has to ask the
> backend, because only the backend holds the signing secret.

---

### Step 3 — The portal opens the iframe

```html
<iframe src="https://oms.fonepoints.com/embed/orders#theme=dark&accent=emerald">
```

**The token is NOT in that URL.** Ever. URLs end up in server logs, browser history, `Referer`
headers and the analytics of whatever loads next. The `#theme=dark` part is just a colour hint so
OMS doesn't flash white inside a dark portal.

---

### Step 4 — OMS wakes up and shouts "I'm ready"

OMS mounts. It shows a small spinner — **"Connecting to Fonepoints…"** — and nothing else. No
sidebar, no order table.

Then it posts a message up to the portal:

```ts
{ source: "fonepoints-oms", v: 1, type: "oms.ready" }
```

**Why does the child speak first?** Because the portal has no way of knowing when our JavaScript
finished parsing. If the portal sent the slip first, it might arrive before OMS was listening and
vanish. So OMS announces itself, and the portal answers.

> 🚪 **You knocking on the workshop door.** The front desk can't know when you arrived, so you
> knock and they respond.

**This repeats on every reload.** Hit F5 inside the iframe and OMS shouts again — and the portal
must fetch a **brand new** slip. It cannot reuse the old one; that's the one-use rule, and the
most common way this integration breaks.

---

### Step 5 — The portal hands over the slip

```ts
{ source: "fonepoints-host", v: 1, type: "host.auth.grant",
  token: "eyJhbGc...", expiresAt: "..." }
```

Sent to **the exact OMS origin**, never `"*"`. A wildcard would hand the token to whatever page
happens to be in that frame.

Before OMS reads this message it checks **three** things:

```ts
if (!allowedOrigins.includes(event.origin)) return;  // 1. is this origin on our list?
if (event.source !== window.parent) return;          // 2. is it actually our parent frame?
if (!isHostMessage(event.data)) return;              // 3. is it our protocol at all?
```

All three are required. Note that **Next's hot reload, React DevTools and browser extensions all
post messages to this window too** — check 3 is what stops our handler running on their noise.

---

### Step 6 — OMS trades the slip for a wristband

Spinner text changes to **"Signing you in…"**.

```
OMS FRONTEND  →  POST /auth/session   { handoffToken: "eyJhbGc..." }
```

This is the **only** time the handoff token is used. It's spent now.

---

### Step 7 — The OMS backend checks the signature

The OMS backend verifies:

- the **signature** matches the shared secret → is this really from Fonepoints?
- **`exp`** hasn't passed (allowing ±60s for clock drift between machines)
- **`aud`** says this slip was meant for OMS
- the **`jti`** (serial number) hasn't been seen before → not a replay

If all pass:

```json
{ "accessToken": "...", "refreshToken": "...",
  "merchant": { "id": "mch_001", "name": "Hamro Mobile" },
  "user": { "name": "Anil" },
  "permissions": ["orders.read", "orders.fulfill"] }
```

> ⌚ **The wristband, plus a note of who you are and what you're allowed to do.**

---

### Step 8 — OMS renders

The frontend:

1. Keeps that session **in a plain variable in memory** — not localStorage, not a cookie
2. Sets a timer to refresh **60 seconds before** the access token expires
3. Tells the portal `oms.auth.ok` so it can hide its own spinner
4. Flips to `phase = "ready"` → **the order queue appears**

Total elapsed: a second or so. **Hamro Mobile never saw a form.**

From here, every API call carries the wristband:

```
GET /orders
Authorization: Bearer eyJhbGc...
```

---

## 3. Why the session lives in memory only

This looks like a bug the first time you see it: **reload the page and the session is gone.**

It's deliberate. Any XSS on the page can read `localStorage` and `sessionStorage`. A token sitting
there is a token an attacker can steal and use from their own machine.

And the cost of not storing it is **zero**, because a reload triggers `oms.ready` → new slip → new
wristband, automatically, in under a second. You get the security win for free.

---

## 4. When the wristband expires (15 minutes later)

Two paths, and both matter.

**Path A — the proactive timer.** At 14 minutes OMS quietly calls `/auth/refresh` with the refresh
token and gets a fresh pair. The merchant notices nothing.

**Path B — a 401 slipped through.** The access token expired before the timer fired (laptop was
asleep, say). An order request comes back `401`. So:

```
401 → refresh once → replay the original request → merchant never notices
```

### The trap: four requests, one refresh

The order queue page fires several queries at once. If all four expire together, all four get a
401 at the same instant — and a naive implementation sends **four** refresh calls. With rotating
refresh tokens, the first succeeds and the other three are rejected as stale, **killing a session
that was perfectly fine.**

The fix is called **single-flight** — the second, third and fourth callers wait on the *same*
promise instead of starting their own:

```ts
export function refreshSession() {
  if (refreshing) return refreshing;   // ← everyone shares the one in-flight attempt
  refreshing = refresher(token)
    .then((next) => { session = next; return next; })
    .catch(() => { session = null; onLost?.(); return null; })
    .finally(() => { refreshing = null; });
  return refreshing;
}
```

> 🎟️ **One person goes to the desk for the group, not four people forming four queues.**

### If the refresh itself fails

OMS does **not** redirect to a login page. There isn't one — and inside an iframe, navigating
would yank the frame somewhere the portal never asked for.

Instead it asks the portal for a new slip:

```
OMS  →  oms.auth.renew
PORTAL  →  host.auth.grant { fresh token }
```

**The recovery path is always the host.** That's the single reason OMS needs no login form at all.

---

## 5. Which function does what

| Function | What it does | Plain English |
|---|---|---|
| `bridge.requestGrant(signal)` | Posts `oms.ready`, waits for the grant, gives up after 8s | Knock on the door, wait for the slip |
| `exchangeHandoff(token)` | `POST /auth/session` | Trade slip for wristband |
| `setSession(next)` | Stores it in a module variable | Put the wristband on |
| `getAccessToken()` | Returns the current token | Read your wristband |
| `refreshSession()` | Single-flight refresh | Swap for a fresh wristband |
| `bridge.renew()` | Asks the host for another grant | Walk back to the front desk |
| `notify(msg)` | Sends a message up to the portal | Tell the organisers how it went |

**And one rule that matters more than all of these:** `getAccessToken()` is called in **exactly
one place** — inside `request()` in `src/lib/api/client.ts`. No component, no hook, no feature
file ever touches a token. If you ever find yourself importing it into a component, something has
gone wrong.

---

## 6. Which folder does what

```
src/lib/host/          THE WALKIE-TALKIE          ✅ built
  messages.ts            what the messages look like + type guards
  channel.ts             sending, receiving, origin checks
                         → no React in here, pure logic

src/lib/auth/          THE DOORMAN                ⬜ to build
  host-bridge.ts         gets the slip from the portal
  session-store.ts       holds the wristband, handles refresh
  mock-bridge.ts         a fake front desk for local dev
  types.ts               Session, AuthPhase, failure reasons
                         → no React, no fetch

src/lib/api/           THE ONE DOOR OUT
  client.ts              the only fetch() in the app — attaches the wristband
  auth.ts                /auth/session, /auth/refresh, /auth/me   ⬜ to build
  endpoints.ts           every URL path, in one place
  errors.ts              turns any backend error into one ApiError shape

src/providers/         APP-WIDE WIRING
  HostSync.tsx           theme from the portal                    ✅ built
  AuthProvider.tsx       runs the whole handshake, owns the phase  ⬜ to build
  QueryProvider.tsx      TanStack Query + cross-tab sync          ✅ built
  SessionProvider.tsx    the fake role — AuthProvider replaces it ⚠️ temporary

src/features/auth/     WHAT THE USER SEES         ⬜ to build
  auth-gate.tsx          shows children only when logged in
  auth-boot.tsx          the spinner and error screens
  use-auth-session.ts    useMerchant(), useCan()

src/app/embed/         THE IFRAME SURFACE         ✅ built
                         no sidebar — the portal supplies the chrome

src/app/api/mock/auth/ THE FAKE BACKEND           ⬜ to build, deleted at cutover
```

### The pattern behind that list

Read it top to bottom and you'll notice it goes **outward**: pure logic → network → app wiring →
React components. Nothing ever reaches back up.

That's why `session-store.ts` is a plain module with a module-level variable instead of a React
hook. `client.ts` needs to read the token, and `client.ts` cannot import React. Making the session
a hook would force the token-reading into a component, which breaks rule F3 above.

---

## 7. What the merchant sees if something breaks

`AuthGate` shows the order queue **only** when `phase === "ready"`. Otherwise, a centered panel:

| What went wrong | What they read |
|---|---|
| Still handshaking | "Connecting to Fonepoints…" |
| Trading the slip | "Signing you in…" |
| Portal never answered (8s) | "Couldn't connect to the Fonepoints portal." + **Try again** |
| Portal couldn't mint | "The portal couldn't start an OMS session." + **Try again** |
| Slip rejected / expired | "Your session has expired. Reopen OMS from the portal." + **Try again** |
| No OMS entitlement | "This account doesn't have access to OMS." |
| Opened outside the portal | "Open OMS from the Fonepoints portal." |

Two deliberate choices here. **None of this copy names a token, a claim or an HTTP code** — an
attacker probing OMS learns nothing about *which* check failed. And the two loading states are
visually quiet: the merchant already watched the portal's spinner, so a second big one reads as a
crash.

---

## 8. The habit to unlearn

Under the current mock, the frontend **tells the backend who it is**:

```ts
GET /orders?merchantId=merchant-a              // "trust me, I'm merchant A"
PATCH /orders/OMS-1005/status
  { status: "failed", actor: "Ram", actorRole: "cs-agent" }
```

That's fine for a prototype with a role switcher. The moment a real token exists it's a hole: I
can edit that request and read **your** orders, or write **your name** into the audit log.

So those fields get **deleted** — not validated, deleted:

```ts
GET /orders                                    // server reads the merchant from my token
PATCH /orders/OMS-1005/status  { status: "failed" }
```

> **An audit log whose actor is supplied by the client records nothing at all.**

This is why the three changes in §7 of the full doc have to ship **in the same commit** as the auth
work — the frontend must stop sending these fields exactly when the backend stops reading them.

---

## 9. If you remember five things

1. **No login form exists.** OMS inherits the portal's session through a one-time slip.
2. **The child knocks first** — and knocks again after every reload, so the portal must mint a
   fresh slip every time.
3. **Two tokens, two jobs.** The slip crosses between buildings (90s, one use). The wristband
   never leaves OMS (15 min, many uses).
4. **The token is attached in one file**, `lib/api/client.ts`, and read nowhere else.
5. **Recovery is always the host**, never a redirect — which is precisely why no login page is
   needed.
