import type { OrderStatus } from "./types";

/** Ordered lifecycle a new order moves through under normal fulfillment.
 * `failed` is the exception and is intentionally excluded from this happy-path sequence. */
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
	"preparing",
	"ready_for_delivery",
	"delivering",
	"delivered",
];

/** Every status, in the order filters and menus list them. */
export const ORDER_STATUSES: OrderStatus[] = [...ORDER_STATUS_SEQUENCE, "failed"];

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
	preparing: "Preparing",
	ready_for_delivery: "Ready for delivery",
	delivering: "Delivering",
	delivered: "Delivered",
	failed: "Failed",
};

export function isOrderStatus(value: unknown): value is OrderStatus {
	return typeof value === "string" && value in ORDER_STATUS_LABELS;
}

/**
 * The one button a status leads with (`src/api.md`, "Status flow and actions per status").
 *
 * The Sales service accepts any status from any status, so this is the UI's decision, not the
 * server's: it names the step a merchant normally takes next. Every other status is offered in a
 * "Change status" menu (`otherStatuses`).
 *
 * - `status` — a plain status change to `to`.
 * - `assign_rider` — record a rider, which also moves the order to `delivering`. Used instead of
 *   a plain change to `delivering`, so the rider is on record.
 */
export type PrimaryAction =
	{ kind: "status"; to: OrderStatus; label: string } | { kind: "assign_rider"; label: string };

const PRIMARY_ACTIONS = {
	preparing: { kind: "status", to: "ready_for_delivery", label: "Mark ready" },
	ready_for_delivery: { kind: "assign_rider", label: "Assign rider" },
	delivering: { kind: "status", to: "delivered", label: "Mark delivered" },
	delivered: null,
	failed: null,
} as const satisfies Record<OrderStatus, PrimaryAction | null>;

/** The primary action for an order in `status`; `null` at the end of the flow. */
export function primaryAction(status: OrderStatus): PrimaryAction | null {
	return PRIMARY_ACTIONS[status];
}

/** The statuses the "Change status" menu offers: every one except the current. */
export function otherStatuses(status: OrderStatus): OrderStatus[] {
	return ORDER_STATUSES.filter((candidate) => candidate !== status);
}

/**
 * Whether moving to `to` should go through Assign rider rather than a plain status change. The
 * status endpoint would accept `delivering` too, but then no rider is recorded.
 */
export function goesThroughAssignRider(to: OrderStatus): boolean {
	return to === "delivering";
}

/** `delivered` and `failed` end the flow. The server still accepts a change away from them. */
export function isFinalStatus(status: OrderStatus): boolean {
	return status === "delivered" || status === "failed";
}

/**
 * Whether the merchant confirms a change first. Every change is shown to the customer in their
 * order history, so the guide asks for a confirmation before Mark failed, Mark delivered, and any
 * change away from `delivered` or `failed` (which should only ever correct a mistake).
 */
export function needsConfirmation(from: OrderStatus, to: OrderStatus): boolean {
	return to === "delivered" || to === "failed" || isFinalStatus(from);
}
