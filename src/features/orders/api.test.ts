import { afterEach, describe, expect, it, vi } from "vitest";
import { apiClient } from "@/lib/api/client";
import { listOrders } from "./api";

vi.mock("@/lib/api/portal", () => ({
	toOrder: (wire: unknown) => wire,
	toOrderList: (wire: { count: number; next: string | null; data: unknown[] }) => ({
		orders: wire.data,
		total: wire.count,
		hasNext: Boolean(wire.next),
		hasPrevious: false,
	}),
}));

/** A Sales service holding `total` orders, 100 to a page. */
function serve(total: number) {
	return vi.spyOn(apiClient, "get").mockImplementation(async (path: string) => {
		const page = Number(new URL(path, "http://oms").searchParams.get("page"));
		const start = (page - 1) * 100;
		const length = Math.max(0, Math.min(100, total - start));
		return {
			count: total,
			next: start + length < total ? "next" : null,
			previous: null,
			data: Array.from({ length }, (_, i) => ({ referenceId: `R${start + i}` })),
		} as never;
	});
}

afterEach(() => vi.restoreAllMocks());

describe("listOrders with a large page", () => {
	it("combines server pages in order", async () => {
		const get = serve(2500);
		const result = await listOrders({ page: 2, count: 1000 });
		expect(get).toHaveBeenCalledTimes(10);
		expect(result.orders).toHaveLength(1000);
		expect(result.orders[0].referenceId).toBe("R1000");
		expect(result.orders[999].referenceId).toBe("R1999");
		expect(result.hasNext).toBe(true);
	});

	it("asks only for the pages that exist", async () => {
		const get = serve(230);
		const result = await listOrders({ page: 1, count: 5000 });
		expect(get).toHaveBeenCalledTimes(3);
		expect(result.orders).toHaveLength(230);
		expect(result.total).toBe(230);
		expect(result.hasNext).toBe(false);
	});

	it("stops asking once aborted", async () => {
		const get = serve(5000);
		const controller = new AbortController();
		controller.abort();
		await expect(listOrders({ page: 1, count: 5000 }, controller.signal)).rejects.toThrow();
		expect(get).toHaveBeenCalledTimes(1);
	});
});
