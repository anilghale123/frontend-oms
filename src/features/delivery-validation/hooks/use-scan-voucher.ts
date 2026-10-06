import { useMutation } from "@tanstack/react-query";
import { getDevVoucher } from "../api";

/** Simulated QR scan: reads the voucher the customer's QR would carry. Changes nothing, so it
 * doesn't ask other tabs to refetch. */
export function useScanVoucher() {
	return useMutation({
		mutationFn: async (omsOrderId: string) => (await getDevVoucher(omsOrderId)).voucherCode,
		meta: { syncTabs: false },
	});
}
