"use client";

import type { ReactNode } from "react";
import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuItem,
	SidebarRail,
	type SidebarProps,
} from "@/components/ui/sidebar";
import { NavMain } from "./nav-main";
import { WorkspaceHeader } from "./workspace-header";
import type { NavSection } from "./types";

export interface SidebarBrand {
	/** Product or surface name, e.g. "Fonepoints OMS". */
	name: string;
	/** Short product name shown after the Fonepoints wordmark, e.g. "OMS". */
	product?: string;
	/** Second line under the name — unused in the sidebar-04 header; kept for API compat. */
	subtitle?: string;
	/** Where the brand links to; usually the surface home. */
	href: string;
}

export interface AppSidebarProps {
	brand: SidebarBrand;
	/** Nav sections, top to bottom. Labeled sections get an uppercase group label. */
	sections: NavSection[];
	/** Bottom slot, e.g. the current user or a role switcher. */
	footer?: ReactNode;
	/** Radian sidebar theme. */
	theme?: SidebarProps["theme"];
}

/**
 * Inset app sidebar following Radian block sidebar-04: workspace row, labeled nav sections,
 * optional footer. Collapses to icons; the toggle lives in the top bar (`AppHeader`).
 * Must render inside `AppShell` (which provides the Radian `SidebarProvider`).
 */
export function AppSidebar({ brand, sections, footer, theme = "gray-body" }: AppSidebarProps) {
	return (
		<Sidebar collapsible="icon" variant="inset" theme={theme}>
			<SidebarHeader className="px-3 py-2.5">
				<SidebarMenu>
					<SidebarMenuItem className="flex flex-row items-center">
						<WorkspaceHeader
							label={brand.name}
							product={brand.product}
							href={brand.href}
							className="h-9 px-1"
						/>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent className="gap-0">
				{sections.map((section, index) => (
					<SidebarGroup
						key={section.label ?? index}
						className="px-3 py-1.5 group-data-[state=collapsed]:px-3.5"
					>
						{section.label && (
							<SidebarGroupLabel className="uppercase">{section.label}</SidebarGroupLabel>
						)}
						<SidebarGroupContent className="text-sm">
							<NavMain items={section.items} />
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>

			{footer && (
				<SidebarFooter className="px-3 pb-4">
					<SidebarMenu>
						<SidebarMenuItem>{footer}</SidebarMenuItem>
					</SidebarMenu>
				</SidebarFooter>
			)}

			<SidebarRail />
		</Sidebar>
	);
}
