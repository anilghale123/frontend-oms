import "server-only";
import { cookies } from "next/headers";

/**
 * The session cookie: the one place its name and attributes are decided.
 *
 * **`oms_at`** holds the access token. The proxy reads it and attaches it to every Sales call; its
 * presence is what "signed in" means. The token does not expire and arrived from the portal, which
 * got it from Providhy IAM, so it is stored as given — the first Sales call through the proxy is
 * where a bad one shows up, and a `401` there deletes it.
 *
 * Every attribute is answering a constraint of running in someone else's iframe:
 *
 * - **`httpOnly`** — page JavaScript cannot read it. After the handoff, the only code that sees
 *   the token is this app's server.
 *
 * - **`sameSite: "none"` + `secure`** — OMS is framed by the portal, so every request OMS makes is
 *   a third-party one. `lax` would not be sent, and `none` is only honoured with `secure`.
 *   Browsers treat `localhost` as secure, so development works over plain HTTP.
 *
 * - **`partitioned`** — CHIPS. The cookie jar is keyed to the embedding site: a session opened
 *   inside the portal belongs to the portal and is not shared with any other site.
 *
 * - **`maxAge` of 400 days** — persistent, so closing the browser does not end the session. It is
 *   removed only by portal sign-out (`/embed-signout` → `DELETE /api/session`), by the proxy when
 *   Sales refuses the token, or by the merchant clearing site data. 400 days is the longest
 *   browsers keep a cookie; some privacy settings clear partitioned storage sooner, in which case
 *   OMS simply asks the portal for a token again.
 *
 * `path: "/"` because the standalone dashboard, the embedded surface and `/api/oms/*` all need it.
 *
 * A browser that refuses the cookie is handled, not ignored: `@/lib/auth/token` keeps the token in
 * memory for that tab and the proxy accepts it as a bearer header.
 */

export const SESSION_COOKIE = "oms_at";

/** An earlier profile cookie. No longer written; cleared alongside the token so none is left behind. */
const LEGACY_MERCHANT_COOKIE = "oms_merchant";

/** 400 days, in seconds — the longest lifetime browsers accept for a cookie. */
const MAX_AGE = 400 * 24 * 60 * 60;

const ATTRIBUTES = {
	httpOnly: true,
	secure: true,
	sameSite: "none",
	partitioned: true,
	path: "/",
} as const;

export async function setSessionCookie(token: string): Promise<void> {
	(await cookies()).set(SESSION_COOKIE, token, { ...ATTRIBUTES, maxAge: MAX_AGE });
}

export async function readSessionCookie(): Promise<string | null> {
	return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function clearSessionCookie(): Promise<void> {
	const jar = await cookies();
	jar.set(SESSION_COOKIE, "", { ...ATTRIBUTES, maxAge: 0 });
	if (jar.has(LEGACY_MERCHANT_COOKIE))
		jar.set(LEGACY_MERCHANT_COOKIE, "", { ...ATTRIBUTES, maxAge: 0 });
}
