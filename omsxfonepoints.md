# OMS × Fonepoints Business — how the two apps talk

Two separate applications, two separate repos, two separate dev servers. This is the complete
story of how they communicate: which function calls which, in what order, and who owns each step.

> **What's live:** the channel itself and theme sync are **built and verified on both sides**. The
> auth half rides the *same* channel and is designed but not wired — §10 shows where it slots in.

---

## How to read this file

Every step is tagged with **who is responsible**:

| Tag | Means |
|---|---|
| 🟦 **FONEPOINTS** | The Angular portal, `fonepoints-business`, `localhost:4200` |
| 🟩 **OMS** | The Next.js app, `oms-frontend`, `localhost:3000` |
| ⬜ **BROWSER** | Neither app — the browser enforcing a rule |

---

## 1. The two apps

| | 🟦 **Fonepoints Business portal** | 🟩 **OMS** |
|---|---|---|
| Repo | `fonepoints-business` | `oms-frontend` |
| Stack | Angular (signals) | Next.js 16 (App Router, React 19) |
| Dev server | `http://localhost:4200` | `http://localhost:3000` |
| Role | **Parent** — owns sidebar, top bar, chrome, theme | **Child** — owns the order queue |
| In the DOM | renders the `<iframe>` | lives inside the `<iframe>` |

They are **different origins**. That's the entire reason this is complicated: a page on `:4200`
cannot reach into a page on `:3000` — no shared variables, no function calls, no DOM access. The
browser forbids it.

**`window.postMessage` is the only door between them.** It is a one-way message drop. There is no
return value, no promise, no "reply" built in. If you want an answer, you listen for a separate
message coming back.

Everything below is built on that one primitive.

---

## 2. The channel, broken down

### 2.1 The whole conversation, with the functions that drive it

Read top to bottom. The left column is the portal, the right is OMS.

```
 🟦 FONEPOINTS (:4200)                              🟩 OMS (:3000)
 ════════════════════════                           ═══════════════════

 OmsPage
  │
  ├── embedUrl() ..................... builds  http://…/embed/orders#theme=dark
  │
  ├── register(frame) ................ bridge now has a window to talk to
  │
  └── <iframe src="…"> ───────────────────────►  Next serves  /embed/orders
                                                      │
          ⬜ BROWSER checks  frame-ancestors  ◄────────┤  next.config.ts sends the CSP
                                                      │
                                                 APPEARANCE_BOOT_SCRIPT
                                                      │  reads #theme, paints before React
                                                      ▼
      onLoad() ◄──────── load event ─────────────  page is up, spinner hidden
                                                      │
                                                 AppearanceSync
                                                      │  hostOwnsAppearance() → true
                                                      │  so it does NOTHING
                                                      ▼
                                                 EmbedLayout
                                                      └── HostSync
                                                            │
                                                            ├── createHostChannel()
                                                            ├── channel.on("host.theme", fn)
                                                            └── channel.start()
                                                                  │
                                                                  └── send({type:"oms.ready"})
                                                                        │
                                                                        │  postMessage
  OmsBridge.onMessage()  ◄───────── { source:"fonepoints-oms", v:1, ────┘
      │                              type:"oms.ready" }
      ├── 3 validation checks
      ├── ready.set(true)
      │
      └── sendTheme(mode, accent)
            │  postMessage
            └──── { source:"fonepoints-host", v:1, ────►  channel.onMessage()
                    type:"host.theme",                      │
                    mode:"dark", accent:"emerald" }         ├── 3 validation checks
                                                            ├── parentOrigin = event.origin
                                                            └── dispatch()
                                                                  │
                                                                  └── HostSync's handler
                                                                        │
                                                                        ├── isHostThemeMode()
                                                                        ├── loadAppearance()
                                                                        ├── asAppearanceTheme()
                                                                        └── applyAppearance()
                                                                              ▼
                                                                        🎨 OMS turns dark
```

Notice the shape: **OMS speaks first, the portal answers.** §4 step 8 explains why it has to be
that way round.

---

### 2.2 Who holds which half

Each app has exactly one module that owns its side of the channel.

