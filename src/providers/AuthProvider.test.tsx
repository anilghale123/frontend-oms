/**
 * The handoff, end to end on the frontend side.
 *
 * Everything server-side is covered over HTTP; what cannot be checked that way is the sequence
 * inside the browser, where the order of things decides whether a merchant sees their orders or a
 * loop: the screens' first request, `oms.ready`, the grant arriving, and late answers to requests
 * sent before it. These tests drive that sequence against a real `window.postMessage` in jsdom and
 * the real fetch client (`apiClient`), with `fetch` stubbed at the route boundary.
 *
 * There is no session check before the screens open: their first request through the proxy is
 * the check, so the tests make requests with `apiClient` the way a screen would.
 *
 * The one thing left unproven here is the browser delivering a message between two real documents,
 * which is the same mechanism the theme sync has been using on this channel all along.
 */

import { renderToString } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError, apiClient } from "@/lib/api/client";
import { forgetToken, readRememberedToken } from "@/lib/auth";
import { HOST_SOURCE, PROTOCOL_VERSION } from "@/lib/host";
import { AuthProvider, useAuth } from "./AuthProvider";
import { HostChannelProvider } from "./HostChannelProvider";

const HOST_ORIGIN = "http://localhost:4200";

/** Prints the session state, so assertions read like what a merchant would see. */
function Probe() {
	const { status, reason } = useAuth();
	return (
		<div>
			<p data-testid="status">{status}</p>
			<p data-testid="reason">{reason ?? "-"}</p>
		</div>
	);
}

/** The query cache the provider resets after a grant; fresh for every test. */
let queryClient: QueryClient;

function tree(extra?: React.ReactNode) {
	return (
		<QueryClientProvider client={queryClient}>
			<HostChannelProvider>
				<AuthProvider>
					<Probe />
					{extra}
				</AuthProvider>
			</HostChannelProvider>
		</QueryClientProvider>
	);
}

const renderAuth = () => render(tree());

const status = () => screen.getByTestId("status");

/** Stands in for the portal holding the frame: makes `embedded` true and records what OMS sends. */
function frameWindow() {
	const posted: unknown[] = [];
	const parent = {
		// Before the portal has spoken, OMS posts to each allowed origin in turn. A browser delivers
		// only the one matching the parent's real origin, so that is all this records.
		postMessage: (message: unknown, target: string) => {
			if (target === HOST_ORIGIN) posted.push(message);
		},
	};
	vi.spyOn(window, "parent", "get").mockReturnValue(parent as unknown as Window);
	return { parent, posted };
}

function deliver(source: unknown, data: Record<string, unknown>) {
	const event = new MessageEvent("message", {
		data: { source: HOST_SOURCE, v: PROTOCOL_VERSION, ...data },
		origin: HOST_ORIGIN,
	});
	Object.defineProperty(event, "source", { value: source });
	window.dispatchEvent(event);
}

const deliverGrant = (source: unknown, token = "oms_at_from_host") =>
	deliver(source, { type: "host.auth.grant", token, expiresAt: "" });

const deliverDenied = (source: unknown, reason: string) =>
	deliver(source, { type: "host.auth.denied", reason });

/** The messages of one type OMS has posted to the portal. */
function sent(posted: unknown[], type: string) {
	return posted.filter((message) => (message as { type?: string }).type === type) as Record<
		string,
		unknown
	>[];
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

/** The proxy's answer when the browser sent no session. */
const noSession = () => json({ error: { code: "no_session", message: "No OMS session" } }, 401);

/** Sales refusing a token, passed back by the proxy. */
const refused = () => json({ detail: "Given token not valid for any token type" }, 401);

const orders = () => json({ count: 0, next: null, previous: null, data: [] });

/**
 * Stubs `fetch` at the route boundary. `oms` answers every `/api/oms/*` request in turn; return a
 * promise from it to hold one back.
 */
function stubFetch(routes: {
	oms?: () => Response | Promise<Response>;
	sessionPost?: (body: unknown) => Response;
}) {
	const calls: { url: string; method: string; body?: unknown }[] = [];

	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const method = init?.method ?? "GET";
		const body = init?.body ? JSON.parse(String(init.body)) : undefined;
		calls.push({ url, method, body });

		if (url.startsWith("/api/oms/")) return (routes.oms ?? orders)();
		if (url === "/api/session" && method === "POST") {
			return routes.sessionPost?.(body) ?? json({ ok: true });
		}
		throw new Error(`unexpected fetch: ${method} ${url}`);
	});

	vi.stubGlobal("fetch", fetchMock);
	return calls;
}

