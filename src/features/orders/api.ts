import { apiClient } from "@/lib/api/client";
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
import { toOrder, toOrderList } from "@/lib/api/portal";
import type { Order } from "@/lib/domain";

/**
 * A page of the merchant's orders, newest first.
 *
 * No merchant parameter: the access token decides whose orders come back, so domain rule 14 —
 * merchants see only their own orders — is enforced by the server rather than requested by us.
 */
export async function listOrders(params: ListOrdersParams): Promise<OrderListResult> {
	const body = await apiClient.get<PortalList<PortalOrder>>(
		withQuery(API_ENDPOINTS.orders.list, {
			q: params.q,
			status: params.status,
			page: params.page,
			count: params.count,
		}),
	);
	return toOrderList(body);
}

/** One order, by the partner's `reference_id`. `404` when it is not this merchant's. */
export async function getOrder(referenceId: string): Promise<Order> {
	const body = await apiClient.get<PortalEnvelope<PortalOrder>>(
		API_ENDPOINTS.orders.detail(referenceId),
	);
	return toOrder(body.data);
}

/** Any status, from any status; the server accepts every move. Returns the changed order. */
export async function updateOrderStatus(
	referenceId: string,
	body: UpdateOrderStatusRequest,
): Promise<Order> {
	const res = await apiClient.post<PortalEnvelope<PortalOrder>>(
		API_ENDPOINTS.orders.status(referenceId),
		body,
	);
	return toOrder(res.data);
}

/** Records the rider and moves the order to `delivering`. Returns the changed order. */
export async function assignRider(referenceId: string, body: AssignRiderRequest): Promise<Order> {
	const res = await apiClient.post<PortalEnvelope<PortalOrder>>(
		API_ENDPOINTS.orders.assignRider(referenceId),
		body,
	);
	return toOrder(res.data);
}
