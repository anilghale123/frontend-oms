import { describe, expect, it } from "vitest";
import { deliveryValidationSchema } from "./schema";

const valid = { orderId: " oms-0427 ", voucherCode: " V-1234 ", turnstileToken: "0.token" };

describe("deliveryValidationSchema", () => {
	it("accepts the Order ID, voucher code and Turnstile token, normalising the first two", () => {
		expect(deliveryValidationSchema.parse(valid)).toEqual({
			orderId: "OMS-0427",
			voucherCode: "V-1234",
			turnstileToken: "0.token",
		});
	});

	it("refuses a form whose security check has not passed (no token)", () => {
		const result = deliveryValidationSchema.safeParse({ ...valid, turnstileToken: "" });

		expect(result.success).toBe(false);
		expect(result.error?.issues).toEqual([
			expect.objectContaining({
				path: ["turnstileToken"],
				message: "Complete the security check",
			}),
		]);
	});

	it("refuses a form with the token missing altogether", () => {
		const withoutToken = { orderId: valid.orderId, voucherCode: valid.voucherCode };
		expect(deliveryValidationSchema.safeParse(withoutToken).success).toBe(false);
	});

	it("still requires the Order ID and the voucher code", () => {
		const result = deliveryValidationSchema.safeParse({
			orderId: "  ",
			voucherCode: "",
			turnstileToken: "0.token",
		});

		expect(result.error?.issues.map((issue) => issue.message)).toEqual([
			"Enter the Order ID",
			"Enter the voucher code",
		]);
	});
});
