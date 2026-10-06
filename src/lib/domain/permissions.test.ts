import { describe, expect, it } from "vitest";
import { PERMISSIONS, type Permission, hasPermission } from "./permissions";

describe("hasPermission", () => {
	it("grants only what is held", () => {
		const granted: Permission[] = ["orders:own"];
		expect(hasPermission(granted, "orders:own")).toBe(true);
		expect(hasPermission(granted, "orders:all")).toBe(false);
		expect(hasPermission(granted, "orders:override")).toBe(false);
	});

	it("denies everything for an empty grant", () => {
		for (const permission of PERMISSIONS) {
			expect(hasPermission([], permission)).toBe(false);
		}
	});

	it("does not let a broad read permission imply override", () => {
		// Reading every merchant's orders is not the same as being allowed to override a status.
		expect(hasPermission(["orders:all", "sync:view"], "orders:override")).toBe(false);
	});

	it("works with a readonly tuple, as the role map supplies", () => {
		const granted = ["orders:all", "orders:override"] as const;
		expect(hasPermission(granted, "orders:override")).toBe(true);
	});
});
