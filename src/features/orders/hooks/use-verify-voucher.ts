import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { queryKeys } from "@/lib/api/query-keys";
import type { Order } from "@/lib/domain";
import { verifyVoucher } from "../api";
import { applyChangedOrder, reportMutationError } from "./use-orders";

/**
 * The merchant's voucher check for an order that is out for delivery. The server marks the order
 * Delivered when the customer's code matches, so a success is the only way an order becomes
 * Delivered from this screen. The order on screen is then replaced with the one the server sent
 * back, or refetched when it sent none. A failure is thrown for the section to show next to the
 * field; a `409` (the order moved on meanwhile) also reloads the order.
 */
export function useVerifyVoucher(order: Pick<Order, "omsOrderId" | "referenceId">) {
	const queryClient = useQueryClient();
	const mutation = useMutation({
		mutationFn: (voucherCode: string) => verifyVoucher(order.referenceId, voucherCode),
		onSuccess: (changed) => {
			if (changed) {
				applyChangedOrder(queryClient, changed);
			} else {
				void queryClient.invalidateQueries({
					queryKey: queryKeys.orders.detail(order.referenceId),
				});
				void queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists });
			}
			toast.success(`Delivered: ${order.omsOrderId}`);
		},
		onError: (error) =>
			reportMutationError(queryClient, order.referenceId, error, { toast: false }),
	});

	return { verify: mutation.mutateAsync, pending: mutation.isPending };
}
