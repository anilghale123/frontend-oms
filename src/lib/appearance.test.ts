import { describe, expect, it } from "vitest";
import { resolveAppearanceTheme } from "./appearance";

describe("resolveAppearanceTheme", () => {
	it("treats the portal's fonepoints id as Fonepoints orange", () => {
		expect(resolveAppearanceTheme("fonepoints")).toBe("fonepoints-orange");
	});

	it("leaves other accents unchanged", () => {
		expect(resolveAppearanceTheme("fonepoints-orange")).toBe("fonepoints-orange");
		expect(resolveAppearanceTheme("emerald")).toBe("emerald");
	});
});
