import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
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
	afterEach(cleanup);

	it("shows every form answer as sent, including name and phone, with no avatar header", () => {
		render(<OrderCustomerDetails customer={CUSTOMER} />);
		expect(screen.getByText("Name")).toBeTruthy();
		expect(screen.getByText("Freddy")).toBeTruthy();
		expect(screen.getByText("Contact")).toBeTruthy();
		expect(screen.getByText("9803443344")).toBeTruthy();
		expect(screen.getByText("Delivery Address")).toBeTruthy();
		expect(screen.getByText("Landmark")).toBeTruthy();
		expect(screen.getByText("Not provided")).toBeTruthy();
		expect(screen.queryByText("Customer ID")).toBeNull();
	});

	it("falls back to the avatar, name, phone and customer ID when there is no form data", () => {
		render(
			<OrderCustomerDetails
				customer={{ ...CUSTOMER, identifier: "FPU-1", formData: [] }}
			/>,
		);
		expect(screen.getByText("Freddy")).toBeTruthy();
		expect(screen.getByText("Customer ID")).toBeTruthy();
	});
});
