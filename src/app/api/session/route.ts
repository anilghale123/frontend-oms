/**
 * `/api/session` — where a handed-over token becomes an OMS session.
 *
 * The token reached page JavaScript through the portal's `postMessage` grant — the only way one
 * arrives — which is the worst place for it. `POST` here trades it for an httpOnly
 * cookie, and from then on the token is only ever read by this app's server.
 *
 *   POST   { token }  → stores it in the session cookie
 *   DELETE           → clears the cookie (portal sign-out goes through `/embed-signout`)
 *
 * There is no `GET`: OMS does not check its session before opening the screens. Their first call
 * through `/api/oms/*` is the check — `401 no_session` when there is no cookie, which makes OMS ask
 * the portal for a token. `POST` does not call the Sales service either. The token comes from the
 * portal, which got it from Providhy IAM, and it does not expire. A token Sales does not accept
 * shows up on the first call through the proxy, whose `401` deletes the cookie and makes OMS ask the
 * portal again — the same path as a token revoked later.
 *
 * What protects these routes is who may call them: same origin only (below), and on the embedded
 * surface the token reaches the page only through the checked `postMessage` channel, and only when
 * OMS asked for one (`AuthProvider`).
 */

import { z } from "zod";
import { trace, traceWarn } from "@/lib/debug";
import { clearSessionCookie, setSessionCookie } from "./_cookie";

const bodySchema = z.object({ token: z.string().trim().min(1) });

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
	// Same-origin only. The handoff is posted by this app's own page, so a cross-site caller has
	// no business here — and without this check any site could seed a session cookie in a visitor's
	// browser with a token of its choosing.
	if (!isSameOrigin(request)) {
		traceWarn("session", "✖ step 20 · POST /api/session refused: cross-origin (check F)", {
			origin: request.headers.get("origin"),
			expected: new URL(request.url).origin,
		});
		return Response.json(
			{ error: { code: "forbidden", message: "Cross-origin request" } },
			{ status: 403 },
		);
	}

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		trace("session", "✖ step 20 · POST /api/session refused: no token in the body (check F) → 400");
		return Response.json(
			{ error: { code: "invalid_body", message: "A token is required" } },
			{ status: 400 },
		);
	}

	await setSessionCookie(parsed.data.token);
	trace(
		"session",
		"✔ step 20–21 · POST /api/session: origin ok; token stored in the oms_at cookie",
		{
			tokenLength: parsed.data.token.length,
			cookie: "HttpOnly; Secure; SameSite=None; Partitioned; 400 days",
			calledSales: false,
		},
	);
	return Response.json({ ok: true }, { headers: NO_STORE });
}

/**
 * Sign-out. The Sales service has no revoke endpoint — "sign-out just drops the token"
 * (`src/api.md`) — so this only clears the cookies. The portal triggers it through the
 * `/embed-signout` page when the merchant signs out there.
 */
export async function DELETE(request: Request) {
	if (!isSameOrigin(request)) {
		traceWarn("session", "✖ step 30 · DELETE /api/session refused: cross-origin (check F)", {
			origin: request.headers.get("origin"),
			expected: new URL(request.url).origin,
		});
		return Response.json(
			{ error: { code: "forbidden", message: "Cross-origin request" } },
			{ status: 403 },
		);
	}

	await clearSessionCookie();
	trace("session", "✔ step 31 · DELETE /api/session: oms_at cookie deleted");
	return Response.json({ ok: true }, { headers: NO_STORE });
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
