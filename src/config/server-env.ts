import "server-only";

/**
 * Server-only configuration: values that must never reach the browser bundle.
 *
 * Separate from `@/config/env` because that module is imported by client components
 * (`EMBED_HOST_ORIGINS` in `HostSync`). A non-`NEXT_PUBLIC_` variable read there would be
 * `undefined` in the browser and fail silently; here the `server-only` import turns an accidental
 * client import into a build error instead.
 *
 * Read by the route handlers in `src/app/api/session` and `src/app/api/oms` — the only code that
 * holds the access token or talks to the OMS backend.
 */

/**
 * Where the OMS backend answers. The browser never calls it: requests go to this app's
 * `/api/oms/*` proxy, which attaches the token from the cookie and forwards them. That is what
 * keeps the token out of page JavaScript and makes CORS unnecessary.
 */
export const OMS_BACKEND_URL = process.env.OMS_BACKEND_URL?.trim() || "http://localhost:3001";

/**
 * Where the access token comes from.
 *
 * - `host` — the real flow. The Fonepoints portal frames OMS and sends the token it obtained from
 *   its own backend over `postMessage`. Nothing else can produce a session.
 * - `dev` — additionally allows `POST /api/session/dev`, which mints a token by presenting the
 *   company API key from this server. It exists so the standalone dashboard at `/orders` still
 *   works with no portal running, which is most of local development.
 *
 * `dev` is the default outside production and is refused in production whatever it is set to,
 * because a frontend that can mint its own sessions is not an authentication boundary.
 */
const requested =
	process.env.OMS_AUTH_MODE?.trim() || (process.env.NODE_ENV === "production" ? "host" : "dev");

export const AUTH_MODE: "host" | "dev" =
	requested === "dev" && process.env.NODE_ENV !== "production" ? "dev" : "host";

/**
 * The company API key, used **only** by the `dev` mint above.
 *
 * In the real flow this key lives in the Fonepoints backend and this app never sees it. It is
 * accepted here as a local shortcut, which is exactly why `AUTH_MODE` cannot be `dev` in
 * production. Must match `OMS_COMPANY_API_KEY` in `oms-backend`.
 */
export const DEV_API_KEY =
	process.env.OMS_DEV_API_KEY?.trim() || "oms_ck_dev_fonepoints_replace_me";

/** Which merchant the `dev` mint signs in as. An `externalRef` from the OMS registration. */
export const DEV_MERCHANT_REF = process.env.OMS_DEV_MERCHANT_REF?.trim() || "fp-hamro-mobile";
