import { riderApiClient } from "@/lib/api/client";
import type { RiderDeliverBody, RiderDeliverResponse } from "@/lib/api/contracts";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { toOrder } from "@/lib/api/portal";
import type { Order } from "@/lib/domain";

/** What the rider sees after a confirmed delivery: the order when the server sent it back. */
export interface DeliveryResult {
	order: Order | null;
	message: string | null;
}

/**
 * The rider's Order ID + voucher pair, checked by the Sales service. A wrong pair is a `400` with
 * the server's message (`"Invalid order id or voucher code."`), thrown as `ApiError`. The
 * Turnstile token goes with it and is checked first; a refused token is also a `400`, with
 * `code` `RIDER_VERIFICATION_FAILED`, and Sales is never asked.
 */
export async function confirmDelivery(body: RiderDeliverBody): Promise<DeliveryResult> {
	const res = await riderApiClient.post<RiderDeliverResponse | undefined>(
		API_ENDPOINTS.rider.deliver,
		body,
	);
	return {
		order: res?.data ? toOrder(res.data) : null,
		message: typeof res?.message === "string" ? res.message : null,
	};
}