```
  🟦 FONEPOINTS                             🟩 OMS
  core/oms-bridge.ts                        lib/host/channel.ts
  ┌───────────────────────────────┐         ┌───────────────────────────────┐
  │ register(frame)   ← wire up   │         │ embedded      ← am I framed?  │
  │ embedUrl()        ← the URL   │         │ start()       ← listen+announce│
  │ onMessage()       ← inbound   │         │ on(type, fn)  ← subscribe     │
  │ sendTheme()       ← outbound  │         │ send(message)  ← outbound     │
  │ connected         ← status    │         │ (dispatch)    ← route inbound │
  └───────────────────────────────┘         └───────────────────────────────┘
            ▲                                           ▲
            │ injected into                             │ called by
            │                                           │
  pages/oms/oms-page.ts                       providers/HostSync.tsx
  core/theme.ts                               lib/host/messages.ts (the guards)
```

The two are **not** mirror images, and the difference is instructive:

| | 🟦 Portal | 🟩 OMS |
|---|---|---|
| Knows the other's origin? | **Yes** — `OMS_ORIGIN`, a constant | **No** — must wait and learn it |
| Opens the channel when? | At construction, always listening | Only when framed (`embedded`) |
| Handler style | One `if` per message type, inline | A `Map` of subscribers (`on`) |
| Shape | An Angular **service** (singleton) | A **closure** returned by a factory |

OMS needs the subscriber map because the auth phase will add a second listener (`host.auth.grant`)
alongside the theme one. The portal can stay with inline `if`s because it only ever *answers*.

---

### 2.3 Outbound from OMS — what `send()` actually does

```
 HostSync                channel.send()                      window.parent
    │                         │                                   │
    │ send({type:"oms.ready"})│                                   │
    ├────────────────────────►│                                   │
    │                         │ if (!embedded) return;             │
    │                         │                                   │
    │                         │ targets = parentOrigin             │
    │                         │   ? [parentOrigin]   ← known       │
    │                         │   : allowedOrigins   ← still probing
    │                         │                                   │
    │                         │ for (target of targets)            │
    │                         │   try { postMessage({             │
    │                         │     source: "fonepoints-oms",      │
    │                         │     v: 1,                          │
    │                         │     ...message                     │
    │                         │   }, target) } catch {}  ──────────►│
```

**Why the loop.** On the very first send, OMS doesn't yet know which origin holds the frame. So it
tries each allowed origin in turn; a mismatched target **throws instead of delivering**, which the
`catch` swallows so the remaining candidates still get a turn.

Once any valid inbound message arrives, `parentOrigin` is recorded and the loop collapses to one
exact target.

**Why not just `postMessage(msg, "*")`?** One line shorter, and it hands the message to whatever
origin happens to occupy the frame. Harmless for a theme. Catastrophic once this channel carries a
token.

---

### 2.4 Inbound to OMS — what `onMessage()` and `dispatch()` do

```
 window "message" event
    │
    ▼
 channel.onMessage(event)
    │
    ├── allowedOrigins.includes(event.origin) ?   ──── no ──► drop silently
    ├── event.source === window.parent ?          ──── no ──► drop silently
    ├── isHostMessage(event.data) ?               ──── no ──► drop silently
    │        └── source === "fonepoints-host" && v === 1 && typeof type === "string"
    │
    ├── parentOrigin = event.origin        ← remember, for future sends
    │
    └── dispatch(message, origin)
           │
           ├── handlers.get(message.type)    ← the Map from on()
           │        └── none? return
           │
           └── for (fn of [...set]) fn(message, origin)
                                  ▲
                                  └── a COPY, so a handler that unsubscribes
                                      mid-dispatch can't mutate what we iterate
```

**That third check earns its keep.** Next's HMR client, React DevTools and browser extensions
**all** post messages to this window. Without the envelope check, the theme handler would run on
their traffic.

---

## 3. Folder map — where everything lives

### 🟦 Portal side (`fonepoints-business`)

