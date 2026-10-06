"use client";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SidebarMenuButton } from "@/components/ui/sidebar";
import { initialsOf } from "@/lib/utils";

export interface SidebarProfileProps {
	/** Main line, e.g. the company name. */
	name: string;
	/** Second line, e.g. the location. */
	detail?: string;
	/** Square logo. Falls back to initials of `name`. */
	logoUrl?: string;
}

/**
 * Sidebar footer row (Meat-Management shop row): square logo, name and a muted second line.
 * Collapsed, only the logo shows and the name moves into a tooltip.
 */
export function SidebarProfile({ name, detail, logoUrl }: SidebarProfileProps) {
	return (
		<SidebarMenuButton
			size="48"
			tooltip={detail ? `${name} · ${detail}` : name}
			className="cursor-default gap-2.5 px-2 font-normal hover:bg-transparent"
		>
			<Avatar size="32" rounded="square" className="shrink-0">
				{logoUrl && <AvatarImage src={logoUrl} alt="" />}
				<AvatarFallback className="text-xs font-semibold">{initialsOf(name)}</AvatarFallback>
			</Avatar>
			<span className="grid min-w-0 flex-1 text-left leading-tight group-data-[collapsible=icon]:hidden">
				<span className="truncate text-sm font-medium text-sidebar-fg">{name}</span>
				{detail && <span className="truncate text-xs text-fg-secondary">{detail}</span>}
			</span>
		</SidebarMenuButton>
	);
}
