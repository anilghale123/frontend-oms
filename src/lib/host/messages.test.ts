import { describe, expect, it } from "vitest";
import { APPEARANCE_THEMES, type AppearanceTheme } from "@/lib/appearance";
import {
	HOST_SOURCE,
	OMS_SOURCE,
	PROTOCOL_VERSION,
	asAppearanceTheme,
	isHostMessage,
	isHostMessageOfType,
	isHostThemeMode,
} from "./messages";

const themes = APPEARANCE_THEMES as readonly { id: AppearanceTheme }[];

/** A well-formed message from the portal. */
const grant = (over: Record<string, unknown> = {}) => ({
	source: HOST_SOURCE,
	v: PROTOCOL_VERSION,
	type: "host.theme",
	mode: "dark",
	...over,
});

describe("isHostMessage", () => {
	it("accepts a well-formed host message", () => {
		expect(isHostMessage(grant())).toBe(true);
	});

	it("rejects anything that is not an object", () => {
		for (const value of [null, undefined, "host.theme", 42, true, Symbol("x")]) {
			expect(isHostMessage(value)).toBe(false);
		}
	});

	it("rejects a message with no envelope", () => {
		expect(isHostMessage({ type: "host.theme", mode: "dark" })).toBe(false);
	});

	it("rejects our own messages echoed back", () => {
		// Without this check a message OMS sent could be re-handled as if the host had sent it.
		expect(isHostMessage(grant({ source: OMS_SOURCE }))).toBe(false);
	});

	it("rejects unrelated postMessage traffic", () => {
		// Next's HMR client, the React DevTools bridge and browser extensions all post to this
		// window. These are the shapes the handshake has to ignore.
		expect(isHostMessage({ source: "react-devtools-bridge", payload: {} })).toBe(false);
		expect(isHostMessage({ type: "webpackOk" })).toBe(false);
		expect(isHostMessage({ source: "@devtools-page", type: "host.theme" })).toBe(false);
	});

	it("rejects a protocol version it does not know", () => {
		expect(isHostMessage(grant({ v: PROTOCOL_VERSION + 1 }))).toBe(false);
		expect(isHostMessage(grant({ v: String(PROTOCOL_VERSION) }))).toBe(false);
	});

	it("rejects a message with no type", () => {
		expect(isHostMessage({ source: HOST_SOURCE, v: PROTOCOL_VERSION })).toBe(false);
	});
});

describe("isHostMessageOfType", () => {
	it("narrows to the matching type only", () => {
		const message = grant() as never;
		expect(isHostMessageOfType(message, "host.theme")).toBe(true);
		expect(isHostMessageOfType(message, "host.route.request")).toBe(false);
	});
});

describe("isHostThemeMode", () => {
	it("accepts light and dark", () => {
		expect(isHostThemeMode("light")).toBe(true);
		expect(isHostThemeMode("dark")).toBe(true);
	});

	it("rejects system, which the host resolves before sending", () => {
		expect(isHostThemeMode("system")).toBe(false);
	});

	it("rejects anything else", () => {
		for (const value of ["", "DARK", null, undefined, 0]) {
			expect(isHostThemeMode(value)).toBe(false);
		}
	});
});

describe("asAppearanceTheme", () => {
	it("accepts an accent this build knows", () => {
		expect(asAppearanceTheme("fonepoints", themes)).toBe("fonepoints");
		expect(asAppearanceTheme("violet-blue", themes)).toBe("violet-blue");
	});

	it("returns null for an accent this build does not know", () => {
		// The host and OMS ship independently, so the host may name an accent added after this
		// build. Ignoring it keeps the current accent rather than guessing.
		expect(asAppearanceTheme("chartreuse", themes)).toBeNull();
	});

	it("returns null for a non-string", () => {
		for (const value of [undefined, null, 7, {}, ["fonepoints"]]) {
			expect(asAppearanceTheme(value, themes)).toBeNull();
		}
	});
});
