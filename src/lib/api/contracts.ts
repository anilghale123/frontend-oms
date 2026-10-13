/**
 * Request and response shapes for the OMS API.
 *
 * Two layers, kept apart on purpose:
 *
 * - **Wire types** (`Portal*`) — exactly what the Sales service's merchant-portal API sends
 *   (`src/api.md`): snake_case, `{ data }` envelopes, and fields whose shape the partner decides.
 * - **What features get** — `Order` from `@/lib/domain`, produced from the wire by `./portal.ts`.
 */

import type { Order, OrderStatus } from "@/lib/domain";

/** A single object: `{ "data": ... }`. */
export interface PortalEnvelope<T> {
	data: T;
}

/** A page of a list. `next`/`previous` are full backend URLs or `null`. */
export interface PortalList<T> {
	/** Matching items across every page. */
	count: number;
	next: string | null;
	previous: string | null;
	data: T[];
}

export interface PortalMerchantDetail {
	id?: string;
	name?: string;
	contact?: string;
	pan?: string;
}

/**
 * Always has `delivery_address`, a string **or** an object. The other keys are whatever the partner
 * sent — usually `identifier`, `name` and `contact`.
 */
export type PortalCustomerDetail = Record<string, unknown> & {
	delivery_address?: string | Record<string, unknown> | null;
};

export interface PortalOrderItem {
	product_id: string;
	name: string;
	qty: number;
	unit_name: string;
	/** `goods` or `service`. */
	product_type: string;
	additional_info: unknown;
}

export interface PortalOrderLog {
	status: string;
	/** Nepal time, formatted: "2026-10-09 10:30". */
	date: string;
	remarks: string;
}

export interface PortalOrder {
	/** The partner's own id, e.g. "ORD001". Unique; every endpoint for one order takes it. */
	reference_id: string;
	/** Providhy's id, e.g. "OMS-0427" — the one merchants and riders know orders by. */
	order_id: string;
	merchant_detail: PortalMerchantDetail | null;
	customer_detail: PortalCustomerDetail | null;
	items: PortalOrderItem[];
	status: string;
	/** `points` or `points_money`. */
	redemption_value_type: string;
	redeem_points: number | null;
	amount: number | null;
	/** `null` until assigned; any shape. */
	rider: Record<string, unknown> | null;
	additional_info: unknown;
	/** Oldest first. */
	logs: PortalOrderLog[];
	created: string;
}

/** Largest page the Sales service serves (also its default). */
export const MAX_PAGE_SIZE = 100;

/** Query for `GET orders/`. Every field is optional; the token decides whose orders. */
export interface ListOrdersParams {
	/** Search over order ids, product id, item name, customer identifier and customer name. */
	q?: string;
	status?: OrderStatus;
	/** From 1. */
	page?: number;
	/** Page size, at most `MAX_PAGE_SIZE`. */
	count?: number;
}

/** One page of orders, as features use it. */
export interface OrderListResult {
	orders: Order[];
	/** Matching orders across every page. */
	total: number;
	hasNext: boolean;
	hasPrevious: boolean;
}

/**
 * `POST orders/{reference_id}/status/`. Any status, from any status: the server accepts every
 * move, so the UI decides what to offer (`@/lib/domain` `primaryAction`, `needsConfirmation`).
 *
 * No actor travels with it: the server takes the merchant from the token, so the history cannot
 * be written in someone else's name.
 */
export interface UpdateOrderStatusRequest {
	status: OrderStatus;
	/** Shown to the customer in the order history, at most 255 characters. A standard message
	 * is used without it. */
	remarks?: string;
}

/**
 * `POST orders/{reference_id}/assign-rider/`. Records the rider and moves the order to
 * `delivering`, from any status. `rider` is free-form and comes back as sent.
 */
export interface AssignRiderRequest {
	rider: Record<string, string>;
	remarks?: string;
}

// ─── Rider portal ──────────────────────────────────────────────────────────────

/**
 * `POST {SALES_URL}api/oms/rider/deliver/`. No token: the Order ID and the customer's voucher
 * code together are the rider's credential. Moves `delivering` → `delivered`.
 */
export interface RiderDeliverRequest {
	/** Providhy's id, e.g. "OMS-0427" — the one riders know orders by. */
	order_id: string;
	voucher_code: string;
}

/**
 * The success body is not documented. It may carry the order (`{ data }`) or a `message`; the
 * rider portal shows whichever it gets.
 */
export interface RiderDeliverResponse {
	data?: PortalOrder;
	message?: string;
}
