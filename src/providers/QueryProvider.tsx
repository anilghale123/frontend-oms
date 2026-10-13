"use client";

import { useEffect, useState } from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ApiError } from "@/lib/api/client";

/**
 * Retries are for failures that might pass: the network, a 5xx. A 4xx answers the same the second
 * time, and the Sales service allows 60 requests a minute per token — a `429` must wait for its
 * `Retry-After`, never loop (`src/api.md`, "Errors"), and a `401` has no refresh to retry with.
 */
function shouldRetry(failureCount: number, error: unknown): boolean {
	if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
	return failureCount < 2;
}

/** Tabs of this app share one backend. After a change in one tab (the rider confirms a
 * delivery, the merchant marks an order ready), the others refetch so they show it live. */
const SYNC_CHANNEL = "oms-sync";

/** Opened by the provider's effect, so it only exists in the browser. */
let syncChannel: BroadcastChannel | null = null;

export function QueryProvider({ children }: { children: React.ReactNode }) {
	const [client] = useState(
		() =>
			new QueryClient({
				defaultOptions: {
					queries: {
						staleTime: 30_000,
						retry: shouldRetry,
					},
				},
				// Mutations that change nothing opt out with `meta: { syncTabs: false }`.
				mutationCache: new MutationCache({
					onSuccess: (_data, _variables, _context, mutation) => {
						if (mutation.meta?.syncTabs !== false) syncChannel?.postMessage("changed");
					},
				}),
			}),
	);

	useEffect(() => {
		if (typeof BroadcastChannel === "undefined") return;
		const sync = new BroadcastChannel(SYNC_CHANNEL);
		sync.onmessage = () => void client.invalidateQueries();
		syncChannel = sync;
		return () => {
			syncChannel = null;
			sync.close();
		};
	}, [client]);

	return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