/** What a screen does on mount: ask for the orders. Resolves to the error, if any. */
function loadOrders(): Promise<ApiError | null> {
	return apiClient.get("/orders").then(
		() => null,
		(error: ApiError) => error,
	);
}

/** Opens OMS in the portal with no cookie, and waits for it to ask for a token. */
async function openWithoutCookie(posted: unknown[]) {
	renderAuth();
	await waitFor(() => expect(status()).toHaveTextContent("authenticated"));
	await loadOrders();
	await waitFor(() => expect(sent(posted, "oms.auth.renew")).toHaveLength(1));
}

beforeEach(() => {
	forgetToken();
	queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
});

afterEach(() => {
	window.history.replaceState(null, "", "/");
	// `vitest.config.ts` does not set `globals: true`, so testing-library's automatic cleanup is
	// never registered. Without this the previous test's tree stays in the document and
	// `getByTestId` finds two of everything.
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	forgetToken();
});

describe("AuthProvider — opening OMS", () => {
	it("server-renders the loading state, so the first paint is the skeleton", () => {
		// The server cannot know whether OMS is framed. It must not render "opens from the
		// portal" (which the hydrating browser would then replace), only the loading state.
		frameWindow();

		const html = renderToString(tree());

		expect(html).toContain(">loading<");
	});

	it("opens the screens with no session check, and tells the portal no token was needed", async () => {
		// The common path: the merchant opens OMS again and the cookie is there.
		const { posted } = frameWindow();
		const calls = stubFetch({});

		renderAuth();

		// Straight to the screens: nothing was fetched just to check the session.
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));
		expect(calls).toHaveLength(0);

		// The screens' first requests succeed; the portal hears once that no token was needed.
		await loadOrders();
		await loadOrders();

		await waitFor(() =>
			expect(sent(posted, "oms.auth.ok")).toEqual([
				expect.objectContaining({ type: "oms.auth.ok", session: "existing" }),
			]),
		);
		expect(sent(posted, "oms.auth.renew")).toHaveLength(0);
		expect(calls.some((call) => call.url === "/api/session")).toBe(false);
	});

	it("asks the portal for a token when the first request finds no session", async () => {
		const { parent, posted } = frameWindow();
		let hasCookie = false;
		const calls = stubFetch({
			oms: () => (hasCookie ? orders() : noSession()),
			sessionPost: () => {
				hasCookie = true;
				return json({ ok: true });
			},
		});

		renderAuth();
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));

		const error = await loadOrders();
		expect(error?.status).toBe(401);

		// `missing`, not `rejected`: there was no token to refuse.
		await waitFor(() => expect(sent(posted, "oms.auth.renew")).toHaveLength(1));
		expect(sent(posted, "oms.auth.renew")[0]).toMatchObject({ reason: "missing" });
		// The screens come down (the gate shows the skeleton) while the portal answers.
		expect(status()).toHaveTextContent("loading");

		deliverGrant(parent);

		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));
		const post = calls.find((call) => call.url === "/api/session" && call.method === "POST");
		expect(post?.body).toEqual({ token: "oms_at_from_host" });
		// The token is also held in memory, for a browser that refuses the partitioned cookie.
		expect(readRememberedToken()).toBe("oms_at_from_host");
		await waitFor(() =>
			expect(sent(posted, "oms.auth.ok")).toEqual([
				expect.objectContaining({ type: "oms.auth.ok", session: "new" }),
			]),
		);

		// The screens' requests now work, and the portal is not told "existing" on top of "new".
		expect(await loadOrders()).toBeNull();
		expect(sent(posted, "oms.auth.ok")).toHaveLength(1);
	});

	it("clears what failed for want of a session once the token is stored", async () => {
		// A query that had data and then hit the 401 would otherwise come back showing its error
		// while it refetches. Other failures are left alone.
		const { parent, posted } = frameWindow();
		stubFetch({ oms: noSession });

		renderAuth();
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));
		const ordersKey = ["orders", "list"];
		const otherKey = ["something", "else"];
		queryClient.setQueryData(ordersKey, { orders: ["kept from before"] });
		await queryClient
			.fetchQuery({ queryKey: ordersKey, queryFn: () => apiClient.get("/orders") })
			.catch(() => {});
		await queryClient
			.fetchQuery({
				queryKey: otherKey,
				queryFn: () => Promise.reject(new ApiError("Server error", 500, "http_500")),
			})
			.catch(() => {});
		expect(queryClient.getQueryState(ordersKey)?.status).toBe("error");
		await waitFor(() => expect(sent(posted, "oms.auth.renew")).toHaveLength(1));

		deliverGrant(parent);
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));

		await waitFor(() => expect(queryClient.getQueryState(ordersKey)?.status).toBe("pending"));
		expect(queryClient.getQueryData(ordersKey)).toBeUndefined();
		// A real failure is not the session's to clear.
		expect(queryClient.getQueryState(otherKey)?.status).toBe("error");
	});

	it("asks once when several requests find no session together", async () => {
		// An order detail page fires the order and the side list at once.
		const { posted } = frameWindow();
		stubFetch({ oms: noSession });

		renderAuth();
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));

		await Promise.all([loadOrders(), loadOrders(), loadOrders()]);

		await waitFor(() => expect(sent(posted, "oms.auth.renew")).toHaveLength(1));
		expect(status()).toHaveTextContent("loading");
	});

	it("ignores a 401 from a request sent before the new token was stored", async () => {
		const { parent, posted } = frameWindow();

		// One request is held back by a slow network; the rest answer at once.
		let releaseSlow!: (response: Response) => void;
		let first = true;
		stubFetch({
			oms: () => {
				if (first) {
					first = false;
					return new Promise<Response>((resolve) => (releaseSlow = resolve));
				}
				return noSession();
			},
		});

		renderAuth();
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));

		const slow = loadOrders();
		await loadOrders();
		await waitFor(() => expect(sent(posted, "oms.auth.renew")).toHaveLength(1));

		deliverGrant(parent);
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));

		// The slow request was sent before the new token existed. Its 401 speaks for a session
		// that is already replaced: it must not end the new one or ask the portal again.
		releaseSlow(noSession());
		expect((await slow)?.status).toBe(401);

		expect(status()).toHaveTextContent("authenticated");
		expect(sent(posted, "oms.auth.renew")).toHaveLength(1);
		// Nor does it drop the in-memory copy of the new token.
		expect(readRememberedToken()).toBe("oms_at_from_host");
	});

	it("asks for a new token when Sales refuses the cookie's token", async () => {
		const { parent, posted } = frameWindow();
		let refusedOnce = false;
		stubFetch({
			oms: () => {
				if (refusedOnce) return orders();
				refusedOnce = true;
				return refused();
			},
		});

		renderAuth();
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));

		await loadOrders();

		// `rejected` tells the portal the token OMS had no longer works.
		await waitFor(() => expect(sent(posted, "oms.auth.renew")).toHaveLength(1));
		expect(sent(posted, "oms.auth.renew")[0]).toMatchObject({ reason: "rejected" });

		deliverGrant(parent, "oms_at_fresh");
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));
		expect(await loadOrders()).toBeNull();
	});

	it("does not loop when a token just handed over is refused", async () => {
		const { parent, posted } = frameWindow();
		let granted = false;
		stubFetch({
			oms: () => (granted ? refused() : noSession()),
			sessionPost: () => {
				granted = true;
				return json({ ok: true });
			},
		});

		await openWithoutCookie(posted);
		deliverGrant(parent);
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));

		// The first request with the new token says it is no good.
		await loadOrders();

		await waitFor(() => expect(status()).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Your access has ended");
		expect(sent(posted, "oms.auth.renew")).toHaveLength(1);
	});

	it("does not loop when there is still no session right after a grant", async () => {
		// The cookie did not stick and there is no fallback copy: asking again would loop.
		const { parent, posted } = frameWindow();
		stubFetch({ oms: noSession });

		await openWithoutCookie(posted);
		deliverGrant(parent);
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));
		forgetToken();

		await loadOrders();

		await waitFor(() => expect(status()).toHaveTextContent("unauthenticated"));
		expect(sent(posted, "oms.auth.renew")).toHaveLength(1);
	});

	it("opens the screens again on retry", async () => {
		const { parent, posted } = frameWindow();
		stubFetch({ oms: noSession });

		// The gate's retry button.
		function RetryButton() {
			return <button onClick={useAuth().retry}>Try again</button>;
		}
		render(tree(<RetryButton />));
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));
		await loadOrders();
		await waitFor(() => expect(sent(posted, "oms.auth.renew")).toHaveLength(1));
		deliverDenied(parent, "token_request_failed");
		await waitFor(() => expect(status()).toHaveTextContent("unauthenticated"));

		fireEvent.click(screen.getByRole("button", { name: "Try again" }));

		// Back to the screens, whose first request will start a new handshake.
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));
		await loadOrders();
		await waitFor(() => expect(sent(posted, "oms.auth.renew")).toHaveLength(2));
	});
});

