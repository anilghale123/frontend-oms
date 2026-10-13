/**
 * Core domain types for the OMS order lifecycle.
 *
 * Shaped after the Sales service's merchant-portal API (`src/api.md`, "Order object").
 * `@/lib/api/portal` turns the wire format into these, so screens never deal with snake_case,
 * `{ data }` envelopes or the fields whose shape the partner chooses.
 *
 * Pure TypeScript — no React, no Next.js, no feature imports.
 */

/** OMS order lifecycle. `delivered` and `failed` are final. */
export type OrderStatus =
	"preparing" | "ready_for_delivery" | "delivering" | "delivered" | "failed";

/** `points` — paid in points only; `points_money` — points plus a cash `amount`. */
export type OrderValueType = "points" | "points_money";

/** Service-only orders may have no delivery address. */
export type ProductType = "goods" | "service";

/**
 * A value the partner sent under a key OMS has no field for — a rider's vehicle number, an extra
 * customer attribute. Kept, with a readable label, so it can still be shown.
 */
export interface ExtraField {
	/** From the key: `vehicle_number` → "Vehicle number". */
	label: string;
	value: string;
}

export interface OrderItem {
	productId: string;
	name: string;
	quantity: number;
	/** e.g. "pcs". Empty when the partner sent none. */
	unitName: string;
	productType: ProductType;
}

/** The merchant the order belongs to — always the signed-in one. */
export interface OrderMerchant {
	id: string;
	name: string;
	contact: string;
	pan: string;
}

export interface OrderCustomer {
	/** The partner's id for the customer, e.g. "FPU-55821". */
	identifier: string;
	name: string;
	/** Phone number. */
	contact: string;
	/** One line, whatever shape the API sent. Empty when there is none (service-only orders). */
	deliveryAddress: string;
	/** Any other keys the partner sent. */
	extra: ExtraField[];
}

/** The API's rider is free-form; the name and phone are pulled out and the rest kept. */
export interface OrderRider {
	name: string;
	phone: string;
	extra: ExtraField[];
}

/** One step of the status timeline. */
export interface OrderLog {
	status: OrderStatus;
	/** Nepal time, already formatted by the server ("2026-10-09 14:32"). Shown as it is. */
	date: string;
	/** The message the customer sees in their order history. */
	remarks: string;
}

export interface Order {
	/** Providhy's id, e.g. "OMS-0427" (wire `order_id`). The one merchants and riders see. */
	omsOrderId: string;
	/**
	 * The partner's own id, e.g. "ORD001" (wire `reference_id`). Unique, and the key every
	 * endpoint for one order takes, so it is what URLs and caches use. Shown as "Partner order ID".
	 */
	referenceId: string;
	merchant: OrderMerchant | null;
	customer: OrderCustomer;
	items: OrderItem[];
	status: OrderStatus;
	valueType: OrderValueType;
	/** Points redeemed; `null` when the server sent none. */
	points: number | null;
	/** Rs paid on top of the points; `null` for points-only orders. */
	amount: number | null;
	/** `null` until a rider is assigned. */
	rider: OrderRider | null;
	/** Status timeline, oldest first. */
	logs: OrderLog[];
	/** Nepal time, already formatted ("2026-10-09 10:30"). */
	created: string;
}
