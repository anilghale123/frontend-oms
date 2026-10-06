import type { IconComponent } from "@/components/types";

/** A navigation link rendered by NavMain, NavTabs and AppSidebar. */
export interface NavLinkItem {
	/** Visible label; also the tooltip when the sidebar is collapsed. */
	label: string;
	/** Target path. Active state is derived from the current pathname. */
	href: string;
	icon?: IconComponent;
	/** Opens in a new browser tab (e.g. another surface) and is never shown as active. */
	newTab?: boolean;
}

/** Collapsible sidebar group (e.g. Configuration). */
export interface NavGroupItem {
	label: string;
	icon?: IconComponent;
	children: NavLinkItem[];
}

export type NavEntry = NavLinkItem | NavGroupItem;

/** A labeled block of sidebar items (Radian sidebar-04 group). */
export interface NavSection {
	/** Group label shown above the items. Omit for the unlabeled top section. */
	label?: string;
	items: NavEntry[];
}

export function isNavGroup(item: NavEntry): item is NavGroupItem {
	return "children" in item;
}
