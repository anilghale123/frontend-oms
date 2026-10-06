"use client";

import Link from "next/link";
// FonepointsLogo (the wordmark) is hidden for now; re-import it with the line below.
import { FonepointsMark } from "@/components/icons/fonepoints-logo";
import { cn } from "@/lib/utils";

export interface WorkspaceHeaderProps {
	/** Full product name, used as the link's accessible name, e.g. "Fonepoints OMS". */
	label: string;
	/** Short product name shown after the wordmark, e.g. "OMS". */
	product?: string;
	/** Where the brand links; usually the surface home. */
	href: string;
	className?: string;
}

/**
 * Sidebar brand row: the product name only (e.g. "OMS") for now; the Fonepoints wordmark is
 * commented out below. When the sidebar collapses to icons, the square Fonepoints mark shows.
 */
export function WorkspaceHeader({ label, product, href, className }: WorkspaceHeaderProps) {
	return (
		<Link
			href={href}
			aria-label={label}
			className={cn(
				"flex min-w-0 flex-1 items-center gap-2 rounded-lg outline-hidden",
				"ring-sidebar-ring focus-visible:ring-2",
				"group-data-[collapsible=icon]:justify-center",
				className,
			)}
		>
			<FonepointsMark className="hidden size-7 shrink-0 group-data-[collapsible=icon]:block" />
			{/* <FonepointsLogo className="h-5 w-auto shrink-0 text-sidebar-fg group-data-[collapsible=icon]:hidden" /> */}
			{product && (
				<span className="truncate font-heading text-base font-semibold tracking-tight text-sidebar-fg group-data-[collapsible=icon]:hidden">
					{product}
				</span>
			)}
		</Link>
	);
}
