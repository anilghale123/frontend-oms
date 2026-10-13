import { describe, expect, it } from "vitest";
import type { PortalOrder } from "./contracts";
import { fieldErrorsFromBody, messageFromBody } from "./errors";
import { flattenAddress, humanizeKey, toOrder, toOrderList } from "./portal";

/** The example order from `src/api.md`, verbatim. */
const EXAMPLE: PortalOrder = {
	reference_id: "ORD001",
	order_id: "OMS-0427",
	merchant_detail: { id: "M-1029", name: "ABC", contact: "9801234567", pan: "123456789" },
	customer_detail: {
		identifier: "FPU-55821",
		name: "John Doe",
		contact: "9812345678",
		delivery_address: "Pulchok",
	},
	items: [
		{
			product_id: "SKU-7781",
			name: "phone",
			qty: 1,
			unit_name: "pcs",
			product_type: "goods",
			additional_info: null,
		},
	],
	status: "delivering",
	redemption_value_type: "points_money",
	redeem_points: 1000,
	amount: 100,
	rider: { name: "Ram Thapa", phone: "9841122334" },
	additional_info: null,
	logs: [
		{ status: "preparing", date: "2026-10-09 10:30", remarks: "Your order is being prepared." },
		{ status: "ready_for_delivery", date: "2026-10-09 15:00", remarks: "Your order is packed" },
		{ status: "delivering", date: "2026-10-10 09:15", remarks: "Rider Ram is on the way" },
	],
	created: "2026-10-09 10:30",
};

describe("toOrder", () => {
	it("maps the documented example", () => {
		const order = toOrder(EXAMPLE);
		expect(order.omsOrderId).toBe("OMS-0427");
		expect(order.referenceId).toBe("ORD001");
		expect(order.customer).toEqual({
			identifier: "FPU-55821",
			name: "John Doe",
			contact: "9812345678",
			deliveryAddress: "Pulchok",
			extra: [],
		});
		expect(order.items[0]).toEqual({
			productId: "SKU-7781",
			name: "phone",
			quantity: 1,
			unitName: "pcs",
			productType: "goods",
		});
		expect(order).toMatchObject({
			status: "delivering",
			valueType: "points_money",
			points: 1000,
			amount: 100,
			rider: { name: "Ram Thapa", phone: "9841122334", extra: [] },
			created: "2026-10-09 10:30",
		});
		expect(order.logs).toHaveLength(3);
		expect(order.logs[2]).toEqual({
			status: "delivering",
			date: "2026-10-10 09:15",
			remarks: "Rider Ram is on the way",
		});
	});

	it("flattens an object delivery address and keeps unknown customer keys", () => {
		const order = toOrder({
			...EXAMPLE,
			customer_detail: {
				name: "Sita",
				delivery_address: { street: "Jhamsikhel", city: "Lalitpur", landmark: "" },
				email: "sita@example.com",
			},
		});
		expect(order.customer.deliveryAddress).toBe("Jhamsikhel, Lalitpur");
		expect(order.customer.extra).toEqual([{ label: "Email", value: "sita@example.com" }]);
	});

	it("reads a free-form rider and labels its other fields", () => {
		const order = toOrder({
			...EXAMPLE,
			rider: { full_name: "Hari", mobile: "9800000000", vehicle_number: "BA 2 PA 1234" },
		});
		expect(order.rider).toEqual({
			name: "Hari",
			phone: "9800000000",
			extra: [{ label: "Vehicle number", value: "BA 2 PA 1234" }],
		});
	});

	it("survives nulls, numeric strings and unknown values without crashing", () => {
		const order = toOrder({
			...EXAMPLE,
			customer_detail: null,
			rider: null,
			redeem_points: "250.00" as unknown as number,
			amount: null,
			redemption_value_type: "points",
			logs: [{ status: "cancelled", date: "x", remarks: "" }],
			status: "cancelled",
		});
		expect(order.customer.deliveryAddress).toBe("");
		expect(order.rider).toBeNull();
		expect(order.points).toBe(250);
		expect(order.amount).toBeNull();
		expect(order.valueType).toBe("points");
		expect(order.logs).toEqual([]);
		expect(order.status).toBe("preparing");
	});
});

describe("toOrderList", () => {
	it("reads the total and whether there are more pages", () => {
		const list = toOrderList({
			count: 230,
			next: "http://10.0.0.5:8000/api/oms/portal/orders/?page=2",
			previous: null,
			data: [EXAMPLE],
		});
		expect(list.total).toBe(230);
		expect(list.hasNext).toBe(true);
		expect(list.hasPrevious).toBe(false);
		expect(list.orders[0].omsOrderId).toBe("OMS-0427");
	});
});

describe("helpers", () => {
	it("humanizes keys", () => {
		expect(humanizeKey("vehicle_number")).toBe("Vehicle number");
		expect(humanizeKey("vehicleNumber")).toBe("Vehicle number");
	});

	it("flattens nested addresses", () => {
		expect(flattenAddress({ area: "Baneshwor", geo: { ward: 10 } })).toBe("Baneshwor, 10");
	});
});

describe("Sales API error bodies", () => {
	it("names the field in a 400", () => {
		const body = { remarks: ["Ensure this field has no more than 255 characters."] };
		expect(messageFromBody(body)).toBe(
			"Remarks: Ensure this field has no more than 255 characters.",
		);
		expect(fieldErrorsFromBody(body)).toEqual({
			remarks: "Ensure this field has no more than 255 characters.",
		});
	});

	it("reads the 409 and 429 shapes", () => {
		expect(messageFromBody({ message: "Cannot move order from delivered to failed." })).toBe(
			"Cannot move order from delivered to failed.",
		);
		expect(
			messageFromBody({ detail: "Request was throttled. Expected available in 12 seconds." }),
		).toBe("Request was throttled. Expected available in 12 seconds.");
		expect(fieldErrorsFromBody({ detail: "Order not found." })).toBeNull();
	});
});
