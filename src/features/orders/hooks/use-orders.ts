import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/lib/api/query-keys";
import type { UpdateOrderStatusRequest } from "@/lib/api/contracts";
import { getOrder, listOrders, updateOrderStatus } from "../api";

/** Failed is hidden for now, so failed orders are left out of every list (rows and counts). */
const HIDE_FAILED = true;

/**
 * The merchant's orders.
 *
 * Takes no merchant: the backend scopes the list to the access token's merchant, so there is
 * nothing for a caller to pass and nothing it could widen. The query key stays unparameterised
 * for the same reason — one session, one list.
 */
export function useOrders() {
	return useQuery({
		queryKey: queryKeys.orders.list(),
		queryFn: () => listOrders(),
		select: (orders) =>
			HIDE_FAILED ? orders.filter((order) => order.status !== "failed") : orders,
	});
}

export function useOrder(omsOrderId: string) {
	return useQuery({
		queryKey: queryKeys.orders.detail(omsOrderId),
		queryFn: () => getOrder(omsOrderId),
		enabled: Boolean(omsOrderId),
	});
}

export function useUpdateOrderStatus(omsOrderId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdateOrderStatusRequest) => updateOrderStatus(omsOrderId, body),
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(omsOrderId) });
			void queryClient.invalidateQueries({ queryKey: queryKeys.orders.all });
		},
	});
}
