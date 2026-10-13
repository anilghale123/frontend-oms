/**
 * Every OMS API path in one place.
 *
 * Adapted from the eSewa MiniApp's `API_ENDPOINTS` map. Feature `api.ts` wrappers build their
 * requests from these rather than writing path strings inline, so a backend route change is a
 * one-line edit here.
 *
 * Order paths are relative to `OMS_API_BASE` (the `/api/oms` proxy) and have no trailing slash:
 * the Sales service wants one (`orders/`, `orders/{reference_id}/status/`) and the proxy adds it.
 * Every endpoint for one order takes the partner's `reference_id`, not the `OMS-…` id shown on
 * screen (`src/api.md`). No React code in this folder.
 */

const encode = encodeURIComponent;

export const API_ENDPOINTS = {
	orders: {
		/** GET a page of the merchant's orders: `q`, `status`, `page`, `count`. */
		list: "/orders",
		/** GET one order. */
		detail: (referenceId: string) => `/orders/${encode(referenceId)}`,
		/** POST `{ status, remarks? }`. */
		status: (referenceId: string) => `/orders/${encode(referenceId)}/status`,
		/** POST `{ rider, remarks? }`. Records the rider and moves the order to `delivering`. */
		assignRider: (referenceId: string) => `/orders/${encode(referenceId)}/assign-rider`,
	},
	rider: {
		/** POST `{ order_id, voucher_code }`, relative to `RIDER_API_BASE`. */
		deliver: "/deliver",
	},
} as const;

/** `path?a=1&b=2`, leaving out empty values; `path` alone when nothing is set. */
export function withQuery(
	path: string,
	params: Record<string, string | number | undefined | null>,
): string {
	const query = new URLSearchParams();
	for (const [key, value] of Object.entries(params)) {
		if (value === undefined || value === null || value === "") continue;
		query.set(key, String(value));
	}
	const search = query.toString();
	return search ? `${path}?${search}` : path;
}
