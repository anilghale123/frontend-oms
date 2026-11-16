import { ApiError, apiClient } from "@/lib/api/client";
import type {
	AssignRiderRequest,
	ListOrdersParams,
	OrderListResult,
	PortalEnvelope,
	PortalList,
	PortalOrder,
	UpdateOrderStatusRequest,
} from "@/lib/api/contracts";
import { API_ENDPOINTS, withQuery } from "@/lib/api/endpoints";
import { UNREADABLE_RESPONSE_CODE, UNREADABLE_RESPONSE_MESSAGE } from "@/lib/api/errors";
import { toOrder, toOrderList } from "@/lib/api/portal";
import type { Order } from "@/lib/domain";

/**
 * A page of the merchant's orders, newest first.
 *
 * No merchant parameter: the access token decides whose orders come back, so domain rule 14 —
 * merchants see only their own orders — is enforced by the server rather than requested by us.
 */
export async function listOrders(params: ListOrdersParams): Promise<OrderListResult> {
	const body = await apiClient.get<PortalList<PortalOrder> | undefined>(
		withQuery(API_ENDPOINTS.orders.list, {
			q: params.q,
			status: params.status,
			page: params.page,
			count: params.count,
		}),
	);
	// An empty answer is an empty page, which the queue already shows as "No orders yet".
	return toOrderList(body ?? { count: 0, next: null, previous: null, data: [] });
}

/** One order, by the partner's `reference_id`. `404` when it is not this merchant's. */
export async function getOrder(referenceId: string): Promise<Order> {
	const body = await apiClient.get<PortalEnvelope<PortalOrder> | undefined>(
		API_ENDPOINTS.orders.detail(referenceId),
	);
	return orderFrom(body);
}

/** Any status, from any status; the server accepts every move. Returns the changed order. */
export async function updateOrderStatus(
	referenceId: string,
	body: UpdateOrderStatusRequest,
): Promise<Order> {
	const res = await apiClient.post<PortalEnvelope<PortalOrder> | undefined>(
		API_ENDPOINTS.orders.status(referenceId),
		body,
	);
	return orderFrom(res);
}

/** Records the rider and moves the order to `delivering`. Returns the changed order. */
export async function assignRider(referenceId: string, body: AssignRiderRequest): Promise<Order> {
	const res = await apiClient.post<PortalEnvelope<PortalOrder> | undefined>(
		API_ENDPOINTS.orders.assignRider(referenceId),
		body,
	);
	return orderFrom(res);
}

/**
 * The order in a `{ data }` answer. Without one the screen would have nothing to draw, so it is a
 * failure the error state can explain rather than a crash reading `undefined`.
 */
function orderFrom(body: PortalEnvelope<PortalOrder> | undefined): Order {
	if (!body || typeof body.data !== "object" || body.data === null) {
		throw new ApiError(UNREADABLE_RESPONSE_MESSAGE, 200, UNREADABLE_RESPONSE_CODE);
	}
	return toOrder(body.data);
}
