/**
 * The portal keeps the OMS frame alive between visits and says `host.visible` when the merchant
 * comes back: OMS refreshes what went stale while it was hidden, and nothing else.
 */

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { HOST_SOURCE, PROTOCOL_VERSION } from "@/lib/host";
import { HostChannelProvider } from "./HostChannelProvider";
import { HostSync } from "./HostSync";

const navigation = vi.hoisted(() => ({ replace: vi.fn(), pathname: "/embed/orders/ORD008" }));
vi.mock("next/navigation", () => ({
	useRouter: () => ({ replace: navigation.replace }),
	usePathname: () => navigation.pathname,
}));

const HOST_ORIGIN = "http://localhost:4200";

function framed() {
	const parent = { postMessage: () => {} };
	vi.spyOn(window, "parent", "get").mockReturnValue(parent as unknown as Window);
	return parent;
}

function renderSync() {
	const client = new QueryClient();
	const refetch = vi.spyOn(client, "refetchQueries").mockResolvedValue();
	render(
		<QueryClientProvider client={client}>
			<HostChannelProvider>
				<HostSync />
			</HostChannelProvider>
		</QueryClientProvider>,
	);
	return refetch;
}

function post(source: unknown, origin = HOST_ORIGIN, data: Record<string, unknown> = {}) {
	const event = new MessageEvent("message", {
		data: { source: HOST_SOURCE, v: PROTOCOL_VERSION, type: "host.visible", ...data },
		origin,
	});
	Object.defineProperty(event, "source", { value: source });
	window.dispatchEvent(event);
}

afterEach(() => {
	cleanup();
	vi.restoreAllMocks();
	navigation.replace.mockReset();
	navigation.pathname = "/embed/orders/ORD008";
});

describe("HostSync — host.visible", () => {
	it("refreshes only the stale queries on screen when the portal shows OMS again", () => {
		const parent = framed();
		const refetch = renderSync();

		post(parent);

		expect(refetch).toHaveBeenCalledTimes(1);
		expect(refetch).toHaveBeenCalledWith({ type: "active", stale: true });
	});

	it("ignores the message from anyone but the portal", () => {
		framed();
		const refetch = renderSync();

		post(window, HOST_ORIGIN);
		post(window.parent, "https://evil.example");

		expect(refetch).not.toHaveBeenCalled();
	});
});

describe("HostSync — host.route.request", () => {
	const route = (path: unknown) => ({ type: "host.route.request", path });

	it("opens the order queue when the merchant comes back from another portal page", () => {
		const parent = framed();
		renderSync();

		post(parent, HOST_ORIGIN, route("/orders"));

		// Replaces the history entry: back should not step through screens nobody chose.
		expect(navigation.replace).toHaveBeenCalledWith("/embed/orders");
	});

	it("does nothing when OMS is already there", () => {
		navigation.pathname = "/embed/orders";
		const parent = framed();
		renderSync();

		post(parent, HOST_ORIGIN, route("/orders"));

		expect(navigation.replace).not.toHaveBeenCalled();
	});

	it("ignores anything that is not an order screen, and messages from anyone but the portal", () => {
		const parent = framed();
		renderSync();

		post(parent, HOST_ORIGIN, route("//evil.example"));
		post(parent, HOST_ORIGIN, route("/orders/../api/session"));
		post(window, HOST_ORIGIN, route("/orders"));
		post(parent, "https://evil.example", route("/orders"));

		expect(navigation.replace).not.toHaveBeenCalled();
	});
});
