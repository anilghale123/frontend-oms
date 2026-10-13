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
 * Only `GET` and `POST`, the two methods the portal API uses. The rider's voucher check does not
 * come through here: a rider has no token, so it has its own route (`/api/rider/deliver`).
 */

import {
	SALES_CONFIG_PROBLEM,
	SALES_PORTAL_API,
	UPSTREAM_TIMEOUT_MS,
	salesUnreachableMessage,
} from "@/config/server-env";
import { clearSessionCookie, readSessionCookie } from "../../session/_cookie";

/** Methods that change something, and so need the CSRF check below. */
const MUTATING = new Set(["POST"]);

/** Upstream headers worth passing back. `Retry-After` is how a `429` says how long to wait. */
const PASSED_BACK = ["content-type", "retry-after"];

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
	// work and the `Origin` check is what replaces it. Browsers always send `Origin` on a
	// mutating request and page script cannot change it.
	if (MUTATING.has(request.method)) {
		const origin = request.headers.get("origin");
		if (origin && origin !== new URL(request.url).origin) {
			return error("forbidden", "Cross-origin request", 403);
		}
	}

	if (!SALES_PORTAL_API) {
		return error("sales_not_configured", SALES_CONFIG_PROBLEM ?? "", 503);
	}

	const token =
		(await readSessionCookie()) ??
		// The fallback for a browser that refused the cookie. `@/lib/auth/token` explains why
		// holding it in memory is acceptable; it only ever reaches this server over a same-origin
		// request.
		request.headers.get("x-oms-token");

	if (!token) {
		return error("unauthorized", "No OMS session", 401);
	}

	// Next hands the segments over decoded; an order id is data, so it is encoded again.
	const upstreamPath = path.map(encodeURIComponent).join("/");
	const url = `${SALES_PORTAL_API}${upstreamPath}/${new URL(request.url).search}`;
	const body = MUTATING.has(request.method) ? await request.text() : undefined;

	let upstream: Response;
	try {
		upstream = await fetch(url, {
			method: request.method,
			headers: {
				authorization: `Bearer ${token}`,
				accept: "application/json",
				"content-type": "application/json",
			},
			body: body || undefined,
			cache: "no-store",
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (cause) {
		const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
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

function error(code: string, message: string, status: number) {
	return Response.json(
		{ error: { code, message } },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}
