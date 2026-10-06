/**
 * `/api/oms/*` — the proxy every data request goes through.
 *
 * `@/lib/api/client` points here, so from a screen's point of view nothing changed when the mock
 * backend was replaced: it still calls `/orders`, still gets an `Order[]`. What changed is what
 * happens in between.
 *
 * This route is the reason the access token can be httpOnly. It reads the cookie on the server,
 * attaches `Authorization: Bearer`, and forwards to the OMS backend. Four things follow from doing
 * it here rather than in the browser:
 *
 * - **The token is never in page JavaScript.** No store to read, and it does not appear in the
 *   network panel or in any client-side error report.
 * - **No CORS.** Every request a screen makes is same-origin, so the OMS backend needs no origin
 *   list and no preflight — which also means it cannot be called from a browser at all.
 * - **Scope cannot be forged.** The token decides which merchant's orders come back, and the
 *   browser does not choose the token.
 * - **A revoked token is caught in one place.** Upstream 401 clears the cookie, so the next boot
 *   takes the handoff again instead of looping on a dead credential.
 *
 * Two paths are forwarded **without** a token, by name: the rider's `validate` and the two dev
 * backdoors behind it. The rider has no account — the Order ID and voucher pair is the credential
 * — so requiring one would mean the merchant's token travelling to a rider's phone. The backend
 * enforces the same split; this list only avoids attaching a token that would be ignored.
 */

import { OMS_BACKEND_URL } from "@/config/server-env";
import { clearSessionCookie, readSessionCookie } from "../../session/_cookie";

/** Upstream prefix. The frontend's paths are versionless; the version belongs to the backend. */
const UPSTREAM_PREFIX = "/api/v1";

/** Paths the rider surface reaches with no session. Prefix match on the joined path. */
const PUBLIC_PATHS = ["validate", "dev/voucher", "dev/delivering"];

/** Methods that change something, and so need the CSRF check below. */
const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

type Context = { params: Promise<{ path: string[] }> };

export async function GET(request: Request, ctx: Context) {
	return forward(request, ctx);
}

export async function POST(request: Request, ctx: Context) {
	return forward(request, ctx);
}

export async function PATCH(request: Request, ctx: Context) {
	return forward(request, ctx);
}

export async function DELETE(request: Request, ctx: Context) {
	return forward(request, ctx);
}

async function forward(request: Request, ctx: Context) {
	const { path } = await ctx.params;
	const joined = path.join("/");

	// `SameSite=None` is forced on the session cookie by the iframe, so `SameSite` does no CSRF
	// work and the `Origin` check is what replaces it. Browsers always send `Origin` on a
	// mutating request and page script cannot change it.
	if (MUTATING.has(request.method)) {
		const origin = request.headers.get("origin");
		if (origin && origin !== new URL(request.url).origin) {
			return error("forbidden", "Cross-origin request", 403);
		}
	}

	const isPublic = PUBLIC_PATHS.some(
		(allowed) => joined === allowed || joined.startsWith(`${allowed}/`),
	);

	const headers = new Headers({ "content-type": "application/json" });
	let token: string | null = null;

	if (!isPublic) {
		token =
			(await readSessionCookie()) ??
			// The fallback for a browser that refused the partitioned cookie. `@/lib/auth/token`
			// explains why holding it in memory is acceptable; it only ever reaches this server
			// over a same-origin request.
			request.headers.get("x-oms-token");

		if (!token) {
			return error("unauthorized", "No OMS session", 401);
		}
		headers.set("authorization", `Bearer ${token}`);
	}

	const search = new URL(request.url).search;
	const body = MUTATING.has(request.method) ? await request.text() : undefined;

	let upstream: Response;
	try {
		upstream = await fetch(`${OMS_BACKEND_URL}${UPSTREAM_PREFIX}/${joined}${search}`, {
			method: request.method,
			headers,
			body: body || undefined,
			cache: "no-store",
		});
	} catch (cause) {
		console.error(`[oms-proxy] ${request.method} ${joined} unreachable:`, cause);
		return error(
			"oms_unreachable",
			"Couldn't reach OMS. Check your connection and try again.",
			502,
		);
	}

	// A token the backend no longer accepts: drop the cookie so the next boot re-handshakes rather
	// than retrying it on every request.
	if (upstream.status === 401 && token) {
		await clearSessionCookie();
	}

	const text = await upstream.text();
	return new Response(text || null, {
		status: upstream.status,
		headers: {
			"content-type": upstream.headers.get("content-type") ?? "application/json",
			"Cache-Control": "no-store",
		},
	});
}

function error(code: string, message: string, status: number) {
	return Response.json(
		{ error: { code, message } },
		{ status, headers: { "Cache-Control": "no-store" } },
	);
}