| Location | Prime job |
|---|---|
| `src/app/core/config.ts` | **The contract constants.** OMS's origin, the embed URL, the three protocol constants. If OMS moves host, this is the only file to touch. |
| `src/app/core/oms-bridge.ts` | **The portal's whole half of the channel.** Listens, validates, answers, pushes theme. One injectable service. |
| `src/app/core/theme.ts` | **Owns appearance for the whole window.** Mode, accent, `resolved()`. Writes the DOM *and* feeds the bridge. |
| `src/app/pages/oms/oms-page.ts` | **Mounts the iframe** and hands it to the bridge. Owns the loading and failure overlays. |
| `src/app/shared/settings-dialog.ts` | Theme picker UI. Also shows whether OMS answered — the integration is visible without devtools. |
| `src/app/core/nav.ts` | The sidebar entry that routes to `OmsPage`. |

### 🟩 OMS side (`oms-frontend`)

| Location | Prime job |
|---|---|
| `src/lib/host/messages.ts` | **The protocol as types.** Constants, the two message unions, the guards that validate inbound data. No transport, no React. |
| `src/lib/host/channel.ts` | **The transport.** `createHostChannel()` — listener, origin checks, `send`, `on`, `dispatch`. No React. |
| `src/providers/HostSync.tsx` | **The React glue.** Opens the channel, subscribes to `host.theme`, applies it. Renders `null`. |
| `src/app/embed/layout.tsx` | **The embedded surface.** Mounts `HostSync`, renders no shell, prefixes order links with `/embed`. |
| `src/lib/appearance.ts` | OMS's own appearance system + `hostOwnsAppearance()`, the guard that stops the two systems fighting. |
| `src/components/layout/appearance-sync.tsx` | OMS's *standalone* theme sync — deliberately **stands down** inside the iframe. |
| `next.config.ts` | **`frame-ancestors` CSP.** Without this the browser refuses to frame OMS at all. |
| `src/config/env.ts` | `EMBED_HOST_ORIGINS` — who may frame us *and* whose messages we read. |

### The division that matters

On the OMS side, `src/lib/host/` contains **no React**. `messages.ts` is types and functions;
`channel.ts` is a closure over a `Map`. All the React lives in one 62-line file, `HostSync.tsx`.

That isn't tidiness for its own sake. It means the protocol is unit-testable with no DOM and no
renderer (`messages.test.ts` does exactly that), and when auth arrives,
`lib/auth/host-bridge.ts` can build on the same channel without pulling React into the auth layer.

---

## 4. The user journey, step by step

A merchant opens the portal and clicks **OMS**. Every call, in order, tagged with its owner.

---

### Step 1 · 🟦 FONEPOINTS — `core/nav.ts` → router

Merchant clicks **OMS** in the portal sidebar. Angular's router activates `OmsPage`.

**Nothing has happened in OMS yet.** It isn't loaded.

---

### Step 2 · 🟦 FONEPOINTS — `OmsPage` calls `OmsBridge.embedUrl()`

```ts
protected src: SafeResourceUrl = this.sanitizer.bypassSecurityTrustResourceUrl(
  this.bridge.embedUrl(),
);
```

`embedUrl()` reads the current theme and appends it as a **fragment**:

```
http://localhost:3000/embed/orders#theme=dark&accent=emerald
```

**Two details.** A fragment (`#…`), not a query string — fragments are never sent to a server, so
this stays out of access logs and `Referer` headers. And it goes through `DomSanitizer` because
Angular blocks an iframe `src` it considers untrusted; safe here because the origin is our own
constant, never user input.

---

### Step 3 · 🟦 FONEPOINTS — `OmsPage` calls `OmsBridge.register(frame)`

```ts
effect(() => this.bridge.register(this.frame()?.nativeElement ?? null));
```

`register()` stores the element and **resets `ready` to false**. A fresh frame hasn't spoken yet,
and treating it as connected would mean posting a theme into a document that isn't listening.

The mirror is in `ngOnDestroy`: `register(null)`. Navigate away and the frame goes with it —
without that reset, a later theme change would post into a detached window.

---

### Step 4 · ⬜ BROWSER — the CSP decides

The browser requests the OMS URL. 🟩 Next serves `/embed/orders` with:

```
Content-Security-Policy: frame-ancestors 'self' http://localhost:4200
```

**This header is the gate.** If `:4200` weren't listed, the browser blanks the frame.

And here's the nasty part: **a refused frame never fires `load`.** There is no error event to
catch. Which is why 🟦 `OmsPage` carries a timeout:

```ts
private timeout = setTimeout(() => {
  if (!this.loaded()) this.failed.set(true);
}, 12000);
```

