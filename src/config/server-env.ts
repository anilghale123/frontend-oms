import "server-only";

/**
 * Server-only configuration: values that must never reach the browser bundle.
 *
 * Separate from `@/config/env` because that module is imported by client components
 * (`EMBED_HOST_ORIGINS` in `HostSync`). A non-`NEXT_PUBLIC_` variable read there would be
 * `undefined` in the browser and fail silently; here the `server-only` import turns an accidental
 * client import into a build error instead.
 *
 * Read by the route handlers in `src/app/api` — the only code that holds the access token or
 * talks to the Sales service.
 */

const IS_PRODUCTION = process.env.NODE_ENV === "production";

/** The development Sales service, used when `OMS_SALES_URL` is not set outside production. */
const DEV_SALES_URL = "https://dev-sales-api.providhy.com/";

/**
 * The Sales service, `{SALES_URL}` in `src/api.md`. Always ends in `/`.
 *
 * The browser never calls it: screens go through this app's `/api/oms/*` proxy, which attaches
 * the token and forwards here, so neither CORS nor the backend's allowed origins come into it.
 *
 * Outside production it defaults to the development Sales service. A production build has no
 * default — guessing a host there would turn a configuration mistake into a confusing network
 * error — so the proxy answers 503 with `SALES_CONFIG_PROBLEM` instead.
 */
const sales = readSalesUrl(process.env.OMS_SALES_URL);

export const SALES_URL = sales.url;

/** Why `SALES_URL` is empty, in words for the screen; `null` when it is set. */
export const SALES_CONFIG_PROBLEM = sales.problem;

/** `{SALES_URL}api/oms/portal/` — every merchant-portal endpoint lives under it. */
export const SALES_PORTAL_API = SALES_URL ? `${SALES_URL}api/oms/portal/` : "";

/** `{SALES_URL}api/oms/rider/` — the rider's delivery confirmation. No token: riders have none. */
export const SALES_RIDER_API = SALES_URL ? `${SALES_URL}api/oms/rider/` : "";

/**
 * How long to wait for the Sales service before giving up. An error in seconds is more useful
 * than a spinner that never ends.
 */
export const UPSTREAM_TIMEOUT_MS = 15_000;

/**
 * Cloudflare's always-passing test secret, used when `TURNSTILE_SECRET_KEY` is not set outside
 * production. It accepts any token, so in development the check always passes; it pairs with the
 * test site key `@/config/env` defaults to. A real site key needs its real secret.
 */
const DEV_TURNSTILE_SECRET_KEY = "1x0000000000000000000000000000000AA";

/**
 * The Cloudflare Turnstile secret for the rider's bot check (`/api/rider/deliver`). The rider's
 * Order ID + voucher pair is the only credential on that route, so without this check anyone
 * could post guesses at a voucher code all day.
 *
 * Same rule as `OMS_SALES_URL`: a development default, none in production. A production build
 * without it answers 503 with `TURNSTILE_CONFIG_PROBLEM` rather than skip the check — a bot
 * check that quietly turns itself off is worse than none, because everyone believes it is on.
 */
const turnstileSecret =
	process.env.TURNSTILE_SECRET_KEY?.trim() || (IS_PRODUCTION ? "" : DEV_TURNSTILE_SECRET_KEY);

export const TURNSTILE_SECRET_KEY = turnstileSecret;

/** Why `TURNSTILE_SECRET_KEY` is empty, in words for the screen; `null` when it is set. */
export const TURNSTILE_CONFIG_PROBLEM = turnstileSecret
	? null
	: "TURNSTILE_SECRET_KEY is not set. Set the Turnstile secret key for this site and restart.";

/** Cloudflare's endpoint that checks a Turnstile token. Each token passes once, within 5 minutes. */
export const TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify";

/**
 * Shown when the Sales service cannot be reached. Development names the address, because the
 * usual cause there is a wrong `OMS_SALES_URL` or no network; production does not, because a
 * backend address is nobody's business on a merchant's screen.
 */
export function salesUnreachableMessage(): string {
	return IS_PRODUCTION
		? "Couldn't reach OMS. Check your connection and try again."
		: `Couldn't reach the Sales service at ${SALES_URL}. Check OMS_SALES_URL and your network.`;
}

function readSalesUrl(raw: string | undefined): { url: string; problem: string | null } {
	const value = raw?.trim() || (IS_PRODUCTION ? "" : DEV_SALES_URL);
	if (!value) {
		return {
			url: "",
			problem: "OMS_SALES_URL is not set. Set the Sales service's address and restart.",
		};
	}

	try {
		const parsed = new URL(value);
		if (parsed.protocol !== "http:" && parsed.protocol !== "https:") throw new Error("protocol");
		// `{SALES_URL}` ends in `/` by definition, and every path is appended to it.
		return { url: parsed.href.endsWith("/") ? parsed.href : `${parsed.href}/`, problem: null };
	} catch {
		return {
			url: "",
			problem: `OMS_SALES_URL ("${value}") is not a valid http(s) URL. Use the form ${DEV_SALES_URL} and restart.`,
		};
	}
}
