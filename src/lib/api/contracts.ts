/**
 * Shared request/response shapes for the OMS API. Mock route handlers and
 * feature `api.ts` wrappers both import from here so the real backend can
 * replace `/api/mock` without touching screens.
 */

import type {
	ActivityLogEntry,
	Order,
	OrderStatus,
	RiderDetails,
	ValidationResultOutcome,
} from "@/lib/domain";

export type OrderListResponse = Order[];

export interface OrderDetailResponse {
	order: Order;
	activity: ActivityLogEntry[];
}

/**
 * Only the target status.
 *
 * `actor` and `actorRole` used to travel here, taken from the client's own idea of who it was.
 * They are now derived from the access token by the backend, so the activity log records the
 * merchant the session belongs to rather than the one the request claimed. An audit trail the
 * audited party fills in is not one.
 *
 * `override` is likewise gone: a CS override is a different principal, and no screen in this
 * phase issues one.
 */
export interface UpdateOrderStatusRequest {
	status: OrderStatus;
}

export type AssignRiderRequest = RiderDetails;

export interface ValidateVoucherRequest {
	omsOrderId: string;
	voucherCode: string;
}

/** The only order facts the rider sees, and only after a successful validation. */
export interface DeliverySummary {
	omsOrderId: string;
	/** Deal title of the first item. */
	itemName: string;
	/** Who the delivery was for, from the redeem form. */
	recipientName: string;
	deliveredAt: string;
}

/**
 * Result of a rider validation attempt. Failure responses are identical whether or not the
 * Order ID exists (domain rule 8), so `attemptsRemaining` is always present.
 */
export interface ValidateVoucherResponse {
	outcome: ValidationResultOutcome;
	/** Rider-facing message; absent on success. */
	message?: string;
	attemptsRemaining: number;
	/** Present on success only. */
	delivery?: DeliverySummary;
}

/** Dev-only: the voucher the customer's QR code would carry. Used by the simulated scanner. */
export interface DevVoucherResponse {
	voucherCode: string;
}

/** Dev-only: an order out for delivery and its voucher. Used by the "Simulate delivery" shortcut. */
export interface DevDeliveringOrderResponse {
	omsOrderId: string;
	voucherCode: string;
}
