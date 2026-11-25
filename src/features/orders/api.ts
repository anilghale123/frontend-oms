import { ApiError, apiClient } from "@/lib/api/client";
import {
	MAX_PAGE_SIZE,
	type AssignRiderRequest,
	type ListOrdersParams,
	type OrderListResult,
	type PortalEnvelope,
	type PortalList,
	type PortalOrder,
	type RiderDeliverResponse,
	type UpdateOrderStatusRequest,
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
 *
 * A `count` above `MAX_PAGE_SIZE` (it must be a multiple of it) is put together from several
 * server pages. `signal` stops asking for more of them once nobody wants the answer.
 */
export async function listOrders(
	params: ListOrdersParams,
	signal?: AbortSignal,
): Promise<OrderListResult> {
	const count = params.count ?? MAX_PAGE_SIZE;
	return count > MAX_PAGE_SIZE ? listLargePage(params, count, signal) : listServerPage(params);
}

/** Server pages asked for at once while putting a large page together. */
const PARALLEL_PAGES = 5;

/**
 * The Sales API serves at most `MAX_PAGE_SIZE` orders per request, so 1000 or 5000 rows take 10 or
 * 50 requests, of the 60 a minute it allows. Only pages that exist are asked for, and any failure
 * fails the whole page rather than showing a list with a hole in it.
 */
async function listLargePage(
	params: ListOrdersParams,
	count: number,
	signal?: AbortSignal,
): Promise<OrderListResult> {
	const pagesPerView = count / MAX_PAGE_SIZE;
	const firstPage = ((params.page ?? 1) - 1) * pagesPerView + 1;
	const serverPage = (page: number) => listServerPage({ ...params, page, count: MAX_PAGE_SIZE });

	// The first answer says how many orders there are, and so which other pages exist.
	const first = await serverPage(firstPage);
	const lastPage = Math.min(firstPage + pagesPerView - 1, Math.ceil(first.total / MAX_PAGE_SIZE));

	const results = [first];
	for (let page = firstPage + 1; page <= lastPage; page += PARALLEL_PAGES) {
		signal?.throwIfAborted();
		const size = Math.min(PARALLEL_PAGES, lastPage - page + 1);
		results.push(
			...(await Promise.all(Array.from({ length: size }, (_, i) => serverPage(page + i)))),
		);
	}

	// An order placed while these were loading shifts the rest down one, repeating a row.
	const orders = new Map(
		results.flatMap((result) => result.orders).map((order) => [order.referenceId, order]),
	);
	return {
		orders: [...orders.values()],
		total: first.total,
		hasNext: results[results.length - 1].hasNext,
		hasPrevious: first.hasPrevious,
	};
}

async function listServerPage(params: ListOrdersParams): Promise<OrderListResult> {
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
 * Checks the customer's voucher code for an order that is out for delivery. When it matches, the
 * server marks the order Delivered and sends it back; a wrong code is a `400` with the server's
 * message. Returns `null` if the server confirmed without sending the order.
 */
export async function verifyVoucher(
	referenceId: string,
	voucherCode: string,
): Promise<Order | null> {
	const res = await apiClient.post<RiderDeliverResponse | undefined>(
		API_ENDPOINTS.orders.verifyVoucher(referenceId),
		{ voucher_code: voucherCode },
	);
	return res?.data ? toOrder(res.data) : null;
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
