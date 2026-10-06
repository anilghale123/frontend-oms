/**
 * `/api/session` — where the handoff token becomes an OMS session.
 *
 * This is the hinge of the whole flow. The portal gave the iframe an access token over
 * `postMessage`; that token is in page JavaScript, which is the worst place for it. `POST` here
 * trades it for an httpOnly cookie, and from then on the token is only ever read by this app's
 * server.
 *
 *   POST   { token }  → verifies it upstream, sets the cookie, returns { merchant }
 *   GET              → the session the cookie already proves, or 401
 *   DELETE           → revokes the token upstream and clears the cookie
 *
 * `POST` verifies before it stores. Putting an unverified token in a cookie would turn every later
 * failure into a confusing one — the page would look signed in and every data request would 401.
 *
 * `GET` is what the frontend boots on. It is the reason a reload inside the iframe does not need
 * the host to say anything: the cookie is still there, and this route re-checks it.
 */

import { z } from "zod";
import { OMS_BACKEND_URL } from "@/config/server-env";
import { clearSessionCookie, readSessionCookie, setSessionCookie } from "./_cookie";
import { verifyToken } from "./_verify";

const bodySchema = z.object({ token: z.string().trim().min(1) });

function unauthorized(message: string) {
	return Response.json(
		{ error: { code: "unauthorized", message } },
		{ status: 401, headers: { "Cache-Control": "no-store" } },
	);
}

export async function POST(request: Request) {
	// Same-origin only. The handoff is posted by this app's own page, so a cross-site caller has
	// no business here — and without this check any site could seed a session cookie in a visitor's
	// browser with a token of its choosing.
	if (!isSameOrigin(request)) {
		return Response.json(
			{ error: { code: "forbidden", message: "Cross-origin request" } },
			{ status: 403 },
		);
	}

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return Response.json(
			{ error: { code: "invalid_body", message: "A token is required" } },
			{ status: 400 },
		);
	}

	const merchant = await verifyToken(parsed.data.token);
	if (!merchant) {
		return unauthorized("The access token was rejected");
	}

	await setSessionCookie(parsed.data.token);
	return Response.json({ merchant }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET() {
	const token = await readSessionCookie();
	if (!token) return unauthorized("No session");

	const merchant = await verifyToken(token);
	if (!merchant) {
		// The cookie survived something the token did not — a revoke, or a reseed of the backend.
		// Clearing it here is what makes the next boot ask the host for a new one rather than
		// retrying a token that will never work again.
		await clearSessionCookie();
		return unauthorized("The session is no longer valid");
	}

	return Response.json({ merchant }, { headers: { "Cache-Control": "no-store" } });
}

export async function DELETE(request: Request) {
	if (!isSameOrigin(request)) {
		return Response.json(
			{ error: { code: "forbidden", message: "Cross-origin request" } },
			{ status: 403 },
		);
	}

	const token = await readSessionCookie();

	// The cookie is cleared whatever the upstream revoke does. A revoke that fails must not leave
	// the merchant holding a session they asked to end.
	if (token) {
		await fetch(`${OMS_BACKEND_URL}/api/v1/auth/revoke`, {
			method: "POST",
			headers: { authorization: `Bearer ${token}` },
			cache: "no-store",
		}).catch(() => null);
	}

	await clearSessionCookie();
	return Response.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}

/**
 * True when the request came from a page on this origin.
 *
 * `Origin` is set by the browser on every POST and DELETE and cannot be forged by page script, so
 * comparing it to the request's own origin is a complete CSRF defence for these two routes. It is
 * needed because the session cookie is `SameSite=None` — necessary for the iframe, and it means
 * `SameSite` is doing no CSRF work.
 */
function isSameOrigin(request: Request): boolean {
	const origin = request.headers.get("origin");
	// Absent on a same-origin non-browser caller (curl, a server-side fetch); those are not the
	// confused-deputy case this guards against.
	if (!origin) return true;
	return origin === new URL(request.url).origin;
}
