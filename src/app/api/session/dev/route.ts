/**
 * `POST /api/session/dev` — **development only.** Mints a session with no portal.
 *
 * The standalone dashboard at `/orders` has no host to hand it a token, and neither does a browser
 * opened straight at OMS. Without this, local work on the order screens would mean running the
 * Angular portal and the Fonepoints backend as well.
 *
 * It does what the Fonepoints backend does — present the company API key, take the token OMS
 * issues — and then the ordinary session route stores it. The flow past this point is identical,
 * which is the point: the dev path exercises the real cookie, the real proxy and the real backend,
 * and only replaces who asked.
 *
 * Refused unless `AUTH_MODE` is `dev`, which `@/config/server-env` will not allow in production.
 * The key being here at all is the reason that restriction is absolute rather than a default.
 */

import { AUTH_MODE, DEV_API_KEY, DEV_MERCHANT_REF, OMS_BACKEND_URL } from "@/config/server-env";
import { isMerchantProfile } from "@/lib/auth";
import { setSessionCookie } from "../_cookie";

export async function POST() {
	if (AUTH_MODE !== "dev") {
		return Response.json(
			{
				error: {
					code: "disabled",
					message: "Development sign-in is off. Open OMS from the Fonepoints portal.",
				},
			},
			{ status: 404 },
		);
	}

	let res: Response;
	try {
		res = await fetch(`${OMS_BACKEND_URL}/api/v1/auth/token`, {
			method: "POST",
			headers: { "content-type": "application/json", "x-api-key": DEV_API_KEY },
			body: JSON.stringify({
				merchantRef: DEV_MERCHANT_REF,
				user: { name: "Local development", email: "dev@oms.local" },
			}),
			cache: "no-store",
		});
	} catch (cause) {
		console.error("[session/dev] OMS backend unreachable:", cause);
		return Response.json(
			{
				error: {
					code: "oms_unreachable",
					message: `Couldn't reach the OMS backend at ${OMS_BACKEND_URL}. Is it running?`,
				},
			},
			{ status: 502 },
		);
	}

	const body: unknown = await res.json().catch(() => null);

	if (!res.ok) {
		const error = (body as { error?: { code?: string; message?: string } } | null)?.error;
		console.error("[session/dev] token request failed:", res.status, error ?? body);
		return Response.json(
			{
				error: {
					code: error?.code || "oms_error",
					// The usual cause is the two services holding different API keys, so say so
					// rather than passing "Invalid API key" to the screen unexplained.
					message:
						error?.message ||
						"The OMS backend rejected the development API key. Check OMS_DEV_API_KEY.",
				},
			},
			{ status: 502 },
		);
	}

	const grant = body as { accessToken?: unknown; merchant?: unknown } | null;
	if (typeof grant?.accessToken !== "string" || !isMerchantProfile(grant.merchant)) {
		return Response.json(
			{ error: { code: "oms_error", message: "The OMS backend returned an unexpected grant" } },
			{ status: 502 },
		);
	}

	await setSessionCookie(grant.accessToken);
	return Response.json(
		{ merchant: grant.merchant, accessToken: grant.accessToken },
		{ headers: { "Cache-Control": "no-store" } },
	);
}
