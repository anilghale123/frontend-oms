/**
 * Generic route matching for nav configs. Route hrefs are Next-style patterns
 * ("/orders/[omsOrderId]"); matching is by path segment, so no route ever needs its own regex.
 * Pure TypeScript — no React, no Next.
 */

/** The minimum a route needs to be matched and to produce breadcrumbs. */
export interface MatchableRoute {
	id: string;
	href: string;
	title: string;
	/** Breadcrumb parent route id. */
	parent?: string;
}

export interface RouteMatch<R extends MatchableRoute> {
	route: R;
	params: Record<string, string>;
}

export interface Crumb {
	label: string;
	/** Omitted for the current page. */
	href?: string;
}

const segments = (path: string) => path.split("/").filter(Boolean);
const isParam = (segment: string) => segment.startsWith("[") && segment.endsWith("]");

/** Returns the params if `pathname` matches `pattern`, else `null`. */
export function matchPattern(pattern: string, pathname: string): Record<string, string> | null {
	const want = segments(pattern);
	const have = segments(pathname);
	if (want.length !== have.length) return null;

	const params: Record<string, string> = {};
	for (let i = 0; i < want.length; i++) {
		if (isParam(want[i])) params[want[i].slice(1, -1)] = decodeURIComponent(have[i]);
		else if (want[i] !== have[i]) return null;
	}
	return params;
}

/** Replaces `[param]` segments in `pattern` with values from `params`. */
export function fillPattern(pattern: string, params: Record<string, string>): string {
	const filled = segments(pattern).map((s) =>
		isParam(s) ? encodeURIComponent(params[s.slice(1, -1)] ?? "") : s,
	);
	return `/${filled.join("/")}`;
}

/**
 * Finds the route whose pattern matches `pathname`. When several match, the one with the most
 * static segments wins (`/cs/orders/new` beats `/cs/orders/[omsOrderId]`).
 */
export function matchRoute<R extends MatchableRoute>(
	routes: readonly R[],
	pathname: string,
): RouteMatch<R> | null {
	let best: RouteMatch<R> | null = null;
	let bestScore = -1;
	for (const route of routes) {
		const params = matchPattern(route.href, pathname);
		if (!params) continue;
		const score = segments(route.href).filter((s) => !isParam(s)).length;
		if (score > bestScore) {
			best = { route, params };
			bestScore = score;
		}
	}
	return best;
}

/** Walks the `parent` chain of a matched route to build breadcrumbs, root first. */
export function buildBreadcrumbs<R extends MatchableRoute>(
	routes: readonly R[],
	match: RouteMatch<R>,
): Crumb[] {
	const byId = new Map(routes.map((r) => [r.id, r]));
	const chain: Crumb[] = [{ label: match.route.title }];
	const seen = new Set([match.route.id]);

	let parentId = match.route.parent;
	while (parentId && !seen.has(parentId)) {
		const parent = byId.get(parentId);
		if (!parent) break;
		seen.add(parentId);
		chain.unshift({ label: parent.title, href: fillPattern(parent.href, match.params) });
		parentId = parent.parent;
	}
	return chain;
}

/**
 * Whether a nav link to `href` should be shown active for `pathname`: an exact match, or a
 * descendant path. "/" is only active on "/".
 */
export function isRouteActive(href: string, pathname: string): boolean {
	if (href === "/") return pathname === "/";
	return pathname === href || pathname.startsWith(`${href}/`);
}
