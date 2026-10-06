import { z } from "zod";

export const deliveryValidationSchema = z.object({
	omsOrderId: z.string().trim().min(1, "Enter the OMS Order ID").toUpperCase(),
	voucherCode: z.string().trim().min(1, "Enter the voucher number").toUpperCase(),
});

export type DeliveryValidationValues = z.infer<typeof deliveryValidationSchema>;