A timeout is the only signal the browser gives you. So: **if you see "OMS could not be loaded",
check `NEXT_PUBLIC_EMBED_HOST_ORIGINS` first.**

---

### Step 5 · 🟩 OMS — `APPEARANCE_BOOT_SCRIPT` runs before paint

Inline in OMS's root layout, before React exists:

```js
var h = new URLSearchParams(location.hash.slice(1));
var hm = h.get("theme");                    // ← the fragment from step 2
document.documentElement.classList.toggle("dark", !!d);
```

This is why a dark portal doesn't flash white. The fragment is a **pre-paint hint only** — the
authoritative value is the `host.theme` message arriving in step 12.

---

### Step 6 · 🟦 FONEPOINTS — `OmsPage.onLoad()` hides the spinner

The iframe's `load` event fires → `clearTimeout`, `loaded.set(true)`. The portal's "Loading OMS…"
overlay disappears.

---

### Step 7 · 🟩 OMS — `AppearanceSync` checks `hostOwnsAppearance()` and backs off

React mounts. OMS's root layout includes `AppearanceSync`, whose effect would normally apply the
merchant's **stored** appearance — instantly overwriting what the host just set in step 5.

So it asks first:

```ts
if (isAppearanceDrafting() || hostOwnsAppearance()) return;
```

```ts
export function hostOwnsAppearance() {
  return window.parent !== window && window.location.pathname.startsWith(EMBED_BASE_PATH);
}
```

Framed **and** on `/embed` → true → it does nothing. It also guards the global `D` dark-mode
shortcut, which would otherwise fight the next `host.theme` message.

> This is a **function of the environment**, not a flag one component sets for another —
> deliberately, because there is no mount order in which such a flag would be set early enough.
> `AppearanceSync` sits in the root layout and its effect runs *before* anything inside `/embed`.

---

### Step 8 · 🟩 OMS — `HostSync` calls `createHostChannel()`, then `on()`, then `start()`

```ts
const channel = createHostChannel(EMBED_HOST_ORIGINS);
if (!channel.embedded) return;                        // no-op when not framed

const offTheme = channel.on("host.theme", handler);   // 1. subscribe FIRST
const stop = channel.start();                         // 2. then announce
```

`channel.embedded` is just `window.parent !== window`. That one check is why mounting `HostSync` is
harmless on a non-framed page — every method becomes a no-op.

**Order matters.** Subscribe, *then* announce. Reverse it and the portal's reply can arrive before
any handler exists, and the theme is silently lost.

Then `start()` does two things:

```ts
window.addEventListener("message", onMessage);
send({ type: "oms.ready" });
```

**Why does the child speak first?** The portal has no way to know when the OMS bundle finished
parsing and attached its listener. If it sent first, the message could land in a document that
isn't listening and vanish — `postMessage` has no delivery guarantee and no retry.

So the protocol is inverted from what you'd expect: **the child knocks, the parent answers.**

---

### Step 9 · 🟩 OMS — `channel.send()` posts `oms.ready`

See §2.3 for the full breakdown. In short: `parentOrigin` is still null, so it posts to each
allowed origin in turn, in a try/catch.

---

### Step 10 · 🟦 FONEPOINTS — `OmsBridge.onMessage()` validates

The portal's listener fires. Three independent checks, **all required**:

```ts
if (event.origin !== OMS_ORIGIN) return;                               // 1. right origin?
if (!this.frame || event.source !== this.frame.contentWindow) return;  // 2. our frame?
if (message.source !== OMS_MESSAGE_SOURCE || message.v !== OMS_PROTOCOL_VERSION) return;  // 3. ours?
```

Then:

```ts
if (message.type === 'oms.ready') {
  this.ready.set(true);
  this.sendTheme(this.theme.resolved(), this.theme.accent());
}
```

Unknown message types **fall through silently** — on purpose. That's what lets OMS start sending
`oms.route.changed` before the portal knows the type exists.

---

### Step 11 · 🟦 FONEPOINTS — `OmsBridge.sendTheme()` posts back

```ts
target.postMessage(
  { source: HOST_MESSAGE_SOURCE, v: OMS_PROTOCOL_VERSION, type: 'host.theme', mode, accent },
  OMS_ORIGIN,   // ← the exact origin, never '*'
);
this.sentAt.set(new Date());
```

