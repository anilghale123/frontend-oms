/**
 * While OMS waits for a token, the gate draws the queue in `placeholder` mode. The orders query in
 * the cache then holds the 401 that started the wait, and the placeholder must still look like
 * the queue loading — skeleton rows — never "Couldn't load orders".
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { OrderQueuePage } from "./order-queue-page";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), prefetch: vi.fn() }) }));

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
