import { apiClient } from "@/lib/api/client";
import type {
	AssignRiderRequest,
	OrderDetailResponse,
	OrderListResponse,
	UpdateOrderStatusRequest,
} from "@/lib/api/contracts";
import type { Order } from "@/lib/domain";

/**
 * The merchant's orders.
 *
 * No `merchantId` parameter: the access token decides whose orders come back. It used to be a
 * query string the client chose, which made domain rule 14 — merchants see only their own orders
 * — a convention rather than a guarantee.
 */
export function listOrders() {
	return apiClient.get<OrderListResponse>("/orders");
}

export function getOrder(omsOrderId: string) {
	return apiClient.get<OrderDetailResponse>(`/orders/${encodeURIComponent(omsOrderId)}`);
}

export function updateOrderStatus(omsOrderId: string, body: UpdateOrderStatusRequest) {
	return apiClient.patch<Order>(`/orders/${encodeURIComponent(omsOrderId)}/status`, body);
}

export function assignRider(omsOrderId: string, body: AssignRiderRequest) {
	return apiClient.patch<Order>(`/orders/${encodeURIComponent(omsOrderId)}/rider`, body);
}
