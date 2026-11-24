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

/** What the voucher QR in the customer's Fonepoints app carries: `{"voucherCode": "8VMI05"}`. */
export const voucherQrSchema = z.object({
	voucherCode: z.string().trim().min(1),
});

/** The voucher number in a scanned QR code, or null when the QR isn't a Fonepoints voucher. */
export function parseVoucherQr(text: string): string | null {
	try {
		const result = voucherQrSchema.safeParse(JSON.parse(text));
		return result.success ? result.data.voucherCode : null;
	} catch {
		return null;
	}
}
