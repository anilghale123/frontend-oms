import { describe, expect, it } from "vitest";
import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE, canTransition } from "./status";
import type { OrderStatus } from "./types";

const ALL_STATUSES: OrderStatus[] = [
	"preparing",
	"ready_for_delivery",
	"delivering",
	"delivered",
	"failed",
];

describe("canTransition", () => {
	it("allows the merchant steps along the happy path", () => {
		expect(canTransition("preparing", "ready_for_delivery")).toBe(true);
		expect(canTransition("ready_for_delivery", "delivering")).toBe(true);
	});

	it("never allows a manual move to delivered — only voucher redemption reaches it", () => {
		for (const from of ALL_STATUSES) {
			expect(canTransition(from, "delivered")).toBe(false);
		}
	});

	it("allows failing any in-flight order but not a finished one", () => {
		expect(canTransition("preparing", "failed")).toBe(true);
		expect(canTransition("ready_for_delivery", "failed")).toBe(true);
		expect(canTransition("delivering", "failed")).toBe(true);
		expect(canTransition("delivered", "failed")).toBe(false);
		expect(canTransition("failed", "failed")).toBe(false);
	});

	it("treats delivered and failed as terminal", () => {
		for (const to of ALL_STATUSES) {
			expect(canTransition("delivered", to)).toBe(false);
			expect(canTransition("failed", to)).toBe(false);
		}
	});

	it("does not allow skipping a step or moving backwards", () => {
		expect(canTransition("preparing", "delivering")).toBe(false);
		expect(canTransition("delivering", "ready_for_delivery")).toBe(false);
		expect(canTransition("ready_for_delivery", "preparing")).toBe(false);
	});

	it("does not allow a status to transition to itself", () => {
		for (const status of ALL_STATUSES) {
			expect(canTransition(status, status)).toBe(false);
		}
	});
});

describe("status metadata", () => {
	it("labels every status, so no UI has to invent copy", () => {
		for (const status of ALL_STATUSES) {
			expect(ORDER_STATUS_LABELS[status]).toBeTruthy();
		}
	});

	it("excludes the exception state from the happy-path sequence", () => {
		expect(ORDER_STATUS_SEQUENCE).toEqual([
			"preparing",
			"ready_for_delivery",
			"delivering",
			"delivered",
		]);
		expect(ORDER_STATUS_SEQUENCE).not.toContain("failed");
	});

	it("keeps the sequence walkable by canTransition up to delivering", () => {
		// delivered is deliberately unreachable manually, so stop one short.
		const manual = ORDER_STATUS_SEQUENCE.slice(0, 3);
		for (let i = 0; i < manual.length - 1; i += 1) {
			expect(canTransition(manual[i], manual[i + 1])).toBe(true);
		}
	});
});
