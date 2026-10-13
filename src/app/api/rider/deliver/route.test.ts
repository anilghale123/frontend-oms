// @vitest-environment node
/**
 * The rider's delivery confirmation: no voucher guess reaches Sales without a Turnstile token
 * that Cloudflare accepted, and only the Sales fields are forwarded.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { POST } from "./route";

const SALES_RIDER_API = "https://sales.test/api/oms/rider/";
const VERIFY_URL = "https://challenges.test/turnstile/v0/siteverify";

vi.mock("@/config/server-env", () => ({
	SALES_CONFIG_PROBLEM: null,
	SALES_RIDER_API: "https://sales.test/api/oms/rider/",
	TURNSTILE_CONFIG_PROBLEM: null,
	TURNSTILE_SECRET_KEY: "turnstile-secret",
	TURNSTILE_VERIFY_URL: "https://challenges.test/turnstile/v0/siteverify",
	UPSTREAM_TIMEOUT_MS: 15_000,
	salesUnreachableMessage: () => "Couldn't reach the Sales service.",
}));

const TOKEN = "0.rider-turnstile-token";
const VOUCHER = "V-SECRET-1234";

function deliver(body: unknown) {
	return POST(
		new Request("http://localhost:3000/api/rider/deliver", {
			method: "POST",
			headers: { "content-type": "application/json", "x-forwarded-for": "203.0.113.7, 10.0.0.1" },
			body: JSON.stringify(body),
		}),
	);
}

/** Cloudflare answers `verify`; Sales answers 200 with the order. Returns the fetch spy. */
function stubUpstreams(verify: () => Response | Promise<Response>) {
	const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
		const url = String(input);
		if (url === VERIFY_URL) return verify();
		if (url === `${SALES_RIDER_API}deliver/`) {
			return Response.json({ message: "Order delivered." }, { status: 200 });
		}
		throw new Error(`unexpected fetch to ${url}`);
	});
	vi.stubGlobal("fetch", fetchMock);
	return fetchMock;
}

const turnstileSays =
	(success: boolean, errorCodes: string[] = []) =>
	() =>
		Response.json({ success, "error-codes": errorCodes });

function calledUrls(fetchMock: ReturnType<typeof stubUpstreams>) {
	return fetchMock.mock.calls.map(([input]) => String(input));
}

function sentBody(fetchMock: ReturnType<typeof stubUpstreams>, url: string) {
	const call = fetchMock.mock.calls.find(([input]) => String(input) === url) as
		[RequestInfo | URL, RequestInit] | undefined;
	return JSON.parse(String(call?.[1]?.body));
}

let logged: unknown[][];

beforeEach(() => {
	logged = [];
	const capture = (...args: unknown[]) => void logged.push(args);
	vi.spyOn(console, "log").mockImplementation(capture);
	vi.spyOn(console, "warn").mockImplementation(capture);
	vi.spyOn(console, "error").mockImplementation(capture);
});

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllGlobals();
	vi.unstubAllEnvs();
});

describe("POST /api/rider/deliver", () => {
	it("refuses a request without a Turnstile token and never calls Cloudflare or Sales", async () => {
		const fetchMock = stubUpstreams(turnstileSays(true));

		const res = await deliver({ order_id: "OMS-0427", voucher_code: VOUCHER });

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: "verification_failed", message: "Verification failed. Try again." },
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses an empty token the same way", async () => {
		const fetchMock = stubUpstreams(turnstileSays(true));

		const res = await deliver({ order_id: "OMS-0427", voucher_code: VOUCHER, turnstileToken: "" });

		expect(res.status).toBe(400);
		expect((await res.json()).error.code).toBe("verification_failed");
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("still asks for the Order ID and voucher code when those are missing", async () => {
		const fetchMock = stubUpstreams(turnstileSays(true));

		const res = await deliver({ order_id: "", voucher_code: "", turnstileToken: TOKEN });

		expect(res.status).toBe(400);
		expect((await res.json()).error).toEqual({
			code: "invalid_body",
			message: "Enter the Order ID and the voucher code.",
		});
		expect(fetchMock).not.toHaveBeenCalled();
	});

	it("refuses a token Cloudflare rejects, without calling Sales", async () => {
		const fetchMock = stubUpstreams(turnstileSays(false, ["timeout-or-duplicate"]));

		const res = await deliver({
			order_id: "OMS-0427",
			voucher_code: VOUCHER,
			turnstileToken: TOKEN,
		});

		expect(res.status).toBe(400);
		expect(await res.json()).toEqual({
			error: { code: "verification_failed", message: "Verification failed. Try again." },
		});
		expect(calledUrls(fetchMock)).toEqual([VERIFY_URL]);
	});

	it("sends Cloudflare the secret, the token and the rider's address", async () => {
		const fetchMock = stubUpstreams(turnstileSays(false));

		await deliver({ order_id: "OMS-0427", voucher_code: VOUCHER, turnstileToken: TOKEN });

		expect(sentBody(fetchMock, VERIFY_URL)).toEqual({
			secret: "turnstile-secret",
			response: TOKEN,
			remoteip: "203.0.113.7",
		});
	});

	it("fails closed when Cloudflare cannot be reached", async () => {
		const fetchMock = stubUpstreams(() => {
			throw new TypeError("fetch failed");
		});

		const res = await deliver({
			order_id: "OMS-0427",
			voucher_code: VOUCHER,
			turnstileToken: TOKEN,
		});

		expect(res.status).toBe(502);
		expect((await res.json()).error.code).toBe("verification_unavailable");
		expect(calledUrls(fetchMock)).toEqual([VERIFY_URL]);
	});

	it("reports a secret Cloudflare refuses as configuration, not as the rider's failure", async () => {
		stubUpstreams(turnstileSays(false, ["invalid-input-secret"]));

		const res = await deliver({
			order_id: "OMS-0427",
			voucher_code: VOUCHER,
			turnstileToken: TOKEN,
		});

		expect(res.status).toBe(503);
		expect((await res.json()).error.code).toBe("turnstile_not_configured");
	});

	it("forwards only the Order ID and voucher code to Sales once Cloudflare passes the token", async () => {
		const fetchMock = stubUpstreams(turnstileSays(true));

		const res = await deliver({
			order_id: " OMS-0427 ",
			voucher_code: VOUCHER,
			turnstileToken: TOKEN,
			extra: "dropped",
		});

		expect(res.status).toBe(200);
		expect(await res.json()).toEqual({ message: "Order delivered." });
		expect(calledUrls(fetchMock)).toEqual([VERIFY_URL, `${SALES_RIDER_API}deliver/`]);
		expect(sentBody(fetchMock, `${SALES_RIDER_API}deliver/`)).toEqual({
			order_id: "OMS-0427",
			voucher_code: VOUCHER,
		});
	});

	it("never logs the token or the voucher code", async () => {
		vi.stubEnv("NODE_ENV", "development"); // trace lines on, as under `next dev`
		stubUpstreams(turnstileSays(false, ["invalid-input-response"]));
		await deliver({ order_id: "OMS-0427", voucher_code: VOUCHER, turnstileToken: TOKEN });
		stubUpstreams(turnstileSays(true));
		await deliver({ order_id: "OMS-0427", voucher_code: VOUCHER, turnstileToken: TOKEN });

		expect(logged.length).toBeGreaterThan(0);
		const output = JSON.stringify(logged);
		expect(output).not.toContain(TOKEN);
		expect(output).not.toContain(VOUCHER);
	});
});
