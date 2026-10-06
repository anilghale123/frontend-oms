/**
 * Mock actor roles; they stand in for Fonepoints SSO in this prototype. The merchant session
 * uses a merchant role; CS and rider roles remain because the mock API and the seeded activity
 * log (CS overrides, rider deliveries) still name them as actors.
 */
export const MOCK_ROLES = [
	"merchant-a",
	"merchant-b",
	"cs-agent",
	"cs-agent-no-override",
	"rider",
] as const;

export type MockRole = (typeof MOCK_ROLES)[number];

export const MOCK_ROLE_LABELS: Record<MockRole, string> = {
	"merchant-a": "Merchant A",
	"merchant-b": "Merchant B",
	"cs-agent": "CS agent",
	"cs-agent-no-override": "CS agent (no override)",
	rider: "Rider",
};

export type MockMerchantId = Extract<MockRole, `merchant-${string}`>;

/** Company shown in the merchant sidebar footer. Stands in for the Fonepoints merchant profile. */
export const MOCK_MERCHANTS: Record<
	MockMerchantId,
	{ companyName: string; location: string; logoUrl: string }
> = {
	"merchant-a": {
		companyName: "Hamro Mobile",
		location: "New Road, Kathmandu",
		logoUrl: "/merchants/merchant-a.png",
	},
	"merchant-b": {
		companyName: "Gadget Ghar",
		location: "Lakeside, Pokhara",
		logoUrl: "/merchants/merchant-b.svg",
	},
};

/** Merchant roles double as merchant IDs in the mock seed data. */
export function isMerchantRole(value: string): value is MockMerchantId {
	return value === "merchant-a" || value === "merchant-b";
}

/**
 * Route prefix of the embedded surface, where the Fonepoints Business portal supplies the chrome.
 *
 * It decides more than routing: on this surface the host owns the appearance, so
 * `hostOwnsAppearance()` in `@/lib/appearance` keys off it (see `auth.md` section 9).
 */
export const EMBED_BASE_PATH = "/embed";
