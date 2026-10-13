import { z } from "zod";

/**
 * Assign rider (`.claude/rules/forms.md`). The API takes any rider object; OMS records the name,
 * a Nepal mobile number and the vehicle number, so the customer and the merchant can identify the
 * rider. Spaces and dashes in the phone are dropped before it is checked and sent.
 */
export const assignRiderSchema = z.object({
	name: z.string().trim().min(1, "Enter the rider's name").max(100, "Use at most 100 characters"),
	phone: z
		.string()
		.transform((value) => value.replace(/[\s-]/g, ""))
		.pipe(
			z.string().regex(/^9[78]\d{8}$/, "Enter a 10-digit mobile number starting with 97 or 98"),
		),
	// Nepal plate formats vary, so this is free text, trimmed.
	vehicleNumber: z
		.string()
		.trim()
		.min(1, "Enter the vehicle number")
		.max(30, "Use at most 30 characters"),
});

export type AssignRiderInput = z.input<typeof assignRiderSchema>;
export type AssignRiderValues = z.output<typeof assignRiderSchema>;
