/**
 * TanStack Query key factory. Centralized here so invalidation stays
 * consistent across features.
 */
export const queryKeys = {
	orders: {
		all: ["orders"] as const,
		/** Every list query, whatever its filters — what a status change makes stale. */
		lists: ["orders", "list"] as const,
		list: (filters?: Record<string, unknown>) => ["orders", "list", filters] as const,
		/** One order, by the partner's `reference_id` — the key every order endpoint takes. */
		detail: (referenceId: string) => ["orders", "detail", referenceId] as const,
	},
};
