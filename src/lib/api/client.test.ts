/**
 * A success is a success whatever its body: an empty one resolves, and only a body that is there
 * but unreadable fails — with a message, not a raw `SyntaxError`.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, apiClient, riderApiClient } from "./client";
import { UNREADABLE_RESPONSE_CODE } from "./errors";

function answer(body: string | null, status = 200, contentType = "application/json") {
	vi.stubGlobal(
		"fetch",
		vi.fn(async () => new Response(body, { status, headers: { "content-type": contentType } })),
	);
}

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("successful responses", () => {
	it("resolves a 200 with an empty body, as the rider's confirmation may be", async () => {
		answer("");
		await expect(riderApiClient.post("/deliver", { order_id: "OMS-1" })).resolves.toBeUndefined();
	});

	it("resolves a 204", async () => {
		answer(null, 204);
		await expect(apiClient.post("/orders/ORD001/status", { status: "failed" })).resolves.toBe(
			undefined,
		);
	});

	it("parses a JSON body", async () => {
		answer(JSON.stringify({ message: "Order delivered." }));
		await expect(riderApiClient.post("/deliver", {})).resolves.toEqual({
			message: "Order delivered.",
		});
	});

	it("fails with a readable ApiError when the body is not JSON", async () => {
		answer("<html>Gateway</html>", 200, "text/html");
		const error = await riderApiClient.post("/deliver", {}).catch((e: unknown) => e);
		expect(error).toBeInstanceOf(ApiError);
		expect((error as ApiError).code).toBe(UNREADABLE_RESPONSE_CODE);
		// Reached the server: not reported as a connection problem.
		expect((error as ApiError).status).toBe(200);
	});
});