`sentAt` feeds Settings → Appearance, so you can watch the integration work without devtools.

---

### Step 12 · 🟩 OMS — `channel.onMessage()` → `dispatch()` → the handler

See §2.4 for the full breakdown. The three checks pass, `parentOrigin` is recorded, and `dispatch`
routes the message to `HostSync`'s handler.

---

### Step 13 · 🟩 OMS — `applyAppearance()` paints it

```ts
if (!isHostThemeMode(mode)) return;              // light | dark only

const current = loadAppearance();                // ← stored prefs, for the FONT
const hostAccent = asAppearanceTheme(accent, APPEARANCE_THEMES);

applyAppearance({ ...current, mode, theme: hostAccent ?? current.theme });
```

Three decisions packed into four lines:

- **`applyAppearance`, never `saveAppearance`.** The host's theme is **transient**. Persisting it
  would make it stick next time the merchant opens OMS standalone — a change they never made.
- **`loadAppearance()` first**, so the merchant's chosen **font** survives. The host has an opinion
  on mode and accent only.
- **`hostAccent ?? current.theme`** — an accent OMS doesn't recognise is *ignored, not guessed*.
  The accent is an opaque string on the wire, which is what lets the two apps ship independently.

---

### Step 14 · 🟩 OMS — the merchant uses it

The order queue renders. Clicking an order navigates **inside the frame**, because `EmbedLayout`
wraps everything in `OrderRoutesProvider basePath="/embed"` — otherwise a link would jump the
merchant out of the portal into the standalone dashboard.

---

### Step 15 · 🟦 FONEPOINTS — the merchant changes theme mid-session

They hit the portal's top-bar toggle → `Theme.toggle()` → the `mode` signal changes →
`resolved()` recomputes → the effect in `OmsBridge`'s constructor re-runs:

```ts
effect(() => {
  const mode = this.theme.resolved();
  const accent = this.theme.accent();
  if (this.ready()) this.sendTheme(mode, accent);   // ← only if OMS said it's listening
});
```

Reading both signals is what *subscribes* the effect to them. **The frame is never reloaded to
recolour it** — the fragment from step 2 is used for the initial `src` only.

Jump straight back to step 12: OMS validates and applies, exactly as before.

---

### Step 16 · 🟩 OMS — reload inside the frame

F5 inside the iframe, or an HMR reload in dev. OMS remounts and **sends `oms.ready` again** → the
portal answers again → OMS is themed again. Steps 8–13 simply repeat.

**This is the invariant the whole integration rests on.** The portal must treat `oms.ready` as a
question to be answered *every single time*, never cached. It's verified — "OMS is still dark after
reloading inside the frame" was one of the 14 browser checks.

It matters far more for auth, where the answer is a **single-use token**. See §10.

---

## 5. The journey as one table

| # | Who | File | Function |
|---|---|---|---|
| 1 | 🟦 | `core/nav.ts` | router activates `OmsPage` |
| 2 | 🟦 | `pages/oms/oms-page.ts` | `bridge.embedUrl()` |
| 3 | 🟦 | `pages/oms/oms-page.ts` | `bridge.register(frame)` |
| 4 | ⬜ | `next.config.ts` (🟩) | `frame-ancestors` check |
| 5 | 🟩 | `lib/appearance.ts` | `APPEARANCE_BOOT_SCRIPT` |
| 6 | 🟦 | `pages/oms/oms-page.ts` | `onLoad()` |
| 7 | 🟩 | `components/layout/appearance-sync.tsx` | `hostOwnsAppearance()` → stand down |
| 8 | 🟩 | `providers/HostSync.tsx` | `createHostChannel()`, `on()`, `start()` |
| 9 | 🟩 | `lib/host/channel.ts` | `send({type:"oms.ready"})` |
| 10 | 🟦 | `core/oms-bridge.ts` | `onMessage()` — 3 checks |
| 11 | 🟦 | `core/oms-bridge.ts` | `sendTheme(mode, accent)` |
| 12 | 🟩 | `lib/host/channel.ts` | `onMessage()` → `dispatch()` |
| 13 | 🟩 | `providers/HostSync.tsx` | `applyAppearance()` |
| 14 | 🟩 | `app/embed/layout.tsx` | `OrderRoutesProvider` keeps links inside |
| 15 | 🟦 | `core/theme.ts` | `toggle()` → effect → back to 11 |
| 16 | 🟩 | — | reload → back to 8 |

