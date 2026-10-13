"use client";

import { createContext, useContext, useMemo, type ReactNode } from "react";

/**
 * Where the order screens live in the URL.
 *
 * They are served at `/embed/orders`, inside the Fonepoints Business portal's iframe. The prefix
 * is provided by the embed layout rather than hard-coded in the components, so the components
 * stay free of URL decisions and a second surface could reuse them.
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
	/** One order's detail page, by the partner's `reference_id`. */
	detail: (referenceId: string) => string;
}

/** Links to the order screens. */
export function useOrderRoutes(): OrderRoutes {
	const basePath = useContext(OrderBasePathContext);
	return useMemo(
		() => ({
			queue: `${basePath}/orders`,
			detail: (referenceId: string) => `${basePath}/orders/${encodeURIComponent(referenceId)}`,
		}),
		[basePath],
	);
}
