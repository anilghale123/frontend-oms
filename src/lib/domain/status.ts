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
 * Whether the screens offer Delivering. **Off for now**: the status filters, the "Change status"
 * menu and the fulfillment tracker leave it out, and a ready order leads with Mark delivered, so
 * the flow is Preparing → Ready for delivery → Delivered. An order the API reports as delivering
 * still shows as Delivering everywhere (badge, tracker, its filter is simply not offered). Set this
 * to `true` to bring Delivering back everywhere at once.
 */
export const DELIVERING_ENABLED = false;

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
	delivering: { kind: "status", to: "delivered", label: "Mark delivered" },
	delivered: null,
	failed: null,
} as const satisfies Record<OrderStatus, PrimaryAction | null>;

/** A ready order's step while Delivering is not offered: straight to delivered. */
const MARK_DELIVERED: PrimaryAction = { kind: "status", to: "delivered", label: "Mark delivered" };

/**
 * The primary action for an order in `status`; `null` at the end of the flow. A ready order leads
 * with Assign rider; with nothing while Assign rider is off (`ASSIGN_RIDER_ENABLED`), since
 * Delivering is then a plain change from the menu; and with Mark delivered while Delivering itself
 * is off (`DELIVERING_ENABLED`), since Assign rider moves an order to Delivering.
 */
export function primaryAction(
	status: OrderStatus,
	{ assignRider = ASSIGN_RIDER_ENABLED, delivering = DELIVERING_ENABLED }: RiderRuleOptions = {},
): PrimaryAction | null {
	const action = PRIMARY_ACTIONS[status];
	if (action?.kind === "assign_rider") {
		if (!delivering) return MARK_DELIVERED;
		if (!assignRider) return null;
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
 * The statuses the "Change status" menu offers: only forward. An order moves down the happy path
 * (`ORDER_STATUS_SEQUENCE`) and never back — not from Ready for delivery to Preparing, not from
 * Delivered to anything earlier — and may be marked Failed until it is final. `delivered` and
 * `failed` end the flow, so they offer nothing. The server would accept any move (`src/api.md`);
 * this is the UI's rule. Delivering is left out while it is off (`DELIVERING_ENABLED`).
 */
export function otherStatuses(
	status: OrderStatus,
	{ delivering = DELIVERING_ENABLED }: RiderRuleOptions = {},
): OrderStatus[] {
	if (isFinalStatus(status)) return [];
	const ahead = ORDER_STATUS_SEQUENCE.slice(ORDER_STATUS_SEQUENCE.indexOf(status) + 1);
	return [...ahead, "failed" as const].filter((next) => delivering || next !== "delivering");
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
 * Whether the merchant confirms a change first. Every change is shown to the customer in their
 * order history, so the guide asks for a confirmation before Mark failed, Mark delivered, and any
 * change away from `delivered` or `failed` (which should only ever correct a mistake).
 */
export function needsConfirmation(from: OrderStatus, to: OrderStatus): boolean {
	return to === "delivered" || to === "failed" || isFinalStatus(from);
}
