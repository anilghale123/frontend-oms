/**
 * `POST /api/rider/deliver` — the rider's delivery confirmation, forwarded to the Sales service.
 *
 *   POST { order_id, voucher_code } → {SALES_URL}api/oms/rider/deliver/
 *
 * Separate from the `/api/oms/*` proxy on purpose: a rider has no account, so there is no session
 * cookie and no token to attach — the Order ID and the customer's voucher code together are the
 * credential, and the Sales service checks them. Going through this app's server rather than
 * straight from the browser keeps the rider page same-origin (no CORS) and the Sales address out of
 * the page.
 *
 * Only the two fields the endpoint takes are forwarded, so the page cannot be used to send the
 * Sales service anything else.
 */

import { z } from "zod";
import {
	SALES_CONFIG_PROBLEM,
	SALES_RIDER_API,
	UPSTREAM_TIMEOUT_MS,
	salesUnreachableMessage,
} from "@/config/server-env";

const bodySchema = z.object({
	order_id: z.string().trim().min(1),
	voucher_code: z.string().trim().min(1),
});

const NO_STORE = { "Cache-Control": "no-store" };

export async function POST(request: Request) {
	// Same-origin only: the rider page posts here, and nothing else has a reason to.
	const origin = request.headers.get("origin");
	if (origin && origin !== new URL(request.url).origin) {
		return error("forbidden", "Cross-origin request", 403);
	}

	if (!SALES_RIDER_API) {
		return error("sales_not_configured", SALES_CONFIG_PROBLEM ?? "", 503);
	}

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) {
		return error("invalid_body", "Enter the Order ID and the voucher code.", 400);
	}

	let upstream: Response;
	try {
		upstream = await fetch(`${SALES_RIDER_API}deliver/`, {
			method: "POST",
			headers: { accept: "application/json", "content-type": "application/json" },
			body: JSON.stringify(parsed.data),
			cache: "no-store",
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
	} catch (cause) {
		const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
		console.error(`[rider] deliver ${timedOut ? "timed out" : "failed"}:`, cause);
		return timedOut
			? error("sales_timeout", "The Sales service didn't answer in time. Try again.", 504)
			: error("sales_unreachable", salesUnreachableMessage(), 502);
	}

	const text = await upstream.text();
	return new Response(text || null, {
		status: upstream.status,
		headers: {
			...NO_STORE,
			"content-type": upstream.headers.get("content-type") ?? "application/json",
		},
	});
}

function error(code: string, message: string, status: number) {
	return Response.json({ error: { code, message } }, { status, headers: NO_STORE });
}
