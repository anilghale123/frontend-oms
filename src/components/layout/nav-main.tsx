"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowUpRight, ChevronRight } from "lucide-react";
import {
	SidebarCollapsible,
	SidebarCollapsibleContent,
	SidebarCollapsibleTrigger,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarMenuSub,
	SidebarMenuSubButton,
	SidebarMenuSubItem,
	useSidebar,
} from "@/components/ui/sidebar";
import { isRouteActive } from "@/lib/nav/match";
import { isNavGroup, type NavEntry, type NavGroupItem, type NavLinkItem } from "./types";

export interface NavMainProps {
	items: NavEntry[];
}

function pathMatches(href: string, pathname: string) {
	return isRouteActive(href, pathname);
}

function isGroupActive(item: NavGroupItem, pathname: string) {
	return item.children.some((child) => pathMatches(child.href, pathname));
}

function NavLeafItem({ item }: { item: NavLinkItem }) {
	const pathname = usePathname();
	const { isMobile, setOpenMobile } = useSidebar();
	const Icon = item.icon;
	const isActive = !item.newTab && pathMatches(item.href, pathname);

	return (
		<SidebarMenuItem>
			<SidebarMenuButton
				asChild
				size="32"
				variant="neutral"
				isActive={isActive}
				tooltip={item.label}
			>
				{item.newTab ? (
					<a href={item.href} target="_blank" rel="noopener">
						{Icon && <Icon aria-hidden />}
						<span>{item.label}</span>
						<ArrowUpRight className="ml-auto size-4 text-fg-tertiary" aria-hidden />
						<span className="sr-only">(opens in a new tab)</span>
					</a>
				) : (
					<Link href={item.href} onClick={() => isMobile && setOpenMobile(false)}>
						{Icon && <Icon aria-hidden />}
						<span>{item.label}</span>
					</Link>
				)}
			</SidebarMenuButton>
		</SidebarMenuItem>
	);
}

function NavGroupItemView({ item }: { item: NavGroupItem }) {
	const pathname = usePathname();
	const { isMobile, setOpenMobile } = useSidebar();
	const Icon = item.icon;
	const groupActive = isGroupActive(item, pathname);

	return (
		<SidebarMenuItem>
			<SidebarCollapsible defaultOpen={groupActive} className="group/collapsible">
				<SidebarCollapsibleTrigger asChild>
					<SidebarMenuButton
						size="32"
						isActive={groupActive}
						variant="neutral"
						tooltip={item.label}
					>
						{Icon && <Icon aria-hidden />}
						<span>{item.label}</span>
						<ChevronRight className="ml-auto size-4 transition-transform group-data-[state=open]/collapsible:rotate-90" />
					</SidebarMenuButton>
				</SidebarCollapsibleTrigger>
				<SidebarCollapsibleContent>
					<SidebarMenuSub>
						{item.children.map((child) => {
							const ChildIcon = child.icon;
							const isActive = pathMatches(child.href, pathname);
							return (
								<SidebarMenuSubItem key={child.href}>
									<SidebarMenuSubButton asChild isActive={isActive}>
										<Link href={child.href} onClick={() => isMobile && setOpenMobile(false)}>
											{ChildIcon ? <ChildIcon aria-hidden /> : null}
											<span>{child.label}</span>
										</Link>
									</SidebarMenuSubButton>
								</SidebarMenuSubItem>
							);
						})}
					</SidebarMenuSub>
				</SidebarCollapsibleContent>
			</SidebarCollapsible>
		</SidebarMenuItem>
	);
}

/**
 * Sidebar nav matching Meat-Management: flat leaves + collapsible groups.
 * Must render inside a Radian `Sidebar`.
 */
export function NavMain({ items }: NavMainProps) {
	return (
		<SidebarMenu className="gap-0.5">
			{items.map((item) =>
				isNavGroup(item) ? (
					<NavGroupItemView key={item.label} item={item} />
				) : (
					<NavLeafItem key={item.href} item={item} />
				),
			)}
		</SidebarMenu>
	);
}
