import { ClipboardList, Truck } from "lucide-react";
import type { IconComponent } from "@/components/types";

/**
 * Route titles and the rider surface's branding. Page titles and document titles are derived
 * from here — never typed into a page.
 *
 * OMS has two surfaces: the order screens, embedded in the Fonepoints Business portal at
 * `/embed/orders` (the portal supplies the sidebar and header), and the rider portal at `/deliver`.
 */
export interface RouteDef {
	/** Unique id, `<surface>.<name>`. */
	id: string;
	/** Page `h1` and document title. */
	title: string;
	/** Next-style path pattern, e.g. "/embed/orders/[referenceId]". */
	href: string;
	icon: IconComponent;
}

/** The order screens, as embedded in the portal. */
export const orderRoutes = {
	orderQueue: {
		id: "orders.queue",
		title: "Order Queue",
		href: "/embed/orders",
		icon: ClipboardList,
	},
	orderDetail: {
		id: "orders.detail",
		title: "Order details",
		href: "/embed/orders/[referenceId]",
		icon: ClipboardList,
	},
} as const satisfies Record<string, RouteDef>;

/** Rider portal routes: one mobile-first page, no sidebar. */
export const riderRoutes = {
	deliver: {
		id: "rider.deliver",
		title: "Confirm delivery",
		href: "/deliver",
		icon: Truck,
	},
} as const satisfies Record<string, RouteDef>;

/**
 * The rider surface's branding. `product` is the text shown after the Fonepoints wordmark; `name`
 * is the plain-text form for titles.
 */
export const riderSurface = { name: "Fonepoints delivery", product: "Delivery" } as const;

/** Document title for a route, e.g. "Order details · Fonepoints OMS". */
export function documentTitle(route: Pick<RouteDef, "title">) {
	return `${route.title} · Fonepoints OMS`;
}
