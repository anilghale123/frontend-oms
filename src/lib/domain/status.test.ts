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
	it("leads a preparing order with Mark ready", () => {
		expect(primaryAction("preparing", withRider)).toMatchObject({
			kind: "status",
			to: "ready_for_delivery",
		});
		expect(primaryAction("ready_for_delivery", withRider)).toMatchObject({
			kind: "assign_rider",
		});
	});

	it("never offers Mark delivered: the rider and backend mark delivery", () => {
		for (const status of ORDER_STATUSES) {
			for (const options of [withRider, withDelivering, {}]) {
				const action = primaryAction(status, options);
				if (action?.kind === "status") expect(action.to).not.toBe("delivered");
			}
		}
		expect(primaryAction("delivering", withRider)).toBeNull();
		expect(primaryAction("delivered", withRider)).toBeNull();
		expect(primaryAction("failed", withRider)).toBeNull();
	});

	it("leads a ready order with nothing while Assign rider is off", () => {
		expect(ASSIGN_RIDER_ENABLED).toBe(false);
		expect(DELIVERING_ENABLED).toBe(true);
		expect(primaryAction("ready_for_delivery")).toBeNull();
		expect(primaryAction("ready_for_delivery", withDelivering)).toBeNull();
		expect(primaryAction("preparing")).toMatchObject({ kind: "status", to: "ready_for_delivery" });
	});

	it("labels every action, so no screen invents copy", () => {
		for (const status of ORDER_STATUSES) {
			const action = primaryAction(status);
			if (action) expect(action.label).toBeTruthy();
		}
	});
});

describe("otherStatuses", () => {
	it("moves freely between the merchant statuses, and may fail an order", () => {
		expect(otherStatuses("preparing", withRider)).toEqual([
			"ready_for_delivery",
			"delivering",
			"failed",
		]);
		expect(otherStatuses("ready_for_delivery", withRider)).toEqual([
			"preparing",
			"delivering",
			"failed",
		]);
		expect(otherStatuses("delivering", withRider)).toEqual([
			"preparing",
			"ready_for_delivery",
			"failed",
		]);
	});

	it("never offers Delivered, which the rider and backend set", () => {
		for (const status of ORDER_STATUSES) {
			expect(otherStatuses(status, withRider)).not.toContain("delivered");
			expect(otherStatuses(status)).not.toContain("delivered");
		}
	});

	it("offers nothing once an order is delivered or failed", () => {
		expect(otherStatuses("delivered", withRider)).toEqual([]);
		expect(otherStatuses("failed", withRider)).toEqual([]);
	});

	it("offers Delivering by default, and leaves it out when turned off", () => {
		expect(OFFERED_STATUSES).toContain("delivering");
		expect(otherStatuses("preparing")).toEqual(["ready_for_delivery", "delivering", "failed"]);
		expect(otherStatuses("preparing", { delivering: false })).toEqual([
			"ready_for_delivery",
			"failed",
		]);
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
	it("confirms Mark failed from anywhere", () => {
		for (const from of ORDER_STATUSES) {
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
		expect(needsConfirmation("delivering", "ready_for_delivery")).toBe(false);
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
		expect(fulfillmentSequence("ready_for_delivery", { delivering: false })).toEqual([
			"preparing",
			"ready_for_delivery",
			"delivered",
		]);
		// Also for an order that went through Delivering before it was turned off.
		expect(fulfillmentSequence("delivered", { delivering: false })).not.toContain("delivering");
	});

	it("keeps Delivering for an order that is delivering now, so its current step shows", () => {
		expect(fulfillmentSequence("delivering", { delivering: false })).toContain("delivering");
	});
});
