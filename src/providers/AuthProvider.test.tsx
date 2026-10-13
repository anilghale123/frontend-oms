/**
 * The handoff, end to end on the frontend side.
 *
 * Everything server-side is covered over HTTP; what cannot be checked that way is the sequence
 * inside the browser, where the order of three things decides whether a merchant sees their orders
 * or a spinner: the cookie check, `oms.ready`, and the grant arriving. These tests drive that
 * sequence against a real `window.postMessage` in jsdom, with `fetch` stubbed at the route
 * boundary.
 *
 * The one thing left unproven here is the browser delivering a message between two real documents,
 * which is the same mechanism the theme sync has been using on this channel all along.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { forgetToken, notifySessionExpired, readRememberedToken } from "@/lib/auth";
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

function renderAuth() {
	return render(
		<HostChannelProvider>
			<AuthProvider>
				<Probe />
			</AuthProvider>
		</HostChannelProvider>,
	);
}

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

function deliverGrant(source: unknown, over: Record<string, unknown> = {}) {
	const event = new MessageEvent("message", {
		data: {
			source: HOST_SOURCE,
			v: PROTOCOL_VERSION,
			type: "host.auth.grant",
			token: "oms_at_from_host",
			expiresAt: "",
			...over,
		},
		origin: HOST_ORIGIN,
	});
	Object.defineProperty(event, "source", { value: source });
	window.dispatchEvent(event);
}

function deliverDenied(source: unknown, reason: string) {
	const event = new MessageEvent("message", {
		data: {
			source: HOST_SOURCE,
			v: PROTOCOL_VERSION,
			type: "host.auth.denied",
			reason,
		},
		origin: HOST_ORIGIN,
	});
	Object.defineProperty(event, "source", { value: source });
	window.dispatchEvent(event);
}

/** The messages of one type OMS has posted to the portal. */
function sent(posted: unknown[], type: string) {
	return posted.filter((message) => (message as { type?: string }).type === type) as Record<
		string,
		unknown
	>[];
}

/** Waits for OMS to ask the portal for a token, which is when the portal may grant one. */
async function waitForRenew(posted: unknown[]) {
	await waitFor(() => expect(sent(posted, "oms.auth.renew")).toHaveLength(1));
}

/** Minimal router over the two routes the provider calls. */
function stubFetch(routes: {
	session?: () => Response;
	sessionPost?: (body: unknown) => Response;
}) {
	const calls: { url: string; method: string; body?: unknown }[] = [];

	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const method = init?.method ?? "GET";
		const body = init?.body ? JSON.parse(String(init.body)) : undefined;
		calls.push({ url, method, body });

		if (url === "/api/session" && method === "GET") {
			return routes.session?.() ?? json({ error: { code: "no_session" } }, 401);
		}
		if (url === "/api/session" && method === "POST") {
			return routes.sessionPost?.(body) ?? json({ ok: true });
		}
		throw new Error(`unexpected fetch: ${method} ${url}`);
	});

	vi.stubGlobal("fetch", fetchMock);
	return calls;
}

function json(body: unknown, status = 200): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "content-type": "application/json" },
	});
}

