import { describe, expect, it } from "vitest";
import {
	ORDER_STATUSES,
	ORDER_STATUS_LABELS,
	ORDER_STATUS_SEQUENCE,
	goesThroughAssignRider,
	isFinalStatus,
	isOrderStatus,
	needsConfirmation,
	otherStatuses,
	primaryAction,
} from "./status";

describe("primaryAction", () => {
	it("matches the guide's table of primary actions per status", () => {
		// src/api.md, "Status flow and actions per status".
		expect(primaryAction("preparing")).toMatchObject({ kind: "status", to: "ready_for_delivery" });
		expect(primaryAction("ready_for_delivery")).toMatchObject({ kind: "assign_rider" });
		expect(primaryAction("delivering")).toMatchObject({ kind: "status", to: "delivered" });
		expect(primaryAction("delivered")).toBeNull();
		expect(primaryAction("failed")).toBeNull();
	});

	it("labels every action, so no screen invents copy", () => {
		for (const status of ORDER_STATUSES) {
			const action = primaryAction(status);
			if (action) expect(action.label).toBeTruthy();
		}
	});

	it("walks the whole happy path, with Assign rider standing in for delivering", () => {
		for (let i = 0; i < ORDER_STATUS_SEQUENCE.length - 1; i += 1) {
			const action = primaryAction(ORDER_STATUS_SEQUENCE[i]);
			const next = ORDER_STATUS_SEQUENCE[i + 1];
			if (action?.kind === "status") expect(action.to).toBe(next);
			else expect(goesThroughAssignRider(next)).toBe(true);
		}
	});
});

describe("otherStatuses", () => {
	it("offers every status except the current one, from any status", () => {
		// The server accepts any status from any status, including away from a final one.
		for (const status of ORDER_STATUSES) {
			const others = otherStatuses(status);
			expect(others).not.toContain(status);
			expect(others).toHaveLength(ORDER_STATUSES.length - 1);
		}
	});

	it("routes delivering through Assign rider, so the rider is recorded", () => {
		expect(goesThroughAssignRider("delivering")).toBe(true);
		expect(goesThroughAssignRider("delivered")).toBe(false);
	});
});

describe("needsConfirmation", () => {
	it("confirms Mark delivered and Mark failed from anywhere", () => {
		for (const from of ORDER_STATUSES) {
			if (from !== "delivered") expect(needsConfirmation(from, "delivered")).toBe(true);
			if (from !== "failed") expect(needsConfirmation(from, "failed")).toBe(true);
		}
	});

	it("confirms any change away from a final status", () => {
		expect(needsConfirmation("delivered", "preparing")).toBe(true);
		expect(needsConfirmation("failed", "ready_for_delivery")).toBe(true);
	});

	it("does not confirm the ordinary steps", () => {
		expect(needsConfirmation("preparing", "ready_for_delivery")).toBe(false);
		expect(needsConfirmation("ready_for_delivery", "preparing")).toBe(false);
		expect(needsConfirmation("ready_for_delivery", "delivering")).toBe(false);
	});

	it("treats delivered and failed as the end of the flow", () => {
		expect(isFinalStatus("delivered")).toBe(true);
		expect(isFinalStatus("failed")).toBe(true);
		expect(isFinalStatus("delivering")).toBe(false);
	});
});

describe("status metadata", () => {
	it("labels every status, so no UI has to invent copy", () => {
		for (const status of ORDER_STATUSES) {
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

	it("recognises only the five statuses the API sends", () => {
		expect(isOrderStatus("ready_for_delivery")).toBe(true);
		expect(isOrderStatus("cancelled")).toBe(false);
		expect(isOrderStatus(undefined)).toBe(false);
	});
});