---

## 6. The function reference

### 🟦 `OmsBridge` — `src/app/core/oms-bridge.ts`

| Member | Visibility | Role |
|---|---|---|
| `register(frame)` | public | Attach/detach the iframe. Resets `ready`. Called by `OmsPage`. |
| `embedUrl(cacheBust?)` | public | Build the iframe URL with the theme fragment. |
| `onMessage(event)` | private | Validate inbound, answer `oms.ready`. |
| `sendTheme(mode, accent)` | private | Post `host.theme` to the exact origin. |
| `connected` | computed | Has OMS answered? For the settings dialog. |
| `lastSentAt` | computed | When the theme last went out. |
| constructor `effect()` | — | Push theme whenever it changes **and** OMS is ready. |

### 🟦 `Theme` — `src/app/core/theme.ts`

| Member | Role |
|---|---|
| `mode` / `accent` | Signals holding the raw choice (`mode` may be `"system"`). |
| `resolved()` | Computed — `"system"` collapsed to `light`/`dark`. **This is what OMS receives.** |
| `toggle()` | Flip light/dark. Triggers the bridge effect. |
| `setAccent(id)` | Change accent. Triggers the bridge effect. |
| `reset()` | Back to light + brand accent. |

### 🟩 `createHostChannel()` — `src/lib/host/channel.ts`

| Member | Role |
|---|---|
| `embedded` | `window.parent !== window`. False → every method is a no-op. |
| `start()` | Attach listener, announce `oms.ready`. Returns the detach function. |
| `send(message)` | Post one message, wrapped in the envelope, to the exact parent origin. |
| `on(type, handler)` | Subscribe to one message type. Returns unsubscribe. |

### 🟩 Guards — `src/lib/host/messages.ts`

| Function | Role |
|---|---|
| `isHostMessage(data)` | Is this our protocol at all? (`source` + `v` + a string `type`) |
| `isHostMessageOfType(msg, type)` | Narrow a validated message to one variant. |
| `isHostThemeMode(value)` | `"light"` or `"dark"` only. |
| `asAppearanceTheme(value, known)` | Map an opaque accent id to a known one, or `null`. |

---

## 7. The six constants that must match

Each repo keeps its **own copy**. There is deliberately no shared npm package — the two apps
deploy independently, and a receiver drops any message whose `source`/`v` it doesn't recognise,
which is what makes the duplication safe.

| Meaning | 🟦 `core/config.ts` | 🟩 `lib/host/messages.ts` | Value |
|---|---|---|---|
| Protocol version | `OMS_PROTOCOL_VERSION` | `PROTOCOL_VERSION` | `1` |
| OMS's `source` | `OMS_MESSAGE_SOURCE` | `OMS_SOURCE` | `"fonepoints-oms"` |
| Host's `source` | `HOST_MESSAGE_SOURCE` | `HOST_SOURCE` | `"fonepoints-host"` |
| OMS origin | `OMS_ORIGIN` | — | `http://localhost:3000` |
| Portal origin | — | `EMBED_HOST_ORIGINS` (env) | `http://localhost:4200` |
| Embed entry | `OMS_EMBED_URL` | `EMBED_BASE_PATH` | `/embed/orders`, `/embed` |

