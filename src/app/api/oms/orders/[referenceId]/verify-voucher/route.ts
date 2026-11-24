/**
 * `POST /api/oms/orders/{referenceId}/verify-voucher` — the merchant checks the customer's voucher
 * code for an order that is out for delivery.
 *
 *   POST { voucher_code } → {SALES_URL}api/oms/rider/deliver/ { order_id, voucher_code }
 *
 * The Sales service has no merchant-side voucher endpoint: the only check is the rider's
 * `rider/deliver`, which takes no token and marks the order Delivered when the pair matches. So
 * this route makes that call on the merchant's behalf, after proving who is asking:
 *
 * 1. The merchant's token reads the order from the merchant-portal API. Sales answers `401` for a
 *    dead token and `404` for an order that is not this merchant's, so only an order the merchant
 *    owns gets this far — no Order ID is typed, and none can be chosen.
 * 2. The order must be `delivering`; the rider endpoint only works then, and a clear refusal here
 *    beats Sales' generic "invalid order id or voucher code".
 * 3. Its `order_id` and the typed code go to `rider/deliver`, and Sales' answer (the delivered order)
 *    is passed back unchanged.
 *
 * No Cloudflare Turnstile here, unlike the rider's `/api/rider/deliver`: that route's only credential
 * is a guessable pair behind no login, while this one needs the merchant's token and can only touch
 * that merchant's own delivering orders.
 */

import { z } from "zod";
import {
	SALES_CONFIG_PROBLEM,
	SALES_PORTAL_API,
	SALES_RIDER_API,
	UPSTREAM_TIMEOUT_MS,
	salesUnreachableMessage,
} from "@/config/server-env";
import { NO_SESSION_CODE, RIDER_FIELD_MAX_LENGTH } from "@/lib/api/contracts";
import { trace, traceWarn } from "@/lib/debug";
import {
	NO_STORE_HEADERS,
	isSameOrigin,
	jsonError as error,
	readJsonBody,
} from "../../../../_shared";
import { clearSessionCookie, readSessionCookie } from "../../../../session/_cookie";

const bodySchema = z.object({
	voucher_code: z.string().trim().min(1).max(RIDER_FIELD_MAX_LENGTH),
});

/** One short field. */
const MAX_BODY_BYTES = 1024;

type Context = { params: Promise<{ referenceId: string }> };

export async function POST(request: Request, ctx: Context) {
	if (!isSameOrigin(request)) {
		traceWarn("proxy", "✖ POST verify-voucher refused: cross-origin");
		return error("forbidden", "Cross-origin request", 403);
	}
	if (!SALES_PORTAL_API || !SALES_RIDER_API) {
		return error("sales_not_configured", SALES_CONFIG_PROBLEM ?? "", 503);
	}

	const token = (await readSessionCookie()) ?? request.headers.get("x-oms-token");
	if (!token) return error(NO_SESSION_CODE, "No OMS session", 401);

	const body = await readJsonBody(request, MAX_BODY_BYTES);
	if (!body.ok) {
		return body.status === 413
			? error("body_too_large", "The request is too large.", 413)
			: error("invalid_body", "Enter the voucher code.", 400);
	}
	const parsed = bodySchema.safeParse(body.value);
	if (!parsed.success) return error("invalid_body", "Enter the voucher code.", 400);

	const { referenceId } = await ctx.params;

	// 1. The merchant's own order. This is what authenticates the call.
	const read = await callSales(`${SALES_PORTAL_API}orders/${encodeURIComponent(referenceId)}/`, {
		method: "GET",
		headers: { authorization: `Bearer ${token}`, accept: "application/json" },
	});
	if (!read.reached) return read.response;
	if (read.res.status === 401) {
		await clearSessionCookie();
		traceWarn("proxy", "✖ verify-voucher: Sales refused the token (401); oms_at cookie deleted");
	}
	if (!read.res.ok) return passBack(read.res);

	const order = ((await read.res.json().catch(() => null)) as { data?: unknown } | null)?.data as
		{ order_id?: unknown; status?: unknown } | undefined;
	if (typeof order?.order_id !== "string" || !order.order_id) {
		return error("unreadable_order", "The order couldn't be read. Try again.", 502);
	}

	// 2. Only while the order is out for delivery.
	if (order.status !== "delivering") {
		return error("not_delivering", "This order is no longer out for delivery.", 409);
	}

	// 3. The rider's call. The voucher code is not logged: it is the customer's credential.
	const deliver = await callSales(`${SALES_RIDER_API}deliver/`, {
		method: "POST",
		headers: { accept: "application/json", "content-type": "application/json" },
		body: JSON.stringify({ order_id: order.order_id, voucher_code: parsed.data.voucher_code }),
	});
	if (!deliver.reached) return deliver.response;
	trace("proxy", `POST verify-voucher → rider/deliver answered ${deliver.res.status}`);
	return passBack(deliver.res);
}

type SalesCall = { reached: true; res: Response } | { reached: false; response: Response };

/** The Sales response, or the error response to send when Sales cannot be reached in time. */
async function callSales(url: string, init: RequestInit): Promise<SalesCall> {
	try {
		const res = await fetch(url, {
			...init,
			cache: "no-store",
			signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
		});
		return { reached: true, res };
	} catch (cause) {
		const timedOut = cause instanceof DOMException && cause.name === "TimeoutError";
		console.error(`[verify-voucher] ${timedOut ? "timed out" : "failed"}:`, cause);
		return {
			reached: false,
			response: timedOut
				? error("sales_timeout", "The Sales service didn't answer in time. Try again.", 504)
				: error("sales_unreachable", salesUnreachableMessage(), 502),
		};
	}
}

async function passBack(upstream: Response): Promise<Response> {
	const text = await upstream.text();
	return new Response(text || null, {
		status: upstream.status,
		headers: {
			...NO_STORE_HEADERS,
			"content-type": upstream.headers.get("content-type") ?? "application/json",
		},
	});
}
