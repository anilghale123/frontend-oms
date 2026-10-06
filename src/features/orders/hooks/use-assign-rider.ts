import { useMutation, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { AssignRiderRequest } from "@/lib/api/contracts";
import { assignRider } from "../api";

export function useAssignRider(omsOrderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: AssignRiderRequest) => assignRider(omsOrderId, body),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(omsOrderId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
		},
	});
}
