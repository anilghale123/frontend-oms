/**
 * While OMS waits for a token, the gate draws the queue in `placeholder` mode. The orders query in
 * the cache then holds the 401 that started the wait, and the placeholder must still look like
 * the queue loading — skeleton rows — never "Couldn't load orders".
 *
 * And an order opens only from its row's "More actions" menu, never by clicking the row.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderQueuePage } from "./order-queue-page";

const router = vi.hoisted(() => ({ push: vi.fn(), prefetch: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => router }));

/** One order, in the Sales API's wire format (`src/api.md`). */
const ORDERS_PAGE = {
	count: 1,
	next: null,
	previous: null,
	data: [
		{
			reference_id: "ORD001",
			order_id: "OMS-0427",
			merchant_detail: { id: "M-1029", name: "ABC", contact: "9801234567", pan: "123456789" },
			customer_detail: {
				identifier: "FPU-55821",
				name: "John Doe",
				contact: "9812345678",
				delivery_address: "Pulchok",
			},
			items: [{ product_id: "SKU-7781", name: "phone", qty: 1, unit_name: "pcs" }],
			status: "preparing",
			redemption_value_type: "points_money",
			redeem_points: 1000,
			amount: 100,
			rider: null,
			additional_info: null,
			logs: [],
			created: "2026-10-09 10:30",
		},
	],
};

function renderQueue(client: QueryClient, placeholder: boolean) {
	return render(
		<QueryClientProvider client={client}>
			<OrderQueuePage placeholder={placeholder} />
		</QueryClientProvider>,
	);
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
});

describe("OrderQueuePage placeholder", () => {
	it("shows skeleton rows, not the cached 401, while OMS waits for a token", async () => {
		// The proxy's answer when there is no session yet.
		const fetchMock = vi.fn(async () =>
			Response.json({ error: { code: "no_session", message: "No OMS session" } }, { status: 401 }),
		);
		vi.stubGlobal("fetch", fetchMock);
		const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });

		// The real queue's first request fails for want of a session...
		renderQueue(client, false);
		await screen.findByText("Couldn’t load orders");
		cleanup();

		// ...and the gate swaps in the placeholder, over the same cached query.
		const { container } = renderQueue(client, true);

		await waitFor(() =>
			expect(container.querySelectorAll('[data-slot="skeleton"]').length).toBeGreaterThan(0),
		);
		expect(screen.queryByText("Couldn’t load orders")).toBeNull();
		// And it asks for nothing: the placeholder never fetches.
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});
});

describe("OrderQueuePage row actions", () => {
	it("opens an order from View details, not from a row click", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => Response.json(ORDERS_PAGE)),
		);
		router.push.mockClear();
		renderQueue(new QueryClient({ defaultOptions: { queries: { retry: false } } }), false);

		fireEvent.click(await screen.findByText("OMS-0427"));
		expect(router.push).not.toHaveBeenCalled();

		const trigger = screen.getByRole("button", { name: "More actions for OMS-0427" });
		fireEvent.keyDown(trigger, { key: "Enter" });
		fireEvent.click(await screen.findByRole("menuitem", { name: "View details" }));
		expect(router.push).toHaveBeenCalledWith("/orders/ORD001");
	});
});
