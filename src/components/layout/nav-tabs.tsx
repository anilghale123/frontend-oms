"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { isRouteActive } from "@/lib/nav/match";
import { cn } from "@/lib/utils";
import type { NavLinkItem } from "./types";

export interface NavTabsProps {
	items: NavLinkItem[];
	/** Accessible name for the tab row, e.g. "Order management". */
	label: string;
	className?: string;
}

/**
 * Route-driven underline tabs: each tab is a link, and the active tab follows the pathname.
 * Use for switching between sibling routes inside a page. Built on Radian `Tabs` (`open`).
 */
export function NavTabs({ items, label, className }: NavTabsProps) {
	const pathname = usePathname();
	const active = items.find((item) => isRouteActive(item.href, pathname))?.href ?? "";

	return (
		<Tabs value={active} className={cn("gap-0", className)}>
			<TabsList variant="open" aria-label={label} className="border-b-0">
				{items.map(({ label: itemLabel, href, icon: Icon }) => (
					<TabsTrigger key={href} value={href} asChild>
						<Link href={href}>
							{Icon && <Icon aria-hidden />}
							{itemLabel}
						</Link>
					</TabsTrigger>
				))}
			</TabsList>
		</Tabs>
	);
}