**One gotcha on the OMS side.** `EMBED_HOST_ORIGINS` is parsed **twice** — once in
`src/config/env.ts` for the message allowlist, once in `next.config.ts` for the CSP.
(`next.config.ts` loads before the tsconfig path aliases, so it can't import `@/config/env`.)

They are two halves of **one** trust decision: who may frame OMS, and whose messages OMS will
read. A list that allows framing but not messaging fails in a way that looks exactly like a bug in
the host.

---

## 8. The symmetry of the security checks

| | 🟦 Portal checks | 🟩 OMS checks |
|---|---|---|
| 1. Origin | `event.origin !== OMS_ORIGIN` | `!allowedOrigins.includes(event.origin)` |
| 2. Window | `event.source !== frame.contentWindow` | `event.source !== window.parent` |
| 3. Envelope | `source` + `v` | `isHostMessage(data)` |
| Send target | `OMS_ORIGIN` | `parentOrigin` (or the candidate list) |

**Why all three?** Origin alone is not enough — *any* document from that origin could post to this
window. The envelope alone is not enough — anyone can set a `source` field. The window check alone
is not enough — it doesn't tell you *who* that window belongs to.

Drop any one and the channel becomes an injection point.

---

## 9. What travels, and what deliberately doesn't

| Travels | Never travels |
|---|---|
| `oms.ready` (no payload) | Any order data |
| `host.theme` — mode + accent | Any customer data |
| *(designed)* `host.auth.grant` — a 90s single-use token | The portal's own session token |
| *(designed)* `oms.route.changed` — path + page title | Anything in the iframe URL |

`oms.route.changed` carries **only** the path and title, so the portal can update its breadcrumb.
The portal does not need, and should not receive, order or customer detail.

---

## 10. Where auth slots into all of this

The auth handshake is **the same channel, two more handlers.** Nothing above changes.

The message types are already declared in `lib/host/messages.ts`; only the handlers are missing:

```ts
// already in the union today, unhandled:
| { type: "host.auth.grant"; token: string; expiresAt: string }
| { type: "host.auth.denied"; reason: string }
```

It drops straight into §4 between steps 9 and 13:

```
Step 9    🟩 OMS  → oms.ready                        (already happens today)
            ↓
NEW       🟦 PORTAL: fetch a FRESH handoff token from the Fonepoints backend
NEW       🟦 PORTAL → host.auth.grant { token, expiresAt }
            ↓
NEW       🟩 OMS: POST /auth/session { handoffToken }  → access + refresh token
NEW       🟩 OMS  → oms.auth.ok { merchantId }
            ↓
Step 13   🟩 theme applies as normal
```

And when OMS's refresh chain is exhausted it posts `oms.auth.renew`, and the portal mints another
grant — which is why OMS needs no login page at all.

**This is why step 16 matters so much.** Theme sync forgives a portal that caches its answer; you
just get the wrong colour. Auth does not — the handoff token is **single-use**, so a cached answer
is rejected as a replay on the second `oms.ready`, and that looks exactly like a broken
integration.

On the OMS side the new code goes in `src/lib/auth/host-bridge.ts`, built **on**
`lib/host/channel.ts` — not beside it. One envelope, one listener, one set of origin checks.

---

## 11. Debugging it

| Symptom | Owner | Look at |
|---|---|---|
| "OMS could not be loaded" after 12s | 🟩 | `frame-ancestors` in `next.config.ts` — is `:4200` listed? |
| OMS loads but ignores the theme | 🟩 | Is `:4200` in `NEXT_PUBLIC_EMBED_HOST_ORIGINS`? (a *separate* parse from the CSP) |
| Theme works, then reverts | 🟩 | `hostOwnsAppearance()` returning false — is the path under `/embed`? |
| Flash of white, then correct | 🟦 | The fragment hint isn't reaching `APPEARANCE_BOOT_SCRIPT`. |
| Accent ignored, mode works | 🟩 | That accent id isn't in `APPEARANCE_THEMES`. Ignored by design. |
| Nothing at all | 🟩 | `channel.embedded` false — the page isn't actually framed. |
| Theme stops after navigating away and back | 🟦 | `register()` — did the new frame get registered? |

Fastest check that needs no devtools: the portal's **Settings → Appearance** shows whether OMS
answered and when the theme last went out. That's what `connected` and `lastSentAt` are for.

---

## 12. The five things to remember

1. **Different origins, so `postMessage` is the only door.** No shared state, no function calls.
2. **The child knocks first.** The parent can't know when OMS's JS ran, so OMS sends `oms.ready`
   and the portal answers.
3. **Every `oms.ready` gets a fresh answer** — including after a reload. Caching it is the #1 way
   this breaks, and it becomes fatal once a single-use token is the answer.
4. **Three checks on every inbound message, exact origin on every outbound one.** Both sides.
5. **The host owns the theme while framed**, applied transiently — which is why `AppearanceSync`
   stands down and Settings → Appearance is hidden on `/embed`.
