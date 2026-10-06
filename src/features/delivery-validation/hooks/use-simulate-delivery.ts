import { useMutation } from "@tanstack/react-query";
import type { DevDeliveringOrderResponse } from "@/lib/api/contracts";
import { getDevDeliveringOrder, getDevVoucher } from "../api";

/** Prototype shortcut: finds the Order ID + voucher pair a successful delivery needs. Uses the
 * typed Order ID when there is one, else an order out for delivery. Reads only, so it doesn't ask
 * other tabs to refetch; the confirm that follows does. */
export function useSimulateDelivery() {
	return useMutation({
		mutationFn: async (omsOrderId: string): Promise<DevDeliveringOrderResponse> => {
			if (omsOrderId) {
				return { omsOrderId, voucherCode: (await getDevVoucher(omsOrderId)).voucherCode };
			}
			return getDevDeliveringOrder();
		},
		meta: { syncTabs: false },
	});
}
