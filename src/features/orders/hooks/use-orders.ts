import {
	keepPreviousData,
	useMutation,
	useQuery,
	useQueryClient,
	type QueryClient,
} from "@tanstack/react-query";
import { toast } from "sonner";
import { ApiError } from "@/lib/api/client";
import { toErrorMessage } from "@/lib/api/errors";
import { queryKeys } from "@/lib/api/query-keys";
import type {
	AssignRiderRequest,
	ListOrdersParams,
	UpdateOrderStatusRequest,
} from "@/lib/api/contracts";
import { ORDER_STATUS_LABELS, type Order, type OrderStatus } from "@/lib/domain";
import { assignRider, getOrder, listOrders, updateOrderStatus } from "../api";

export interface OrderQueryOptions {
	/** `false` holds the request back, e.g. for a screen drawn before there is a session. */
	enabled?: boolean;
}

/**
 * A page of the merchant's orders, filtered and searched by the API.
 *
 * The previous page stays on screen while the next one loads, so paging and filtering do not
 * flash an empty table. Takes no merchant: the token decides whose orders these are.
 */
export function useOrders(params: ListOrdersParams, { enabled = true }: OrderQueryOptions = {}) {
	return useQuery({
		queryKey: queryKeys.orders.list({ ...params }),
		queryFn: () => listOrders(params),
		placeholderData: keepPreviousData,
		enabled,
	});
}

/** One order, by the partner's `reference_id`. */
export function useOrder(referenceId: string, { enabled = true }: OrderQueryOptions = {}) {
	return useQuery({
		queryKey: queryKeys.orders.detail(referenceId),
		queryFn: () => getOrder(referenceId),
		enabled: enabled && Boolean(referenceId),
	});
}

/** "Mark ready" → "Marked ready": the toast names the action the button did. */
const STATUS_DONE: Partial<Record<OrderStatus, string>> = {
	ready_for_delivery: "Marked ready",
	delivered: "Marked delivered",
	failed: "Marked failed",
};

function statusToast(status: OrderStatus): string {
	return STATUS_DONE[status] ?? `Changed to ${ORDER_STATUS_LABELS[status].toLowerCase()}`;
}

/** Changes the status of the order `referenceId` names. */
export function useUpdateOrderStatus(referenceId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: UpdateOrderStatusRequest) => updateOrderStatus(referenceId, body),
		onSuccess: (order, body) => {
			applyChangedOrder(queryClient, order);
			toast.success(`${statusToast(body.status)}: ${order.omsOrderId}`);
		},
		onError: (error) => reportMutationError(queryClient, referenceId, error),
	});
}

/** Records a rider for the order `referenceId` names; the order moves to `delivering`. */
export function useAssignRider(referenceId: string) {
	const queryClient = useQueryClient();
	return useMutation({
		mutationFn: (body: AssignRiderRequest) => assignRider(referenceId, body),
		onSuccess: (order) => {
			applyChangedOrder(queryClient, order);
			toast.success(`Rider assigned: ${order.omsOrderId}`);
		},
		// The dialog shows the message itself, next to the form, so no toast here.
		onError: (error) => reportMutationError(queryClient, referenceId, error, { toast: false }),
	});
}

/**
 * The server sends the changed order back, so the detail is updated in place rather than
 * refetched — one request fewer against the 60-a-minute limit. Lists are refetched, because the
 * order may now belong under another status filter.
 */
export function applyChangedOrder(queryClient: QueryClient, order: Order) {
	queryClient.setQueryData(queryKeys.orders.detail(order.referenceId), order);
	void queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists });
}

/**
 * What every order mutation does when it fails (`src/api.md`, "Errors"):
 *
 * - `401` — nothing here; the session gate takes over and asks the portal for a new token.
 * - `409` — the order changed meanwhile. Show the server's message and reload the order, so the
 *   screen shows what actually happened.
 * - anything else (`400`, `429`, `503`, offline) — show the message. No automatic retry.
 *
 * Field errors from a `400` are also toasted here; a form that can place them next to a field
 * catches the error itself as well.
 */
export function reportMutationError(
	queryClient: QueryClient,
	referenceId: string,
	error: unknown,
	options: { toast?: boolean } = {},
) {
	if (error instanceof ApiError && error.status === 401) return;
	if (options.toast !== false) toast.error(toErrorMessage(error));
	if (error instanceof ApiError && error.status === 409) {
		void queryClient.invalidateQueries({ queryKey: queryKeys.orders.detail(referenceId) });
		void queryClient.invalidateQueries({ queryKey: queryKeys.orders.lists });
	}
}
