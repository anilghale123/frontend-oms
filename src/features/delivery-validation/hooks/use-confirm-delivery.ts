import { useMutation } from "@tanstack/react-query";
import type { DeliveryValidationValues } from "../schema";
import { confirmDelivery } from "../api";

/**
 * Sends the rider's Order ID + voucher pair. A rider has no session, so nothing is cached here:
 * the merchant's screens see the order become Delivered on their next fetch.
 */
export function useConfirmDelivery() {
	return useMutation({
		mutationFn: (values: DeliveryValidationValues) =>
			confirmDelivery({
				order_id: values.orderId,
				voucher_code: values.voucherCode,
				turnstileToken: values.turnstileToken,
			}),
	});
}
