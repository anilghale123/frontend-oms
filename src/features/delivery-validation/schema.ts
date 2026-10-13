import { z } from "zod";

/**
 * The rider's form: Providhy's Order ID (the `OMS-…` one), the customer's voucher code, and the
 * Cloudflare Turnstile token. The token is set by `TurnstileWidget`, not typed: it is empty until
 * the security check succeeds, and empty again once it expires or a submission spends it, so the
 * form cannot be sent without a fresh one.
 */
export const deliveryValidationSchema = z.object({
	orderId: z.string().trim().min(1, "Enter the Order ID").toUpperCase(),
	voucherCode: z.string().trim().min(1, "Enter the voucher code"),
	turnstileToken: z.string().min(1, "Complete the security check"),
});

export type DeliveryValidationValues = z.infer<typeof deliveryValidationSchema>;
