import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { ValidateVoucherRequest } from "@/lib/api/contracts";
import { validateVoucher } from "../api";

/** Sends the rider's Order ID + voucher pair. Every attempt can change the order (attempts,
 * activity, status), so the order caches are refreshed whatever the outcome. */
export function useValidateVoucher() {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: ValidateVoucherRequest) => validateVoucher(body),
		onSuccess: (_result, body) => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(body.omsOrderId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
		},
	});
}