describe("AuthProvider — grants and denials", () => {
	it("ignores a grant it did not ask for", async () => {
		// With a working cookie, a token that arrives unasked must not replace the session.
		const { parent } = frameWindow();
		const calls = stubFetch({});

		renderAuth();
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));

		deliverGrant(parent);

		expect(status()).toHaveTextContent("authenticated");
		expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
	});

	it("ignores a denial while its session is fine", async () => {
		const { parent } = frameWindow();
		stubFetch({});

		renderAuth();
		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));

		deliverDenied(parent, "token_request_failed");

		expect(status()).toHaveTextContent("authenticated");
	});

	it("tells the portal when the token cannot be stored", async () => {
		const { parent, posted } = frameWindow();
		stubFetch({
			oms: noSession,
			sessionPost: () => json({ error: { code: "unauthorized" } }, 401),
		});

		await openWithoutCookie(posted);
		deliverGrant(parent);

		await waitFor(() => expect(status()).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Couldn't start the OMS session");
		await waitFor(() => expect(sent(posted, "oms.auth.failed")).toHaveLength(1));
	});

	it("exchanges only once when the host grants twice", async () => {
		const { parent, posted } = frameWindow();
		const calls = stubFetch({ oms: noSession });

		await openWithoutCookie(posted);

		deliverGrant(parent);
		deliverGrant(parent);
		deliverGrant(parent);

		await waitFor(() => expect(status()).toHaveTextContent("authenticated"));
		expect(
			calls.filter((call) => call.url === "/api/session" && call.method === "POST"),
		).toHaveLength(1);
	});

	it("surfaces a denial from the portal", async () => {
		const { parent, posted } = frameWindow();
		stubFetch({ oms: noSession });

		await openWithoutCookie(posted);

		deliverDenied(parent, "no_session");

		await waitFor(() => expect(status()).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Fonepoints session has ended");
	});
});

describe("AuthProvider — only the portal signs OMS in", () => {
	it("explains itself when /embed is opened outside a frame", async () => {
		// No `frameWindow()`: `window.parent === window`, so there is no host to ask.
		const calls = stubFetch({});

		renderAuth();

		await waitFor(() => expect(status()).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Open OMS from the Fonepoints");
		// Not even a request: the screens never open outside the portal.
		expect(calls).toHaveLength(0);
	});

	it("ignores a #token= on the URL and asks the portal instead", async () => {
		// The URL handoff is gone: a token reaches OMS only through the portal's grant.
		window.history.replaceState(null, "", "/embed/orders#token=jwt_from_url&theme=dark");
		const { posted } = frameWindow();
		const calls = stubFetch({ oms: noSession });

		await openWithoutCookie(posted);

		expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
		expect(readRememberedToken()).toBeNull();
	});
});
