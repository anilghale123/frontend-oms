/**
 * The session shapes the browser is allowed to know.
 *
 * Deliberately thin: the merchant profile and nothing else. There is no token field anywhere in
 * this file, because after the handoff the token lives in an httpOnly cookie that page JavaScript
 * cannot read — see `./token.ts` for the one case where it is held in memory, and why.
 *
 * No React in this folder.
 */

/** The merchant a session belongs to, as `oms-backend` reports it. */
export interface MerchantProfile {
	merchantId: string;
	companyName: string;
	location: string;
	logoUrl: string;
}

/** `GET`/`POST /api/session` on success. */
export interface SessionResponse {
	merchant: MerchantProfile;
}

export function isMerchantProfile(value: unknown): value is MerchantProfile {
	if (typeof value !== "object" || value === null) return false;
	const candidate = value as Partial<MerchantProfile>;
	return (
		typeof candidate.merchantId === "string" &&
		typeof candidate.companyName === "string" &&
		typeof candidate.location === "string" &&
		typeof candidate.logoUrl === "string"
	);
}
