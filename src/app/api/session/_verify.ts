import "server-only";
import { OMS_BACKEND_URL } from "@/config/server-env";
import type { MerchantProfile } from "@/lib/auth";
import { isMerchantProfile } from "@/lib/auth";

/**
 * Asks the OMS backend who a token belongs to.
 *
 * This is the only check that matters, and it is why a token is never trusted just because it
 * arrived in a cookie: the backend re-reads the token record on every call, so a revoked token —
 * or one from before a reseed — fails here and the merchant is taken back through the handoff
 * instead of seeing a half-broken page.
 *
 * `null` for any failure. Which failure it was is the backend's business; this side only decides
 * whether there is a session.
 */
export async function verifyToken(token: string): Promise<MerchantProfile | null> {
	let res: Response;
	try {
		res = await fetch(`${OMS_BACKEND_URL}/api/v1/auth/me`, {
			headers: { authorization: `Bearer ${token}` },
			cache: "no-store",
		});
	} catch (cause) {
		console.error("[session] OMS backend unreachable:", cause);
		return null;
	}

	if (!res.ok) return null;

	const body: unknown = await res.json().catch(() => null);
	const merchant = (body as { merchant?: unknown } | null)?.merchant;
	return isMerchantProfile(merchant) ? merchant : null;
}
