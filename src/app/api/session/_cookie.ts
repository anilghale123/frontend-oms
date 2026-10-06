import "server-only";
import { cookies } from "next/headers";

/**
 * The access-token cookie: the one place its name and attributes are decided.
 *
 * Every attribute here is answering a specific constraint of running in someone else's iframe:
 *
 * - **`httpOnly`** — page JavaScript cannot read it. After the handoff, the only code that sees
 *   the token is this app's server, in `/api/oms/*`. This is the whole reason the token goes into
 *   a cookie instead of staying in a variable.
 *
 * - **`sameSite: "none"` + `secure`** — OMS is framed by the portal, so from the browser's point
 *   of view every request OMS makes is a third-party one. `lax` would simply not be sent, and
 *   `none` is only honoured together with `secure`. Browsers treat `localhost` as a secure
 *   origin, so this works in development over plain HTTP; anywhere else it requires HTTPS.
 *
 * - **`partitioned`** — CHIPS. Modern Chrome blocks unpartitioned third-party cookies outright;
 *   `partitioned` opts into a cookie jar keyed to the embedding site, which is exactly the
 *   semantics wanted here. A session opened inside the portal belongs to the portal and is not
 *   shared with any other site that happens to frame OMS.
 *
 * - **no `maxAge`** — a session cookie, gone when the browser closes. The token itself does not
 *   expire (that is `oms-backend`'s decision), but there is no reason to leave a credential on
 *   disk for it; the handoff takes a round trip to repeat.
 *
 * `path: "/"` because the standalone dashboard, the embedded surface and `/api/oms/*` all need it.
 *
 * A browser that refuses the cookie is handled, not ignored: `@/lib/auth/token` keeps the token in
 * memory for that tab and the proxy accepts it as a bearer header.
 */

export const SESSION_COOKIE = "oms_at";

export async function setSessionCookie(token: string): Promise<void> {
	(await cookies()).set(SESSION_COOKIE, token, {
		httpOnly: true,
		secure: true,
		sameSite: "none",
		partitioned: true,
		path: "/",
	});
}

export async function readSessionCookie(): Promise<string | null> {
	return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function clearSessionCookie(): Promise<void> {
	(await cookies()).set(SESSION_COOKIE, "", {
		httpOnly: true,
		secure: true,
		sameSite: "none",
		partitioned: true,
		path: "/",
		maxAge: 0,
	});
}
