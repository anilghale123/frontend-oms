import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface AppHeaderProps {
	/** Left side: sidebar trigger, breadcrumbs, or nav tabs. */
	leading?: ReactNode;
	/** Right side: role badge, user menu, contextual actions. */
	actions?: ReactNode;
	/**
	 * `default` is the 56px header used next to a sidebar. `inset` is the borderless bar above
	 * the content card in the sidebar-04 shell.
	 */
	variant?: "default" | "inset";
	className?: string;
}

/** Sticky top bar of an app shell. Layout only; contents come in through slots. */
export function AppHeader({ leading, actions, variant = "default", className }: AppHeaderProps) {
	return (
		<header
			data-slot="app-header"
			data-variant={variant}
			className={cn(
				"sticky top-0 z-10 flex shrink-0 items-center justify-between gap-2 bg-bg",
				variant === "inset" ? "px-3.5 py-3" : "border-b border-sidebar-border px-4",
				variant === "default" && "h-14",
				className,
			)}
		>
			<div className="flex min-w-0 flex-1 items-center gap-2">{leading}</div>
			{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
		</header>
	);
}
