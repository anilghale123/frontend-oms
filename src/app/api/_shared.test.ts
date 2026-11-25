// @vitest-environment node
/**
 * The same-origin check behind a reverse proxy: the request URL names the container, the browser's
 * `Origin` names the public site, and the two must still be recognised as the same page.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

const env = vi.hoisted(() => ({ publicOrigin: null as string | null }));

vi.mock("@/config/server-env", () => ({
	get OMS_PUBLIC_ORIGIN() {
		return env.publicOrigin;
	},
}));

import { isSameOrigin } from "./_shared";

const PUBLIC = "https://uat-oms.example";

function post(headers: Record<string, string>) {
	return new Request("http://0.0.0.0:3000/api/session", { method: "POST", headers });
}

describe("isSameOrigin", () => {
	beforeEach(() => {
		env.publicOrigin = null;
	});

	it("accepts a request with no Origin (a same-origin GET or a server-side caller)", () => {
		expect(isSameOrigin(post({}))).toBe(true);
	});

	it("accepts the origin in the request URL", () => {
		expect(isSameOrigin(post({ origin: "http://0.0.0.0:3000" }))).toBe(true);
	});

	it("accepts the public address a proxy forwards", () => {
		const forwarded = { "x-forwarded-host": "uat-oms.example", "x-forwarded-proto": "https" };
		expect(isSameOrigin(post({ origin: PUBLIC, ...forwarded }))).toBe(true);
	});

	it("accepts OMS_PUBLIC_ORIGIN when the proxy forwards nothing", () => {
		env.publicOrigin = PUBLIC;
		expect(isSameOrigin(post({ origin: PUBLIC }))).toBe(true);
	});

	it("refuses another site, however the proxy is set up", () => {
		env.publicOrigin = PUBLIC;
		const forwarded = { "x-forwarded-host": "uat-oms.example", "x-forwarded-proto": "https" };
		expect(isSameOrigin(post({ origin: "https://evil.example", ...forwarded }))).toBe(false);
	});

	it("refuses the public origin when nothing says it is this site", () => {
		expect(isSameOrigin(post({ origin: PUBLIC }))).toBe(false);
	});
});
