import { describe, expect, it } from "vitest";
import {
	ASSIGN_RIDER_ENABLED,
	DELIVERING_ENABLED,
	OFFERED_STATUSES,
	ORDER_STATUSES,
	ORDER_STATUS_LABELS,
	ORDER_STATUS_SEQUENCE,
	fulfillmentSequence,
	goesThroughAssignRider,
	isFinalStatus,
	isOrderStatus,
	needsConfirmation,
	otherStatuses,
	primaryAction,
} from "./status";

/** The full flow: Delivering offered and reached through Assign rider. */
const withRider = { assignRider: true, delivering: true };
/** Delivering offered, Assign rider off. */
const withDelivering = { assignRider: false, delivering: true };

describe("primaryAction", () => {
	it("matches the guide's table of primary actions per status", () => {
		// src/api.md, "Status flow and actions per status".
		expect(primaryAction("preparing", withRider)).toMatchObject({
			kind: "status",
			to: "ready_for_delivery",
		});
		expect(primaryAction("ready_for_delivery", withRider)).toMatchObject({
			kind: "assign_rider",
		});
		expect(primaryAction("delivering", withRider)).toMatchObject({
			kind: "status",
			to: "delivered",
		});
		expect(primaryAction("delivered", withRider)).toBeNull();
		expect(primaryAction("failed", withRider)).toBeNull();
	});

	it("leads a ready order with nothing while only Assign rider is off", () => {
		expect(primaryAction("ready_for_delivery", withDelivering)).toBeNull();
		// Everything else is unchanged.
		expect(primaryAction("preparing", withDelivering)).toMatchObject({
			kind: "status",
			to: "ready_for_delivery",
		});
		expect(primaryAction("delivering", withDelivering)).toMatchObject({
			kind: "status",
			to: "delivered",
		});
	});

	it("leads a ready order with Mark delivered while Delivering is off", () => {
		expect(ASSIGN_RIDER_ENABLED).toBe(false);
		expect(DELIVERING_ENABLED).toBe(false);
		expect(primaryAction("ready_for_delivery")).toMatchObject({
			kind: "status",
			to: "delivered",
			label: "Mark delivered",
		});
		// Assign rider moves an order to Delivering, so it is not offered either.
		expect(primaryAction("ready_for_delivery", { assignRider: true })).toMatchObject({
			kind: "status",
			to: "delivered",
		});
		expect(primaryAction("preparing")).toMatchObject({ kind: "status", to: "ready_for_delivery" });
	});

	it("labels every action, so no screen invents copy", () => {
		for (const status of ORDER_STATUSES) {
			const action = primaryAction(status);
			if (action) expect(action.label).toBeTruthy();
		}
	});

	it("walks the whole happy path, with Assign rider standing in for delivering", () => {
		for (let i = 0; i < ORDER_STATUS_SEQUENCE.length - 1; i += 1) {
			const action = primaryAction(ORDER_STATUS_SEQUENCE[i], withRider);
			const next = ORDER_STATUS_SEQUENCE[i + 1];
			if (action?.kind === "status") expect(action.to).toBe(next);
			else expect(goesThroughAssignRider(next, withRider)).toBe(true);
		}
	});
});

describe("otherStatuses", () => {
	it("only moves forward, and may fail an order until it is final", () => {
		// The server accepts any status from any status; the screens never go back.
		expect(otherStatuses("preparing", withRider)).toEqual([
			"ready_for_delivery",
			"delivering",
			"delivered",
			"failed",
		]);
		expect(otherStatuses("ready_for_delivery", withRider)).toEqual([
			"delivering",
			"delivered",
			"failed",
		]);
		expect(otherStatuses("delivering", withRider)).toEqual(["delivered", "failed"]);
	});

	it("never offers an earlier status", () => {
		for (const status of ORDER_STATUS_SEQUENCE) {
			const here = ORDER_STATUS_SEQUENCE.indexOf(status);
			for (const next of otherStatuses(status, withRider)) {
				if (next !== "failed") expect(ORDER_STATUS_SEQUENCE.indexOf(next)).toBeGreaterThan(here);
			}
		}
	});

	it("offers nothing once an order is delivered or failed", () => {
		expect(otherStatuses("delivered", withRider)).toEqual([]);
		expect(otherStatuses("failed", withRider)).toEqual([]);
	});

	it("leaves Delivering out while it is off", () => {
		expect(OFFERED_STATUSES).not.toContain("delivering");
		expect(otherStatuses("preparing")).toEqual(["ready_for_delivery", "delivered", "failed"]);
		expect(otherStatuses("ready_for_delivery")).toEqual(["delivered", "failed"]);
		expect(otherStatuses("delivering")).toEqual(["delivered", "failed"]);
	});

	it("routes delivering through Assign rider, so the rider is recorded", () => {
		expect(goesThroughAssignRider("delivering", withRider)).toBe(true);
		expect(goesThroughAssignRider("delivered", withRider)).toBe(false);
	});

	it("makes delivering a plain change while Assign rider is off", () => {
		expect(goesThroughAssignRider("delivering")).toBe(false);
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

describe("fulfillmentSequence", () => {
	it("is the whole happy path while Delivering is on", () => {
		expect(fulfillmentSequence("preparing", withRider)).toEqual(ORDER_STATUS_SEQUENCE);
	});

	it("drops Delivering while it is off", () => {
		expect(fulfillmentSequence("ready_for_delivery")).toEqual([
			"preparing",
			"ready_for_delivery",
			"delivered",
		]);
		// Also for an order that went through Delivering before it was turned off.
		expect(fulfillmentSequence("delivered")).not.toContain("delivering");
	});

	it("keeps Delivering for an order that is delivering now, so its current step shows", () => {
		expect(fulfillmentSequence("delivering")).toContain("delivering");
	});
});
