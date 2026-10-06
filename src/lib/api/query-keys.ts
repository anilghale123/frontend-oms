/**
 * TanStack Query key factory. Centralized here so invalidation stays
 * consistent across features.
 */
export const queryKeys = {
	orders: {
		all: ["orders"] as const,
		list: (filters?: Record<string, unknown>) => ["orders", "list", filters] as const,
		detail: (omsOrderId: string) => ["orders", "detail", omsOrderId] as const,
		activity: (omsOrderId: string) => ["orders", "detail", omsOrderId, "activity"] as const,
	},
};
