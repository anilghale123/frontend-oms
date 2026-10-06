"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Where the order screens live in the URL.
 *
 * OMS is served two ways:
 * - **standalone** at `/orders` (its own sidebar and header), and
 * - **embedded** at `/embed/orders`, inside the Fonepoints Business portal's iframe, where the
 *   host supplies the chrome and OMS renders only its content.
 *
 * Both serve the same feature components, so the components must not hard-code `/orders`.
 * They read their links from here instead. The default base is `""`, so standalone URLs are
 * exactly what they were before embedding existed.
 */
const OrderBasePathContext = createContext<string>("");

export interface OrderRoutesProviderProps {
	/** URL prefix for the order screens, e.g. `"/embed"`. No trailing slash. */
	basePath: string;
	children: ReactNode;
}

export function OrderRoutesProvider({ basePath, children }: OrderRoutesProviderProps) {
	return <OrderBasePathContext.Provider value={basePath}>{children}</OrderBasePathContext.Provider>;
}

export interface OrderRoutes {
	/** The order queue. */
	queue: string;
	/** One order's detail page. */
	detail: (omsOrderId: string) => string;
}

/** Links to the order screens, correct for whichever way OMS is currently served. */
export function useOrderRoutes(): OrderRoutes {
	const basePath = useContext(OrderBasePathContext);
	return useMemo(
		() => ({
			queue: `${basePath}/orders`,
			detail: (omsOrderId: string) => `${basePath}/orders/${encodeURIComponent(omsOrderId)}`,
		}),
		[basePath],
	);
}

/** True when OMS is rendering inside the host portal rather than as its own dashboard. */
export function useIsEmbedded(): boolean {
	return useContext(OrderBasePathContext) !== "";
}
