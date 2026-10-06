"use client";

import { useEffect, useState } from "react";
import { MutationCache, QueryClient, QueryClientProvider } from "@tanstack/react-query";

/** Tabs of this app share one mock backend. After a change in one tab (the rider confirms a
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
