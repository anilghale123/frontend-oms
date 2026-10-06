/**
 * Every OMS API path in one place.
 *
 * Adapted from the eSewa MiniApp's `API_ENDPOINTS` map. Feature `api.ts` wrappers build their
 * requests from these rather than writing path strings inline, so a backend route change is a
 * one-line edit here.
 *
 * Paths are relative to `OMS_API_BASE` (`@/config/env`) and must not start with a slash-prefixed
 * origin. No React code in this folder.
 */

const encode = encodeURIComponent;

export const API_ENDPOINTS = {
	orders: {
		/** GET list (optionally scoped to one merchant), POST create (idempotent on the reference). */
		list: "/orders",
		/** GET one order plus its activity log. */
		detail: (omsOrderId: string) => `/orders/${encode(omsOrderId)}`,
		/** PATCH a fulfillment status transition. */
		status: (omsOrderId: string) => `/orders/${encode(omsOrderId)}/status`,
		/** PATCH rider name, phone and vehicle number. */
		rider: (omsOrderId: string) => `/orders/${encode(omsOrderId)}/rider`,
	},
	/** POST the rider's Order ID + voucher pair. */
	validate: "/validate",
	/**
	 * Prototype-only backdoors used by the rider portal's simulated QR scan and
	 * "Simulate delivery" shortcut. Remove with the mock backend.
	 */
	dev: {
		voucher: (omsOrderId: string) => `/dev/voucher/${encode(omsOrderId)}`,
		delivering: "/dev/delivering",
	},
} as const;

/** `?merchantId=...` when scoping the order list to one merchant, else an empty string. */
export function merchantQuery(merchantId?: string): string {
	return merchantId ? `?merchantId=${encode(merchantId)}` : "";
}
