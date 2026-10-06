import { z } from "zod";

export const assignRiderSchema = z.object({
	name: z.string().trim().min(1, "Name is required"),
	phone: z.string().trim().min(1, "Phone is required"),
	vehicleNumber: z.string().trim().min(1, "Vehicle number is required"),
});

export type AssignRiderValues = z.infer<typeof assignRiderSchema>;
