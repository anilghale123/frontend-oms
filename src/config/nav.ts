import { ClipboardList, House, Settings, Truck } from "lucide-react";
import type { IconComponent } from "@/components/types";
import type { NavLinkItem, NavSection } from "@/components/layout/types";
import type { Permission } from "@/lib/domain";
import { type MatchableRoute, buildBreadcrumbs, matchRoute } from "@/lib/nav/match";

/**
 * One typed route config per surface. Sidebars, breadcrumbs, page titles and document titles
 * are all derived from here — never typed into a page or resolved by regex.
 */
export interface RouteDef extends MatchableRoute {
	/** Unique id, `<surface>.<name>`; referenced by `parent`. */
	id: string;
	/** Short label for sidebar items. */
	label: string;
	/** Page `h1` and document title. */
	title: string;
	/** Next-style path pattern, e.g. "/orders/[omsOrderId]". */
	href: string;
	icon: IconComponent;
	/** Permission needed to open the route; `null` means open to anyone. */
	permission: Permission | null;
	/** Listed in the surface's sidebar. Detail routes are not. */
	inNav: boolean;
	/** Breadcrumb parent route id. */
	parent?: string;
}

/** Rider portal routes: one mobile-first page, no sidebar. */
export const riderRoutes = {
	deliver: {
		id: "rider.deliver",
		label: "Deliver",
		title: "Confirm delivery",
		href: "/deliver",
		icon: Truck,
		permission: null,
		inNav: false,
	},
} as const satisfies Record<string, RouteDef>;

/**
 * Merchant portal routes. OMS is two pages (Order Queue and Order detail); Home and Settings
 * are placeholders that round out the sidebar. Permissions are open for now.
 */
export const merchantRoutes = {
	home: {
		id: "merchant.home",
		label: "Home",
		title: "Home",
		href: "/",
		icon: House,
		permission: null,
		inNav: true,
	},
	settings: {
		id: "merchant.settings",
		label: "Settings",
		title: "Settings",
		href: "/settings",
		icon: Settings,
		permission: null,
		inNav: true,
	},
	orderQueue: {
		id: "merchant.orderQueue",
		label: "Order Queue",
		title: "Order Queue",
		href: "/orders",
		icon: ClipboardList,
		permission: null,
		inNav: true,
	},
	orderDetail: {
		id: "merchant.orderDetail",
		label: "Order",
		title: "Order details",
		href: "/orders/[omsOrderId]",
		icon: ClipboardList,
		permission: null,
		inNav: false,
		parent: "merchant.orderQueue",
	},
} as const satisfies Record<string, RouteDef>;

/** Merchant sidebar sections (Radian sidebar-04 layout): Home and Settings, then OMS. */
export const merchantNav: NavSection[] = [
	{
		items: [leaf(merchantRoutes.home), leaf(merchantRoutes.settings)],
	},
	{
		label: "OMS",
		items: [
			leaf(merchantRoutes.orderQueue),
			// Prototype shortcut: the rider portal is its own surface, opened beside the dashboard.
			{ label: "Delivery portal", href: riderRoutes.deliver.href, icon: Truck, newTab: true },
		],
	},
];

function leaf(route: RouteDef): NavLinkItem {
	return { label: route.label, href: route.href, icon: route.icon };
}

export type Surface = "merchant" | "rider";

/**
 * Surface-level branding, shown in sidebars and headers. `product` is the text shown after the
 * Fonepoints wordmark; `name` is the plain-text form for titles and breadcrumbs.
 */
export const surfaces: Record<
	Surface,
	{ name: string; product: string; home: string; routes: readonly RouteDef[] }
> = {
	merchant: {
		name: "Fonepoints OMS",
		product: "OMS",
		home: merchantRoutes.home.href,
		routes: Object.values(merchantRoutes),
	},
	rider: {
		name: "Fonepoints delivery",
		product: "Delivery",
		home: riderRoutes.deliver.href,
		routes: Object.values(riderRoutes),
	},
};

/** The route of `surface` matching `pathname`, with its params. */
export function findRoute(surface: Surface, pathname: string) {
	return matchRoute(surfaces[surface].routes, pathname);
}

/** Breadcrumbs for `pathname` within `surface`, root first; empty when nothing matches. */
export function breadcrumbsFor(surface: Surface, pathname: string) {
	const match = findRoute(surface, pathname);
	return match ? buildBreadcrumbs(surfaces[surface].routes, match) : [];
}

/** Document title for a route, e.g. "Order details · Fonepoints OMS". */
export function documentTitle(route: Pick<RouteDef, "title">) {
	return `${route.title} · Fonepoints OMS`;
}
