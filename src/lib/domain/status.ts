import type { OrderStatus } from "./types";

/** Ordered lifecycle a new order moves through under normal fulfillment.
 * `failed` is an exception reachable from any non-terminal status and is
 * intentionally excluded from this happy-path sequence (domain rule 4). */
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
	"preparing",
	"ready_for_delivery",
	"delivering",
	"delivered",
];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
	preparing: "Preparing",
	ready_for_delivery: "Ready for delivery",
	delivering: "Delivering",
	delivered: "Delivered",
	failed: "Failed",
};

const MANUAL_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
	preparing: ["ready_for_delivery", "failed"],
	ready_for_delivery: ["delivering", "failed"],
	// `delivering` -> `delivered` happens only via successful voucher
	// redemption, never a direct manual transition (domain rule 7).
	delivering: ["failed"],
	delivered: [],
	failed: [],
};

/**
 * Whether a manual (merchant- or CS-initiated) transition between two
 * statuses is allowed. Does not cover the rider-redemption path to
 * `delivered` — that path lives in `lib/mock/fonepoints.ts` and is the only
 * way an order reaches `delivered` (domain rule 7).
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
	return MANUAL_TRANSITIONS[from].includes(to);
}
