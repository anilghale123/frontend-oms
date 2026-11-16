/**
 * `/api/oms/*` — the proxy every data request goes through.
 *
 * `@/lib/api/client` points here. It reads the access token from the httpOnly cookie on the
 * server, attaches `Authorization: Bearer`, and forwards to the Sales service's merchant-portal
 * API. The trailing slash the Sales service expects is added here, so the frontend's paths stay
 * free of it. Order paths carry the partner's `reference_id`: `/api/oms/orders/ORD001/status` →
 * `{SALES_URL}api/oms/portal/orders/ORD001/status/`.
 *
 * Doing it here rather than in the browser means:
 *
 * - **The token is never in page JavaScript.** No store to read, and it does not appear in the
 *   network panel or in any client-side error report.
 * - **No CORS.** Every request a screen makes is same-origin, and server-to-server calls have no
 *   origin checks.
 * - **Scope cannot be forged.** The token decides which merchant's orders come back, and the
 *   browser does not choose the token.
 * - **A dead token is caught in one place.** An upstream `401` clears the cookie, so the next
 *   boot takes a new token instead of retrying one that will never work again.
 *
 * Only the routes the screens use are forwarded (`../_routes.ts`): an unknown path is a `404`, an
 * unknown query key is dropped, and a `POST` body must pass that route's schema and is forwarded as
 * parsed. The rider's voucher check does not come through here: a rider has no token, so it has its
 * own route (`/api/rider/deliver`).
 */

import {
	SALES_CONFIG_PROBLEM,
	SALES_PORTAL_API,
	UPSTREAM_TIMEOUT_MS,
	salesUnreachableMessage,
} from "@/config/server-env";
import { NO_SESSION_CODE } from "@/lib/api/contracts";
import { trace, traceWarn } from "@/lib/debug";
import { isSameOrigin, jsonError as error, readJsonBody } from "../../_shared";
import { clearSessionCookie, readSessionCookie } from "../../session/_cookie";
import { matchProxyRoute } from "../_routes";

/** Upstream headers worth passing back. `Retry-After` is how a `429` says how long to wait. */
const PASSED_BACK = ["content-type", "retry-after"];

/** A status change or a rider is a few hundred bytes; this leaves plenty of room. */
const MAX_BODY_BYTES = 8192;

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: Context) {
	return forward(request, ctx);
}

export async function POST(request: Request, ctx: Context) {
	return forward(request, ctx);
}

async function forward(request: Request, ctx: Context) {
	const { path } = await ctx.params;

	// `SameSite=None` is forced on the session cookie by the iframe, so `SameSite` does no CSRF
	// work and the `Origin` check is what replaces it. Checked on every method, not only `POST`: a
	// cross-origin `GET` carries the cookie too, and a page on another site has no reason to read
	// orders through this route.
	if (!isSameOrigin(request)) {
		traceWarn("proxy", `✖ ${request.method} /${path.join("/")} refused: cross-origin (check H)`, {
			origin: request.headers.get("origin"),
			expected: new URL(request.url).origin,
		});
		return error("forbidden", "Cross-origin request", 403);
	}

	const route = matchProxyRoute(request.method, path, new URL(request.url).searchParams);
	if (!route.ok) {
		traceWarn("proxy", `✖ ${request.method} /${path.join("/")} refused: ${route.code}`);
		return error(route.code, route.message, route.status);
	}

	if (!SALES_PORTAL_API) {
		return error("sales_not_configured", SALES_CONFIG_PROBLEM ?? "", 503);
	}

	const cookieToken = await readSessionCookie();
	const token =
		cookieToken ??
		// The fallback for a browser that refused the cookie. `@/lib/auth/token` explains why
		// holding it in memory is acceptable; it only ever reaches this server over a same-origin
		// request.
		request.headers.get("x-oms-token");

	// No session at all. OMS has no separate session check: this answer, on its first data request,
	// is how it learns it must ask the portal for a token. The code tells it apart from Sales
	// refusing a token, which is a different reason to ask.
	if (!token) {
		trace(
			"proxy",
			`step 7 · ${request.method} /${path.join("/")}: no session (no cookie, no fallback header) → 401 ${NO_SESSION_CODE}`,
		);
		return error(NO_SESSION_CODE, "No OMS session", 401);
	}
	const label = `${request.method} /${path.join("/")}`;

	// The body is checked before Sales is asked: a field the screens never send, or a status that
	// does not exist, is refused here with the merchant's token still unused.
	let body: string | undefined;
	if (route.body) {
		const read = await readJsonBody(request, MAX_BODY_BYTES);
		if (!read.ok) {
			return read.status === 413
				? error("body_too_large", "The request is too large.", 413)
				: error("invalid_body", "The request body is not valid JSON.", 400);
		}
		const parsed = route.body.safeParse(read.value);
		if (!parsed.success) {
			traceWarn("proxy", `✖ ${label} refused: the body does not match the endpoint`);
			return error("invalid_body", "The request body is not valid for this endpoint.", 400);
		}
		body = JSON.stringify(parsed.data);
	}

	const startedAt = Date.now();
	trace(
		"proxy",
		`step 24 · ${label}: token from ${cookieToken ? "the oms_at cookie" : "the x-oms-token fallback header"}; forwarding to Sales with Authorization: Bearer`,
		{ query: route.search || "none" },
	);

	// `route.path` is already encoded: Next hands the segments over decoded, and an order id is data.
	const url = `${SALES_PORTAL_API}${route.path}/${route.search}`;

	let upstream: Response;
	try {
		upstream = await fetch(url, {
			method: request.method,
			headers: {
				authorization: `Bearer ${token}`,
				accept: "application/json",
				"content-type": "application/json",
			},
			body,
			cache: "no-store",
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (cause) {
		const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
		traceWarn("proxy", `✖ step 24 · ${label}: Sales ${timedOut ? "timed out" : "unreachable"}`);
		console.error(
			`[oms-proxy] ${request.method} ${url} ${timedOut ? "timed out" : "failed"}:`,
			cause,
		);
		return timedOut
			? error("sales_timeout", "The Sales service didn't answer in time. Try again.", 504)
			: error("sales_unreachable", salesUnreachableMessage(), 502);
	}

	// A token the Sales service no longer accepts — revoked or replaced; tokens do not expire. Dropping the
	// cookie means the next boot takes a new token rather than retrying this one on every request.
	if (upstream.status === 401) {
		await clearSessionCookie();
		traceWarn(
			"proxy",
			`✖ step 26 · ${label}: Sales refused the token (401); oms_at cookie deleted`,
		);
	} else {
		trace(
			"proxy",
			`✔ step 25 · ${label}: Sales answered ${upstream.status} (${Date.now() - startedAt} ms)`,
		);
	}

	const headers = new Headers({ "Cache-Control": "no-store" });
	for (const name of PASSED_BACK) {
		const value = upstream.headers.get(name);
		if (value) headers.set(name, value);
	}
	if (!headers.has("content-type")) headers.set("content-type", "application/json");

	const text = await upstream.text();
	return new Response(text || null, { status: upstream.status, headers });
}
