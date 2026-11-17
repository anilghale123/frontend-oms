import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { OrderCustomer } from "@/lib/domain";
import { OrderCustomerDetails } from "./order-customer-panel";

const CUSTOMER: OrderCustomer = {
	identifier: "",
	name: "Freddy",
	contact: "9803443344",
	deliveryAddress: "Pulchowk",
	formData: [
		{ label: "Name", value: "Freddy" },
		{ label: "Contact", value: "9803443344" },
		{ label: "Delivery Address", value: "Pulchowk" },
		{ label: "Landmark", value: "" },
	],
	extra: [],
};

describe("OrderCustomerDetails", () => {
	it("lists the redeem form answers without repeating the name and phone", () => {
		render(<OrderCustomerDetails customer={CUSTOMER} />);
		expect(screen.getAllByText("Freddy")).toHaveLength(1);
		expect(screen.queryByText("Contact")).toBeNull();
		expect(screen.getByText("Delivery Address")).toBeTruthy();
		expect(screen.getByText("Pulchowk")).toBeTruthy();
		expect(screen.getByText("Landmark")).toBeTruthy();
		expect(screen.getByText("Not provided")).toBeTruthy();
		// No customer ID was sent, so there is no empty "Customer ID" row.
		expect(screen.queryByText("Customer ID")).toBeNull();
	});
});
