import { afterEach, describe, expect, it, vi } from "vitest";
import { redact, trace, traceEnabled, traceWarn } from "./trace";

afterEach(() => {
	vi.restoreAllMocks();
	vi.unstubAllEnvs();
	window.localStorage.clear();
});

describe("redact", () => {
	it("replaces anything under a credential-looking key with its length only", () => {
		const out = redact({
			type: "host.auth.grant",
			token: "eyJhbGciOiJIUzI1NiJ9.payload.signature",
			accessToken: "abc",
			nested: { Authorization: "Bearer xyz", ok: true },
			list: [{ voucher_code: "secret-voucher" }],
			"x-api-key": "pk_123",
		}) as Record<string, unknown>;

		expect(JSON.stringify(out)).not.toMatch(/eyJ|abc|xyz|secret-voucher|pk_123/);
		expect(out.token).toBe("<redacted, 38 chars>");
		expect(out.type).toBe("host.auth.grant");
		expect((out.nested as Record<string, unknown>).ok).toBe(true);
	});

	it("redacts the rider's Turnstile token under either name", () => {
		const out = redact({
			turnstileToken: "0.turnstile-token",
			"cf-turnstile-response": "0.turnstile-response",
			errorCodes: ["timeout-or-duplicate"],
		});

		expect(JSON.stringify(out)).not.toMatch(/0\.turnstile/);
		expect(out).toMatchObject({ errorCodes: ["timeout-or-duplicate"] });
	});

	it("leaves non-credential values alone", () => {
		expect(redact({ reason: "missing", count: 2 })).toEqual({ reason: "missing", count: 2 });
		expect(redact("plain")).toBe("plain");
	});
});

describe("trace", () => {
	it("is silent outside development unless switched on (tests run as NODE_ENV=test)", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		expect(traceEnabled()).toBe(false);
		trace("auth", "hello");
		expect(log).not.toHaveBeenCalled();
	});

	it("prints a prefixed, timestamped, redacted line in development", () => {
		vi.stubEnv("NODE_ENV", "development");
		const log = vi.spyOn(console, "log").mockImplementation(() => {});

		trace("auth", "step 19 · storing the token", { token: "eyJ.secret.value", reason: "missing" });

		expect(log).toHaveBeenCalledTimes(1);
		const [line, data] = log.mock.calls[0];
		expect(line).toMatch(/^\[OMS:auth\] \d\d:\d\d:\d\d\.\d{3} step 19 · storing the token$/);
		expect(data).toEqual({ token: "<redacted, 16 chars>", reason: "missing" });
	});

	it("can be switched on in the browser with the localStorage flag", () => {
		const log = vi.spyOn(console, "log").mockImplementation(() => {});
		window.localStorage.setItem("oms:debug", "1");

		trace("host", "← portal host.theme");

		expect(log).toHaveBeenCalledTimes(1);
	});

	it("can be switched on for a build with NEXT_PUBLIC_OMS_DEBUG", () => {
		vi.stubEnv("NEXT_PUBLIC_OMS_DEBUG", "1");
		expect(traceEnabled()).toBe(true);
	});
});

describe("traceWarn", () => {
	it("prints even with tracing off, and still redacts", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

		traceWarn("session", "refused a cross-origin POST", {
			origin: "https://evil.example",
			token: "t",
		});

		expect(warn).toHaveBeenCalledTimes(1);
		expect(warn.mock.calls[0][1]).toEqual({
			origin: "https://evil.example",
			token: "<redacted, 1 chars>",
		});
	});
});
