# Deploying the demo

Two frontends on Vercel, both backends on one small EC2 instance behind Caddy, MongoDB on Atlas.
No domain needed. This is a **demo** deployment: it is not hardened for real merchants (see the last
section).

```
Vercel                                       EC2 (Elastic IP, Caddy for HTTPS)
  portal-demo.vercel.app   (Angular)           api.<ip>.sslip.io      → fonepoints-backend :4000
  oms-demo.vercel.app      (Next.js)           oms-api.<ip>.sslip.io  → oms-backend        :3001
                                                              │
                                                       Atlas (MongoDB)
```

The URLs you will need, decided up front because they point at each other:

| Name | Example | Used by |
|---|---|---|
| `PORTAL_URL` | `https://portal-demo.vercel.app` | OMS frontend CSP, fonepoints-backend CORS |
| `OMS_URL` | `https://oms-demo.vercel.app` | the portal's iframe and its message checks |
| `API_URL` | `https://api.3-110-45-67.sslip.io` | the portal |
| `OMS_API_URL` | `https://oms-api.3-110-45-67.sslip.io` | the OMS frontend's server |

Create the two Vercel projects first (an empty deploy is fine) so you know the `*.vercel.app` names.

## 1. One shared secret

Generate the API key once. It goes in **two** places, and the chain fails if they differ:

```bash
node -e "console.log('oms_ck_' + require('crypto').randomBytes(24).toString('base64url'))"
```

Both backends refuse to run in production on the development placeholder, so you cannot skip this.

## 2. MongoDB Atlas

- Network Access: `0.0.0.0/0` is fine for a demo (the EC2 address would also work).
- Use the **standard** connection string (`mongodb://host1,host2,host3/?ssl=true&replicaSet=…`) if the
  `mongodb+srv://` one fails with `querySrv ECONNREFUSED`.
- **Rotate the database password** if it has ever been pasted into a chat or committed anywhere.

## 3. The VPS

An EC2 `t3.micro` (or `t2.micro`) with Ubuntu. Allocate an **Elastic IP** and attach it so the address
survives a stop/start. Security group: inbound 22 (your IP), 80, 443. **Not** 3001 or 4000.

```bash
# Node 24 (the Fonepoints backend runs TypeScript directly), pm2, Caddy
curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash - && sudo apt-get install -y nodejs git
sudo npm i -g pm2
sudo apt-get install -y caddy

# 1 GB of RAM is tight: add swap before building anything
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile

sudo mkdir -p /srv && sudo chown $USER /srv && cd /srv
git clone <oms-backend repo>
git clone <fonepoints-backend repo>
```

**oms-backend** — `/srv/oms-backend/.env.local`:

```bash
MONGODB_URI=<atlas uri>
MONGODB_DB=oms
OMS_COMPANY_API_KEY=<the key from step 1>
OMS_ENABLE_DEV_ROUTES=1     # the rider portal's simulated QR scan and "Simulate delivery"
```

```bash
cd /srv/oms-backend && npm ci && npm run build
```

**fonepoints-backend** — `/srv/fonepoints-backend/.env`:

```bash
PORT=4000
PORTAL_ORIGIN=<PORTAL_URL>
OMS_BASE_URL=http://localhost:3001          # same machine, never leaves the box
OMS_API_KEY=<the key from step 1>
SESSION_SAMESITE=none                       # the portal and this API are different sites
SESSION_SECURE=1
```

```bash
cd /srv/fonepoints-backend && npm ci
```

Start everything:

```bash
export VPS_HOST=3-110-45-67.sslip.io        # your Elastic IP, dots → dashes
sudo -E caddy run --config /srv/oms-frontend/deploy/Caddyfile   # or copy it to /etc/caddy/Caddyfile and `sudo systemctl reload caddy`
pm2 start /srv/oms-frontend/deploy/ecosystem.config.cjs && pm2 save && pm2 startup
```

Check it from your laptop:

```bash
curl https://oms-api.<ip>.sslip.io/api/v1/health     # store: "mongodb", usingPlaceholderApiKey: false
curl https://api.<ip>.sslip.io/api/health
```

## 4. Vercel — OMS frontend (this repo)

Root directory `.`; framework Next.js. Environment variables:

| Variable | Value |
|---|---|
| `OMS_BACKEND_URL` | `OMS_API_URL` |
| `NEXT_PUBLIC_EMBED_HOST_ORIGINS` | `PORTAL_URL` — **inlined at build time**, so set it before the first build |

Nothing else is needed. `OMS_AUTH_MODE` is forced to `host` in production, so opening
`OMS_URL/orders` directly shows "OMS opens from the Fonepoints portal" — that is correct.

## 5. Vercel — Angular portal (`fonepoints-business`)

Framework preset **Other**; `vercel.json` already sets the build command, output directory and the
SPA rewrite. Environment variables:

| Variable | Value |
|---|---|
| `OMS_ORIGIN` | `OMS_URL` (origin only: no path, no trailing slash) |
| `FONEPOINTS_API_URL` | `API_URL` |

`scripts/set-env.mjs` writes them into the bundle at build time and **fails the build** if either is
missing, rather than shipping the placeholders.

## 6. Check it

Open the portal, press **OMS**. The status line under Settings → Appearance should read "OMS accepted
the access token". If it does not:

| Symptom | Usual cause |
|---|---|
| OMS frame refuses to load | `NEXT_PUBLIC_EMBED_HOST_ORIGINS` wrong or set after the build — redeploy the OMS frontend |
| "Could not reach the Fonepoints backend" | `FONEPOINTS_API_URL` wrong, Caddy not running, or ports 80/443 closed |
| "OMS refused to issue an access token" | the two API keys differ, or `merchantRef` is not registered |
| Token accepted, then 502s | `OMS_BACKEND_URL` wrong, or Atlas rejecting the connection |
| Works in a normal window, fails in incognito | the iframe cookie is third-party; use Chrome/Edge without strict blocking |

`POST <OMS_API_URL>/api/v1/admin/reseed` with `x-api-key` puts the demo orders back to their start.

## What this is not

- **Sign-in is an email lookup with no password.** Anyone with the portal URL gets a merchant token.
  It shows seed data only, so this is acceptable for a demo; do not point real data at it.
- **`OMS_ENABLE_DEV_ROUTES=1` hands out voucher codes** to anyone who can reach the proxy. That is what
  makes the rider "Simulate delivery" demo work. Turn it off for anything else.
- **Cross-site cookies.** Without a shared parent domain the OMS iframe depends on `Partitioned`
  cookies. A custom domain under which both apps sit (`portal.x.com`, `oms.x.com`) makes them same-site
  and is the single biggest robustness upgrade if this outgrows a demo.
- **One instance, no monitoring, no backups beyond Atlas's own.**