beforeEach(() => {
	forgetToken();
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

describe("AuthProvider — embedded", () => {
	it("uses the cookie and tells the portal no token is needed", async () => {
		// The common path: the merchant opens OMS again and the cookie is there. The route only
		// checks the cookie exists, so it answers with no profile.
		const { posted } = frameWindow();
		const calls = stubFetch({ session: () => json({ ok: true }) });

		renderAuth();

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
		// No POST: nothing was exchanged, because nothing had to be.
		expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
		// The portal hears that the session already exists, and is never asked for a token.
		await waitFor(() =>
			expect(sent(posted, "oms.auth.ok")).toEqual([
				expect.objectContaining({ type: "oms.auth.ok", session: "existing" }),
			]),
		);
		expect(sent(posted, "oms.auth.ok")[0]).not.toHaveProperty("merchantId");
		expect(sent(posted, "oms.auth.renew")).toHaveLength(0);
	});

	it("exchanges a host grant for a session and reports back", async () => {
		const { parent, posted } = frameWindow();
		const calls = stubFetch({});

		renderAuth();

		// `oms.ready` goes out on mount; with no cookie OMS then asks for a token.
		await waitFor(() => expect(posted).not.toHaveLength(0));
		expect(posted[0]).toMatchObject({ type: "oms.ready" });
		await waitForRenew(posted);
		expect(sent(posted, "oms.auth.renew")[0]).toMatchObject({ reason: "missing" });

		deliverGrant(parent);

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

		const post = calls.find((call) => call.url === "/api/session" && call.method === "POST");
		expect(post?.body).toEqual({ token: "oms_at_from_host" });

		// The token is also held in memory, for a browser that refuses the partitioned cookie.
		expect(readRememberedToken()).toBe("oms_at_from_host");

		// The portal is told the token was stored.
		await waitFor(() =>
			expect(posted).toContainEqual(
				expect.objectContaining({ type: "oms.auth.ok", session: "new" }),
			),
		);
	});

	it("ignores a grant it did not ask for", async () => {
		// Older portals granted on every `oms.ready`. With a valid cookie that token must not
		// replace the session.
		const { parent, posted } = frameWindow();
		const calls = stubFetch({ session: () => json({ ok: true }) });

		renderAuth();
		await waitFor(() => expect(sent(posted, "oms.auth.ok")).toHaveLength(1));

		deliverGrant(parent);

		expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
		expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
	});

	it("ignores a denial while its session is fine", async () => {
		const { parent, posted } = frameWindow();
		stubFetch({ session: () => json({ ok: true }) });

		renderAuth();
		await waitFor(() => expect(sent(posted, "oms.auth.ok")).toHaveLength(1));

		deliverDenied(parent, "token_request_failed");

		expect(screen.getByTestId("status")).toHaveTextContent("authenticated");
	});

	it("asks for a new token when Sales refuses the token mid-visit", async () => {
		const { parent, posted } = frameWindow();
		const calls = stubFetch({ session: () => json({ ok: true }) });

		renderAuth();
		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

		// Well after sign-in, as far as the cool-down is concerned.
		const realNow = Date.now.bind(Date);
		vi.spyOn(Date, "now").mockImplementation(() => realNow() + 12 * 60 * 60 * 1000);

		// Several queries fail together; OMS still asks once.
		notifySessionExpired();
		notifySessionExpired();

		await waitForRenew(posted);
		// `rejected` tells the portal this is a second ask: the token it gave no longer works.
		expect(sent(posted, "oms.auth.renew")[0]).toMatchObject({ reason: "rejected" });
		expect(screen.getByTestId("status")).toHaveTextContent("loading");

		deliverGrant(parent, { token: "oms_at_fresh" });

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
		const post = calls.find((call) => call.url === "/api/session" && call.method === "POST");
		expect(post?.body).toEqual({ token: "oms_at_fresh" });
	});

	it("asks again when a token from the cookie is refused, even right after opening", async () => {
		// /api/session no longer checks the token with Sales, so a revoked token in the cookie
		// shows up on the first data request. That is not a bad new token: ask for a new one.
		const { posted } = frameWindow();
		stubFetch({ session: () => json({ ok: true }) });

		renderAuth();
		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

		notifySessionExpired();

		await waitForRenew(posted);
		expect(sent(posted, "oms.auth.renew")[0]).toMatchObject({ reason: "rejected" });
	});

	it("does not loop when a token just handed over is refused", async () => {
		const { parent, posted } = frameWindow();
		stubFetch({});

		renderAuth();
		await waitForRenew(posted);
		deliverGrant(parent);
		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

		// The first data request says the token it was just given is no good.
		notifySessionExpired();

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Your access has ended");
		expect(sent(posted, "oms.auth.renew")).toHaveLength(1);
	});

	it("tells the portal when the token is refused", async () => {
		const { parent, posted } = frameWindow();
		stubFetch({ sessionPost: () => json({ error: { code: "unauthorized" } }, 401) });

		renderAuth();
		await waitForRenew(posted);
		deliverGrant(parent);

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Couldn't start the OMS session");
		await waitFor(() =>
			expect(posted.some((m) => (m as { type: string }).type === "oms.auth.failed")).toBe(true),
		);
	});

	it("exchanges only once when the host grants twice", async () => {
		// One renew, one exchange: a repeated grant (an older portal, a double answer) must not
		// re-POST the session.
		const { parent, posted } = frameWindow();
		const calls = stubFetch({});

		renderAuth();
		await waitForRenew(posted);

		deliverGrant(parent);
		deliverGrant(parent);
		deliverGrant(parent);

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
		expect(
			calls.filter((call) => call.url === "/api/session" && call.method === "POST"),
		).toHaveLength(1);
	});

	it("asks for a grant when it is framed with no session", async () => {
		const { posted } = frameWindow();
		stubFetch({});

		renderAuth();

		// `oms.auth.renew` is the only thing that makes the portal fetch a token.
		await waitForRenew(posted);
		expect(sent(posted, "oms.auth.renew")[0]).toMatchObject({ reason: "missing" });
		expect(sent(posted, "oms.auth.ok")).toHaveLength(0);
	});

	it("explains itself when /embed is opened outside a frame", async () => {
		// No `frameWindow()`: `window.parent === window`, so there is no host to ask.
		stubFetch({});

		renderAuth();

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Open OMS from the Fonepoints");
	});

	it("surfaces a denial from the portal", async () => {
		const { parent, posted } = frameWindow();
		stubFetch({});

		renderAuth();
		await waitForRenew(posted);

		deliverDenied(parent, "no_session");

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Fonepoints session has ended");
	});
});

describe("AuthProvider — only the portal signs OMS in", () => {
	it("ignores a #token= on the URL and asks the portal instead", async () => {
		// The URL handoff is gone: a token reaches OMS only through the portal's grant.
		window.history.replaceState(null, "", "/embed/orders#token=jwt_from_url&theme=dark");
		const { posted } = frameWindow();
		const calls = stubFetch({});

		renderAuth();

		await waitForRenew(posted);
		expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
		expect(readRememberedToken()).toBeNull();
	});

	it("does not open outside the portal, even with a cookie", async () => {
		// Embedded only: a cookie from an earlier visit is not a way in on its own.
		const calls = stubFetch({ session: () => json({ ok: true }) });

		renderAuth();

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Open OMS from the Fonepoints");
		expect(calls).toHaveLength(0);
	});
});
