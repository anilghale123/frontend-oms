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

/**
 * Whether the screens offer Delivering. **On**: the status filters, the "Change status" menu and
 * the fulfillment tracker all include it. Set this to `false` to hide it everywhere at once.
 */
export const DELIVERING_ENABLED = true;

/**
 * The statuses a merchant may set by hand, and move freely between (forwards or back). Delivered
 * is not one of them: it is only ever set from the rider's confirmation and the backend's response.
 */
export const MERCHANT_STATUSES: OrderStatus[] = ["preparing", "ready_for_delivery", "delivering"];

/** The statuses the screens offer: in the status filters and the "Change status" menu. */
export const OFFERED_STATUSES: OrderStatus[] = ORDER_STATUSES.filter(
	(status) => DELIVERING_ENABLED || status !== "delivering",
);

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
 * Whether merchants record a rider (Assign rider) on the way to `delivering`. **Off for now**: the
 * order screens show nothing about riders. A ready-for-delivery order has no primary action (the
 * queue shows a dash; the detail page leads with "Change status"), and Delivering is a plain status
 * change from that menu. The dialog, hook and API call stay in place; set this to `true` to bring
 * Assign rider back everywhere at once.
 */
export const ASSIGN_RIDER_ENABLED = false;

/** Overrides for the rider rules below, so both settings stay tested. */
export interface RiderRuleOptions {
	/** Defaults to `ASSIGN_RIDER_ENABLED`. */
	assignRider?: boolean;
	/** Defaults to `DELIVERING_ENABLED`. */
	delivering?: boolean;
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
	delivering: null,
	delivered: null,
	failed: null,
} as const satisfies Record<OrderStatus, PrimaryAction | null>;

/**
 * The primary action for an order in `status`; `null` when there is none. A ready order leads with
 * Assign rider; with nothing while Assign rider is off (`ASSIGN_RIDER_ENABLED`) or Delivering is
 * off, since Delivering is then a plain change from the menu. There is no Mark delivered: delivery
 * is confirmed by the rider and the backend, never by the merchant.
 */
export function primaryAction(
	status: OrderStatus,
	{ assignRider = ASSIGN_RIDER_ENABLED, delivering = DELIVERING_ENABLED }: RiderRuleOptions = {},
): PrimaryAction | null {
	const action = PRIMARY_ACTIONS[status];
	if (action?.kind === "assign_rider") {
		if (!delivering || !assignRider) return null;
	}
	return action;
}

/**
 * The fulfillment tracker's steps: the happy path, without Delivering while it is not offered
 * (`DELIVERING_ENABLED`) — unless the order is delivering right now, so its current step shows. An
 * order that went through Delivering earlier still lists it in its Activity log.
 */
export function fulfillmentSequence(
	status: OrderStatus,
	{ delivering = DELIVERING_ENABLED }: RiderRuleOptions = {},
): OrderStatus[] {
	const showDelivering = delivering || status === "delivering";
	return ORDER_STATUS_SEQUENCE.filter((step) => showDelivering || step !== "delivering");
}

/**
 * The statuses the "Change status" menu offers: the other merchant statuses (Preparing, Ready for
 * delivery, Delivering) in either direction, and Failed. Never Delivered: that comes from the rider's
 * confirmation and the backend. `delivered` and `failed` end the flow, so they offer nothing. The
 * server would accept any move (`src/api.md`); this is the UI's rule.
 */
export function otherStatuses(
	status: OrderStatus,
	{ delivering = DELIVERING_ENABLED }: RiderRuleOptions = {},
): OrderStatus[] {
	if (isFinalStatus(status)) return [];
	return [...MERCHANT_STATUSES, "failed" as const].filter(
		(next) => next !== status && (delivering || next !== "delivering"),
	);
}

/**
 * Whether moving to `to` should go through Assign rider rather than a plain status change. The
 * status endpoint would accept `delivering` too, but then no rider is recorded. Never, while
 * Assign rider is off (`ASSIGN_RIDER_ENABLED`): Delivering is then a plain change.
 */
export function goesThroughAssignRider(
	to: OrderStatus,
	{ assignRider = ASSIGN_RIDER_ENABLED }: RiderRuleOptions = {},
): boolean {
	return assignRider && to === "delivering";
}

/** `delivered` and `failed` end the flow: the screens offer no change away from them. */
export function isFinalStatus(status: OrderStatus): boolean {
	return status === "delivered" || status === "failed";
}

/**
 * Whether the merchant confirms a change first. Every status change is confirmed, because the
 * customer sees each one in their order history.
 */
export function needsConfirmation(from: OrderStatus, to: OrderStatus): boolean {
	return from !== to;
}
