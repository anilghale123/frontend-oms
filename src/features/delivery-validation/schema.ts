import { z } from "zod";

/** The rider's form: Providhy's Order ID (the `OMS-…` one) and the customer's voucher code. */
export const deliveryValidationSchema = z.object({
	orderId: z.string().trim().min(1, "Enter the Order ID").toUpperCase(),
	voucherCode: z.string().trim().min(1, "Enter the voucher code"),
});

export type DeliveryValidationValues = z.infer<typeof deliveryValidationSchema>;
