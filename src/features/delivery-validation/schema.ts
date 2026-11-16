import { z } from "zod";
import { RIDER_FIELD_MAX_LENGTH } from "@/lib/api/contracts";

const TOO_LONG = `Use at most ${RIDER_FIELD_MAX_LENGTH} characters`;

/**
 * The rider's form: Providhy's Order ID (the `OMS-…` one), the customer's voucher code, and the
 * Cloudflare Turnstile token. The token is set by `TurnstileWidget`, not typed: it is empty until
 * the security check succeeds, and empty again once it expires or a submission spends it, so the
 * form cannot be sent without a fresh one.
 *
 * The length limit matches `/api/rider/deliver`, so the rider sees it under the field rather than
 * as a refused request.
 */
export const deliveryValidationSchema = z.object({
	orderId: z
		.string()
		.trim()
		.min(1, "Enter the Order ID")
		.max(RIDER_FIELD_MAX_LENGTH, TOO_LONG)
		.toUpperCase(),
	voucherCode: z
		.string()
		.trim()
		.min(1, "Enter the voucher code")
		.max(RIDER_FIELD_MAX_LENGTH, TOO_LONG),
	turnstileToken: z.string().min(1, "Complete the security check"),
});

export type DeliveryValidationValues = z.infer<typeof deliveryValidationSchema>;
