/**
 * `POST /api/rider/deliver` — the rider's delivery confirmation, forwarded to the Sales service.
 *
 *   POST { order_id, voucher_code, turnstileToken } → {SALES_URL}api/oms/rider/deliver/
 *
 * Separate from the `/api/oms/*` proxy on purpose: a rider has no account, so there is no session
 * cookie and no token to attach — the Order ID and the customer's voucher code together are the
 * credential, and the Sales service checks them. Going through this app's server rather than
 * straight from the browser keeps the rider page same-origin (no CORS) and the Sales address out of
 * the page.
 *
 * Because that pair is the only credential, every attempt must first pass Cloudflare Turnstile:
 * the token from the rider's widget is checked with Cloudflare (`siteverify`) before Sales is
 * asked, and a missing, spent or failed token is refused here. Without this, anyone could post
 * voucher guesses all day. Tokens are single-use, so each attempt needs a new one.
 *
 * Only the two fields the endpoint takes are forwarded, so the page cannot be used to send the
 * Sales service anything else.
 */

import { z } from "zod";
import { trace, traceWarn } from "@/lib/debug";
import { RIDER_VERIFICATION_FAILED } from "@/lib/api/contracts";
import {
	SALES_CONFIG_PROBLEM,
	SALES_RIDER_API,
	TURNSTILE_CONFIG_PROBLEM,
	TURNSTILE_SECRET_KEY,
	TURNSTILE_VERIFY_URL,
	UPSTREAM_TIMEOUT_MS,
	salesUnreachableMessage,
} from "@/config/server-env";

const bodySchema = z.object({
	order_id: z.string().trim().min(1),
	voucher_code: z.string().trim().min(1),
	// Cloudflare's tokens are at most 2048 characters.
	turnstileToken: z.string().min(1).max(2048),
});

const NO_STORE = { "Cache-Control": "no-store" };

const VERIFICATION_FAILED_MESSAGE = "Verification failed. Try again.";

export async function POST(request: Request) {
	// Same-origin only: the rider page posts here, and nothing else has a reason to.
	const origin = request.headers.get("origin");
	if (origin && origin !== new URL(request.url).origin) {
		traceWarn("rider", "✖ POST /api/rider/deliver refused: cross-origin", { origin });
		return error("forbidden", "Cross-origin request", 403);
	}

	if (!SALES_RIDER_API) {
		return error("sales_not_configured", SALES_CONFIG_PROBLEM ?? "", 503);
	}
	if (!TURNSTILE_SECRET_KEY) {
		return error("turnstile_not_configured", TURNSTILE_CONFIG_PROBLEM ?? "", 503);
	}

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		const onlyToken = parsed.error.issues.every((issue) => issue.path[0] === "turnstileToken");
		return onlyToken
			? error(RIDER_VERIFICATION_FAILED, VERIFICATION_FAILED_MESSAGE, 400)
			: error("invalid_body", "Enter the Order ID and the voucher code.", 400);
	}

	const { turnstileToken, ...salesBody } = parsed.data;
	const refused = await verifyTurnstile(turnstileToken, clientIp(request));
	if (refused) return refused;

	let upstream: Response;
	try {
		upstream = await fetch(`${SALES_RIDER_API}deliver/`, {
			method: "POST",
			headers: { accept: "application/json", "content-type": "application/json" },
			body: JSON.stringify(salesBody),
			cache: "no-store",
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (cause) {
		const timedOut = isTimeout(cause);
		console.error(`[rider] deliver ${timedOut ? "timed out" : "failed"}:`, cause);
		return timedOut
			? error("sales_timeout", "The Sales service didn't answer in time. Try again.", 504)
			: error("sales_unreachable", salesUnreachableMessage(), 502);
	}

	// The order id and voucher code are not logged: the voucher is the rider's credential.
	trace(
		"rider",
		`POST rider/deliver/ → Sales answered ${upstream.status} (no token sent: riders have none)`,
	);
	const text = await upstream.text();
	return new Response(text || null, {
		status: upstream.status,
		headers: {
			...NO_STORE,
			"content-type": upstream.headers.get("content-type") ?? "application/json",
		},
	});
}

/**
 * Asks Cloudflare whether the rider's Turnstile token is good. `null` when it passed; otherwise
 * the response to send instead, and Sales is never called. Fails closed: when Cloudflare cannot
 * be asked, the attempt is refused rather than let through unchecked.
 *
 * The token is never logged — like the voucher, it is a credential for one attempt.
 */
async function verifyTurnstile(token: string, remoteip: string | null): Promise<Response | null> {
	let answer: Response;
	try {
		answer = await fetch(TURNSTILE_VERIFY_URL, {
			method: "POST",
			headers: { accept: "application/json", "content-type": "application/json" },
			body: JSON.stringify({
				secret: TURNSTILE_SECRET_KEY,
				response: token,
				...(remoteip ? { remoteip } : {}),
			}),
			cache: "no-store",
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (cause) {
		const timedOut = isTimeout(cause);
		console.error(`[rider] Turnstile siteverify ${timedOut ? "timed out" : "failed"}:`, cause);
		return error(
			"verification_unavailable",
			"Couldn't verify the security check. Try again.",
			timedOut ? 504 : 502,
		);
	}

	const result = (await answer.json().catch(() => null)) as {
		success?: unknown;
		"error-codes"?: unknown;
	} | null;
	if (typeof result?.success !== "boolean") {
		console.error(`[rider] Turnstile siteverify answered ${answer.status} without a result`);
		return error("verification_unavailable", "Couldn't verify the security check. Try again.", 502);
	}

	if (result.success) {
		trace("rider", "Turnstile passed; asking Sales");
		return null;
	}

	const errorCodes = Array.isArray(result["error-codes"]) ? result["error-codes"] : [];
	// A refused secret is this app's configuration, not the rider: every rider would fail.
	if (errorCodes.includes("invalid-input-secret") || errorCodes.includes("missing-input-secret")) {
		console.error("[rider] Cloudflare refused TURNSTILE_SECRET_KEY:", errorCodes);
		return error(
			"turnstile_not_configured",
			"Cloudflare refused TURNSTILE_SECRET_KEY. Check it belongs to the site key and restart.",
			503,
		);
	}

	traceWarn("rider", "✖ POST /api/rider/deliver refused: Turnstile check failed", { errorCodes });
	return error(RIDER_VERIFICATION_FAILED, VERIFICATION_FAILED_MESSAGE, 400);
}

/**
 * The rider's address for Cloudflare, best effort: `cf-connecting-ip` behind Cloudflare, else the
 * first `x-forwarded-for` hop (set by Vercel and most proxies). Cloudflare only uses it as one more
 * signal, so a wrong or spoofed value weakens nothing.
 */
function clientIp(request: Request): string | null {
	const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
	return (
		request.headers.get("cf-connecting-ip") || forwarded || request.headers.get("x-real-ip") || null
	);
}

function isTimeout(cause: unknown): boolean {
	return cause instanceof DOMException && cause.name === "TimeoutError";
}

function error(code: string, message: string, status: number) {
	return Response.json({ error: { code, message } }, { status, headers: NO_STORE });
}
