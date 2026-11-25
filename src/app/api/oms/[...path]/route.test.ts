// @vitest-environment node
/**
 * The `/api/oms/*` proxy forwards only the routes the screens use, checks their bodies before the
 * merchant's token is attached, and refuses cross-origin callers on every method.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { GET, POST } from "./route";

const SALES_PORTAL_API = "https://sales.test/api/oms/portal/";
const ORIGIN = "http://localhost:3000";

vi.mock("@/config/server-env", () => ({
	OMS_PUBLIC_ORIGIN: null,
	SALES_CONFIG_PROBLEM: null,
	SALES_PORTAL_API: "https://sales.test/api/oms/portal/",
	UPSTREAM_TIMEOUT_MS: 15_000,
	salesUnreachableMessage: () => "Couldn't reach the Sales service.",
}));

const cookie = vi.hoisted(() => ({
	token: "merchant-token" as string | null,
	cleared: 0,
}));

vi.mock("../../session/_cookie", () => ({
	readSessionCookie: async () => cookie.token,
	clearSessionCookie: async () => {
		cookie.cleared += 1;
	},
}));

function stubSales(answer: () => Response = () => Response.json({ data: [] })) {
	const fetchMock = vi.fn(async () => answer());
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

/** The path segments Next would hand the catch-all route for `/api/oms/<path>`. */
function ctx(path: string) {
	const segments = path.split("/").filter(Boolean).map(decodeURIComponent);
	return { params: Promise.resolve({ path: segments }) };
}

function get(path: string, headers: Record<string, string> = {}) {
	return GET(new Request(`${ORIGIN}/api/oms/${path}`, { headers }), ctx(path.split("?")[0]));
}

function post(path: string, body: unknown, headers: Record<string, string> = {}) {
	return POST(
		new Request(`${ORIGIN}/api/oms/${path}`, {
			method: "POST",
			headers: { "content-type": "application/json", origin: ORIGIN, ...headers },
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
		ctx(path),
	);
}

function forwarded(fetchMock: ReturnType<typeof stubSales>) {
	const call = fetchMock.mock.calls[0] as unknown as [string, RequestInit] | undefined;
	return call ? { url: call[0], init: call[1] } : null;
}

async function errorCode(res: Response) {
	return ((await res.json()) as { error: { code: string } }).error.code;
}

beforeEach(() => {
	cookie.token = "merchant-token";
	cookie.cleared = 0;
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
	vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("allowed routes", () => {
	it("forwards the order list with its known query keys only, and the token", async () => {
		const fetchMock = stubSales();
		const res = await get("orders?q=ram&status=preparing&page=2&count=20&merchant=other");

		expect(res.status).toBe(200);
		const call = forwarded(fetchMock);
		expect(call?.url).toBe(`${SALES_PORTAL_API}orders/?q=ram&status=preparing&page=2&count=20`);
		expect((call?.init.headers as Record<string, string>).authorization).toBe(
			"Bearer merchant-token",
		);
	});

	it("forwards one order, encoding its id again", async () => {
		const fetchMock = stubSales(() => Response.json({ data: {} }));
		await get("orders/ORD%20001");
		expect(forwarded(fetchMock)?.url).toBe(`${SALES_PORTAL_API}orders/ORD%20001/`);
	});

	it("forwards a status change as parsed, dropping fields the endpoint does not take", async () => {
		const fetchMock = stubSales(() => Response.json({ data: {} }));
		const res = await post("orders/ORD001/status", {
			status: "ready_for_delivery",
			remarks: " Packed ",
			merchant_id: "someone-else",
		});

		expect(res.status).toBe(200);
		const call = forwarded(fetchMock);
		expect(call?.url).toBe(`${SALES_PORTAL_API}orders/ORD001/status/`);
		expect(JSON.parse(String(call?.init.body))).toEqual({
			status: "ready_for_delivery",
			remarks: "Packed",
		});
	});

	it("matches every order endpoint the screens call", async () => {
		const { list, detail, status, assignRider } = API_ENDPOINTS.orders;
		const paths = [list, detail("ORD001")];
		for (const path of paths) {
			stubSales();
			expect((await get(path.slice(1))).status).toBe(200);
		}

		stubSales();
		expect((await post(status("ORD001").slice(1), { status: "delivered" })).status).toBe(200);
		stubSales();
		const rider = { rider: { name: "Hari", phone: "9841122334", vehicle_number: "BA 1 PA 1234" } };
		expect((await post(assignRider("ORD001").slice(1), rider)).status).toBe(200);
	});
});

describe("refused before Sales is asked", () => {
	it("answers 404 for a path the screens never use", async () => {
		const fetchMock = stubSales();
		for (const path of ["customers", "orders/ORD001/refund", "orders/ORD001/status/extra"]) {
			const res = await get(path);
			expect(res.status).toBe(404);
		}
		expect((await post("orders", {})).status).toBe(404);
		expect((await get("orders/ORD001/status")).status).toBe(404);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a `.` or `..` segment, so a request cannot climb out of the portal API", async () => {
		const fetchMock = stubSales();
		expect((await get("orders/%2E%2E")).status).toBe(404);
		expect((await get("orders/.")).status).toBe(404);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a status that does not exist", async () => {
		const fetchMock = stubSales();
		const res = await post("orders/ORD001/status", { status: "cancelled" });
		expect(res.status).toBe(400);
		expect(await errorCode(res)).toBe("invalid_body");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a remark longer than the 255 characters Sales accepts", async () => {
		const fetchMock = stubSales();
		const res = await post("orders/ORD001/status", { status: "failed", remarks: "x".repeat(256) });
		expect(res.status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a body that is not JSON, and one that is too large", async () => {
		const fetchMock = stubSales();
		expect((await post("orders/ORD001/status", "{not json")).status).toBe(400);
		const huge = { status: "failed", remarks: "x".repeat(20_000) };
		expect((await post("orders/ORD001/status", huge)).status).toBe(413);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses an invalid list query", async () => {
		const fetchMock = stubSales();
		expect((await get("orders?count=5000")).status).toBe(400);
		expect((await get("orders?status=cancelled")).status).toBe(400);
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a cross-origin caller on GET as well as POST", async () => {
		const fetchMock = stubSales();
		const foreign = { origin: "https://evil.test" };
		expect((await get("orders", foreign)).status).toBe(403);
		expect((await get("orders", { ...foreign, "x-oms-token": "guess" })).status).toBe(403);
		expect((await post("orders/ORD001/status", { status: "failed" }, foreign)).status).toBe(403);
		expect(fetchMock).not.toHaveBeenCalled();
	});
});

describe("session", () => {
	it("answers 401 no_session without asking Sales when there is no token", async () => {
		cookie.token = null;
		const fetchMock = stubSales();
		const res = await get("orders");
		expect(res.status).toBe(401);
		expect(await errorCode(res)).toBe("no_session");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("clears the cookie when Sales refuses the token", async () => {
		stubSales(() => Response.json({ detail: "Invalid token" }, { status: 401 }));
		const res = await get("orders");
		expect(res.status).toBe(401);
		expect(cookie.cleared).toBe(1);
	});
});
