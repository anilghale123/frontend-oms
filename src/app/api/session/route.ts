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
import {
	NO_STORE_HEADERS,
	expectedOrigins,
	isSameOrigin,
	jsonError,
	readJsonBody,
} from "../_shared";
import { clearSessionCookie, setSessionCookie } from "./_cookie";

/**
 * Browsers drop a cookie larger than about 4096 bytes without saying so, and this route would then
 * answer `{ ok: true }` for a session that was never stored. The limit leaves room for the cookie's
 * name and attributes. Tokens are printable ASCII (JWT and opaque tokens alike), so anything else
 * is refused rather than written into a header.
 */
const MAX_TOKEN_LENGTH = 3500;

const bodySchema = z.object({
	token: z
		.string()
		.trim()
		.min(1)
		.max(MAX_TOKEN_LENGTH)
		.regex(/^[\x21-\x7E]+$/),
});

/** The body is one token; anything much larger is not a handoff. */
const MAX_BODY_BYTES = 4096;

export async function POST(request: Request) {
	// Same-origin only. The handoff is posted by this app's own page, so a cross-site caller has
	// no business here — and without this check any site could seed a session cookie in a visitor's
	// browser with a token of its choosing.
	if (!isSameOrigin(request)) {
		traceWarn("session", "✖ step 20 · POST /api/session refused: cross-origin (check F)", {
			origin: request.headers.get("origin"),
			expected: expectedOrigins(request),
		});
		return jsonError("forbidden", "Cross-origin request", 403);
	}

	const body = await readJsonBody(request, MAX_BODY_BYTES);
	const parsed = body.ok ? bodySchema.safeParse(body.value) : null;
	if (!parsed?.success) {
		trace("session", "✖ step 20 · POST /api/session refused: no usable token in the body → 400");
		return jsonError("invalid_body", "A valid token is required", 400);
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
	return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
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
			expected: expectedOrigins(request),
		});
		return jsonError("forbidden", "Cross-origin request", 403);
	}

	await clearSessionCookie();
	trace("session", "✔ step 31 · DELETE /api/session: oms_at cookie deleted");
	return Response.json({ ok: true }, { headers: NO_STORE_HEADERS });
}
