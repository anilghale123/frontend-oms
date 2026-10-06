import { db } from "./db";
import type { Order, ValidationOutcome } from "@/lib/domain/types";

/** Artificial latency so loading states stay visible in the UI
 * (CLAUDE.md → "Mock layer": "Add small artificial latency
 * (300–800 ms)"). */
function simulatedLatency(): Promise<void> {
	const ms = 300 + Math.random() * 500;
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface ValidationResult {
	outcome: ValidationOutcome;
	order?: Order;
}

/**
 * Fixed test vouchers the rider portal can use to reach every outcome in
 * domain rule 8 on demand, independent of which seed order is open.
 */
export const TEST_VOUCHERS = {
	valid: "VALID-CODE",
	mismatch: "MISMATCH-CODE",
	alreadyRedeemed: "ALREADY-REDEEMED",
	redemptionFails: "REDEMPTION-FAILS",
} as const;

/**
 * Simulates the Fonepoints voucher redemption call a rider triggers on
 * delivery. Mirrors domain rule 8's four outcomes. The mismatch case
 * deliberately returns the same generic result whether the Order ID exists
 * or not — it must never reveal whether the order exists.
 */
export async function validateVoucher(
	omsOrderId: string,
	voucherCode: string,
): Promise<ValidationResult> {
	await simulatedLatency();

	const order = db.getOrder(omsOrderId);

	// Unknown order ID gets the same generic mismatch as a wrong voucher
	// code — never reveal whether the order exists (domain rule 8).
	if (!order) {
		return { outcome: "mismatch" };
	}

	// Only a *terminal* redeemed voucher reports "already redeemed" to the
	// rider. A voucher redeemed while the order is still short of
	// `delivered` is the pending-reconciliation case (domain rule 13): it
	// falls through to the success branch below, which reconciles the
	// status without re-running a redemption.
	if (order.status === "delivered" && order.voucherRedeemed) {
		return { outcome: "already_redeemed", order };
	}

	// Only an order out for delivery can be redeemed (or one already redeemed and awaiting
	// reconciliation). Anything else answers like a wrong pair, so the rider learns nothing
	// about the order.
	const redeemable = order.status === "delivering" || order.voucherRedeemed;
	if (!redeemable || order.voucherCode !== voucherCode) {
		return { outcome: "mismatch", order };
	}

	if (voucherCode === TEST_VOUCHERS.redemptionFails) {
		return { outcome: "redemption_failed", order };
	}

	return { outcome: "success", order };
}
