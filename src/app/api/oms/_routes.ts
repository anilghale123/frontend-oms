import "server-only";
import { z } from "zod";
import { isOrderStatus } from "@/lib/domain";

/**
 * The Sales portal routes the `/api/oms/*` proxy forwards, and nothing else.
 *
 * The proxy attaches the merchant's token to whatever it forwards, so it must not be a general
 * relay into `api/oms/portal/`: a path, query key or body field the screens never send is refused
 * here rather than reaching Sales with a credential on it. The list mirrors `API_ENDPOINTS.orders`
 * in `@/lib/api/endpoints` (a test keeps the two in step), and the bodies mirror
 * `UpdateOrderStatusRequest` and `AssignRiderRequest` in `@/lib/api/contracts` — those are
 * TypeScript types only, so this is the one place they are checked at run time.
 */

/** The Sales API shows the remark to the customer and refuses more than 255 characters. */
const REMARKS = z.string().trim().max(255).optional();

const statusBody = z.object({
	status: z.string().refine(isOrderStatus, "Unknown status"),
	remarks: REMARKS,
});

const assignRiderBody = z.object({
	rider: z.object({
		name: z.string().trim().min(1).max(100),
		phone: z.string().trim().min(1).max(20),
		vehicle_number: z.string().trim().min(1).max(30),
	}),
	remarks: REMARKS,
});

/** The order list's query: what `listOrders` sends, and only that. */
const listQuery = z.object({
	q: z.string().trim().min(1).max(100).optional(),
	status: z.string().refine(isOrderStatus, "Unknown status").optional(),
	page: z.coerce.number().int().min(1).max(100_000).optional(),
	count: z.coerce.number().int().min(1).max(100).optional(),
});

/** A partner `reference_id`: one non-empty path segment, never `.` or `..`, no control characters. */
function isOrderId(segment: string | undefined): segment is string {
	return (
		typeof segment === "string" &&
		segment !== "." &&
		segment !== ".." &&
		/^[^\x00-\x1F\x7F]{1,100}$/.test(segment)
	);
}

export type ProxyRoute =
	| {
			ok: true;
			/** The path under `api/oms/portal/`, each segment encoded, without the trailing slash. */
			path: string;
			/** `?…` for the order list, `""` otherwise. Unknown keys are dropped. */
			search: string;
			/** The schema the `POST` body must pass, forwarded as parsed; `null` for `GET`. */
			body: z.ZodType | null;
	  }
	| { ok: false; status: 400 | 404; code: string; message: string };

const NOT_FOUND: ProxyRoute = {
	ok: false,
	status: 404,
	code: "not_found",
	message: "No such OMS endpoint.",
};

/**
 * Which allowed route `method` + `segments` names, with its query and body rules. `segments` are
 * the decoded path segments Next hands the catch-all route.
 */
export function matchProxyRoute(
	method: string,
	segments: readonly string[],
	searchParams: URLSearchParams,
): ProxyRoute {
	const [resource, id, action, ...rest] = segments;
	if (resource !== "orders" || rest.length > 0) return NOT_FOUND;

	// GET orders — the list.
	if (id === undefined) {
		if (method !== "GET") return NOT_FOUND;
		const query = listQuery.safeParse(Object.fromEntries(searchParams));
		if (!query.success) {
			return { ok: false, status: 400, code: "invalid_query", message: "Invalid list query." };
		}
		const search = new URLSearchParams();
		for (const [key, value] of Object.entries(query.data)) {
			if (value !== undefined) search.set(key, String(value));
		}
		const text = search.toString();
		return { ok: true, path: "orders", search: text ? `?${text}` : "", body: null };
	}

	if (!isOrderId(id)) return NOT_FOUND;
	const order = `orders/${encodeURIComponent(id)}`;

	// GET orders/{id} — one order.
	if (action === undefined) {
		return method === "GET" ? { ok: true, path: order, search: "", body: null } : NOT_FOUND;
	}

	if (method !== "POST") return NOT_FOUND;
	if (action === "status") {
		return { ok: true, path: `${order}/status`, search: "", body: statusBody };
	}
	if (action === "assign-rider") {
		return { ok: true, path: `${order}/assign-rider`, search: "", body: assignRiderBody };
	}
	return NOT_FOUND;
}
