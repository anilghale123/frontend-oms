// @vitest-environment node
/**
 * `/api/session` stores only a token a browser can keep as a cookie, and only for this origin.
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { DELETE, POST } from "./route";

const ORIGIN = "http://localhost:3000";

const jar = vi.hoisted(() => ({ stored: null as string | null, cleared: 0 }));

vi.mock("./_cookie", () => ({
	setSessionCookie: async (token: string) => {
		jar.stored = token;
	},
	clearSessionCookie: async () => {
		jar.cleared += 1;
	},
}));

function store(body: unknown, origin = ORIGIN) {
	return POST(
		new Request(`${ORIGIN}/api/session`, {
			method: "POST",
			headers: { "content-type": "application/json", origin },
			body: typeof body === "string" ? body : JSON.stringify(body),
		}),
	);
}

beforeEach(() => {
	jar.stored = null;
	jar.cleared = 0;
	vi.spyOn(console, "log").mockImplementation(() => {});
	vi.spyOn(console, "warn").mockImplementation(() => {});
});

describe("POST /api/session", () => {
	it("stores a token, trimmed", async () => {
		const res = await store({ token: " eyJhbGciOi.payload.sig " });
		expect(res.status).toBe(200);
		expect(jar.stored).toBe("eyJhbGciOi.payload.sig");
	});

	it("refuses a token too long to survive as a cookie", async () => {
		const res = await store({ token: "a".repeat(3501) });
		expect(res.status).toBe(400);
		expect(jar.stored).toBeNull();
	});

	it("refuses a token with spaces or control characters inside it", async () => {
		for (const token of ["two words", "line\nbreak", "tab\there", "naïve"]) {
			expect((await store({ token })).status).toBe(400);
		}
		expect(jar.stored).toBeNull();
	});

	it("refuses a missing token and a body that is not JSON", async () => {
		expect((await store({})).status).toBe(400);
		expect((await store("{not json")).status).toBe(400);
		expect(jar.stored).toBeNull();
	});

	it("refuses another origin", async () => {
		const res = await store({ token: "abc" }, "https://evil.test");
		expect(res.status).toBe(403);
		expect(jar.stored).toBeNull();
	});
});

describe("DELETE /api/session", () => {
	it("clears the cookie for this origin and refuses another", async () => {
		const same = await DELETE(
			new Request(`${ORIGIN}/api/session`, { method: "DELETE", headers: { origin: ORIGIN } }),
		);
		expect(same.status).toBe(200);
		const foreign = await DELETE(
			new Request(`${ORIGIN}/api/session`, {
				method: "DELETE",
				headers: { origin: "https://evil.test" },
			}),
		);
		expect(foreign.status).toBe(403);
		expect(jar.cleared).toBe(1);
	});
});
