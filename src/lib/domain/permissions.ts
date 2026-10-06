/**
 * Access permissions (docs/domain-rules.md → "Access"). Merchants see only their own orders,
 * CS sees all orders and sync state, and only CS users holding `orders:override` may see or
 * call the status override. The mock API must check these server-side, not just the UI.
 */
export const PERMISSIONS = [
	/** Read and fulfill the caller's own merchant orders. */
	"orders:own",
	/** Read orders across all merchants (CS). */
	"orders:all",
	/** Override fulfillment status, audited (CS with override permission). */
	"orders:override",
	/** Read failed status syncs and pending reconciliations (CS). */
	"sync:view",
	/** Validate a voucher on delivery (rider). */
	"deliver:validate",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

/** Whether a set of granted permissions includes `needed`. */
export function hasPermission(granted: readonly Permission[], needed: Permission): boolean {
	return granted.includes(needed);
}
