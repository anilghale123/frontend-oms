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
import { forgetToken, readRememberedToken } from "@/lib/auth";
import { HOST_SOURCE, PROTOCOL_VERSION } from "@/lib/host";
import { AuthProvider, useAuth } from "./AuthProvider";
import { HostChannelProvider } from "./HostChannelProvider";

const HOST_ORIGIN = "http://localhost:4200";

const MERCHANT = {
	merchantId: "merchant-a",
	companyName: "Hamro Mobile",
	location: "New Road, Kathmandu",
	logoUrl: "/merchants/merchant-a.png",
};

/** Prints the session state, so assertions read like what a merchant would see. */
function Probe() {
	const { status, merchant, reason } = useAuth();
	return (
		<div>
			<p data-testid="status">{status}</p>
			<p data-testid="merchant">{merchant?.companyName ?? "-"}</p>
			<p data-testid="reason">{reason ?? "-"}</p>
		</div>
	);
}

function renderAuth(source: "host" | "standalone") {
	return render(
		<HostChannelProvider>
			<AuthProvider source={source}>
				<Probe />
			</AuthProvider>
		</HostChannelProvider>,
	);
}

/** Stands in for the portal holding the frame: makes `embedded` true and records what OMS sends. */
function frameWindow() {
	const posted: unknown[] = [];
	const parent = {
		postMessage: (message: unknown) => posted.push(message),
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

/** Minimal router over the three routes the provider calls. */
function stubFetch(routes: {
	session?: () => Response;
	sessionPost?: (body: unknown) => Response;
	dev?: () => Response;
}) {
	const calls: { url: string; method: string; body?: unknown }[] = [];

	const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
		const url = String(input);
		const method = init?.method ?? "GET";
		const body = init?.body ? JSON.parse(String(init.body)) : undefined;
		calls.push({ url, method, body });

		if (url === "/api/session" && method === "GET") {
			return routes.session?.() ?? json({ error: { code: "unauthorized" } }, 401);
		}
		if (url === "/api/session" && method === "POST") {
			return routes.sessionPost?.(body) ?? json({ merchant: MERCHANT });
		}
		if (url === "/api/session/dev") {
			return routes.dev?.() ?? json({ error: { code: "disabled" } }, 404);
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
	// `vitest.config.ts` does not set `globals: true`, so testing-library's automatic cleanup is
	// never registered. Without this the previous test's tree stays in the document and
	// `getByTestId` finds two of everything.
	cleanup();
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	forgetToken();
});

describe("AuthProvider — embedded", () => {
	it("uses the cookie and never troubles the host", async () => {
		// The reload path, and the common one: a valid cookie settles the session on its own.
		frameWindow();
		const calls = stubFetch({ session: () => json({ merchant: MERCHANT }) });

		renderAuth("host");

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
		expect(screen.getByTestId("merchant")).toHaveTextContent("Hamro Mobile");
		// No POST: nothing was exchanged, because nothing had to be.
		expect(calls.filter((call) => call.method === "POST")).toHaveLength(0);
	});

	it("exchanges a host grant for a session and reports back", async () => {
		const { parent, posted } = frameWindow();
		const calls = stubFetch({});

		renderAuth("host");

		// `oms.ready` goes out on mount; the portal answers with the token.
		await waitFor(() => expect(posted).not.toHaveLength(0));
		expect(posted[0]).toMatchObject({ type: "oms.ready" });

		deliverGrant(parent);

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));

		const post = calls.find((call) => call.url === "/api/session" && call.method === "POST");
		expect(post?.body).toEqual({ token: "oms_at_from_host" });

		// The token is also held in memory, for a browser that refuses the partitioned cookie.
		expect(readRememberedToken()).toBe("oms_at_from_host");

		// The portal is told the token was accepted, and for whom — that is how it can tell OMS
		// opened as the merchant the portal thinks it signed in.
		await waitFor(() =>
			expect(posted).toContainEqual(
				expect.objectContaining({ type: "oms.auth.ok", merchantId: "merchant-a" }),
			),
		);
	});

	it("tells the portal when the token is refused", async () => {
		const { parent, posted } = frameWindow();
		stubFetch({ sessionPost: () => json({ error: { code: "unauthorized" } }, 401) });

		renderAuth("host");
		await waitFor(() => expect(posted).not.toHaveLength(0));
		deliverGrant(parent);

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("rejected");
		await waitFor(() =>
			expect(posted.some((m) => (m as { type: string }).type === "oms.auth.failed")).toBe(true),
		);
	});

	it("exchanges only once when the host grants twice", async () => {
		// The protocol has the host re-answer every `oms.ready`, and a dev-server reload inside the
		// frame produces several. The session must not be re-POSTed for each.
		const { parent, posted } = frameWindow();
		const calls = stubFetch({});

		renderAuth("host");
		await waitFor(() => expect(posted).not.toHaveLength(0));

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

		renderAuth("host");

		// `oms.auth.renew` covers the case `oms.ready` cannot: a session revoked mid-visit, where
		// the host has already answered this frame once.
		await waitFor(() =>
			expect(posted.some((m) => (m as { type: string }).type === "oms.auth.renew")).toBe(true),
		);
	});

	it("explains itself when /embed is opened outside a frame", async () => {
		// No `frameWindow()`: `window.parent === window`, so there is no host to ask.
		stubFetch({});

		renderAuth("host");

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Open OMS from the Fonepoints");
	});

	it("surfaces a denial from the portal", async () => {
		const { parent, posted } = frameWindow();
		stubFetch({});

		renderAuth("host");
		await waitFor(() => expect(posted).not.toHaveLength(0));

		deliverDenied(parent, "no_session");

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Fonepoints session has ended");
	});
});

describe("AuthProvider — standalone", () => {
	it("mints a development session when there is no cookie", async () => {
		stubFetch({
			dev: () => json({ merchant: MERCHANT, accessToken: "oms_at_dev" }),
		});

		renderAuth("standalone");

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("authenticated"));
		expect(screen.getByTestId("merchant")).toHaveTextContent("Hamro Mobile");
		expect(readRememberedToken()).toBe("oms_at_dev");
	});

	it("points at the portal when development sign-in is off", async () => {
		// What production does: `AUTH_MODE` cannot be `dev` there, so the route answers 404.
		stubFetch({ dev: () => json({ error: { code: "disabled", message: "off" } }, 404) });

		renderAuth("standalone");

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Open OMS from the Fonepoints");
	});

	it("reports an unreachable backend as itself, not as a sign-in failure", async () => {
		stubFetch({
			dev: () =>
				json(
					{ error: { code: "oms_unreachable", message: "Couldn't reach the OMS backend" } },
					502,
				),
		});

		renderAuth("standalone");

		await waitFor(() => expect(screen.getByTestId("status")).toHaveTextContent("unauthenticated"));
		expect(screen.getByTestId("reason")).toHaveTextContent("Couldn't reach the OMS backend");
	});
});
