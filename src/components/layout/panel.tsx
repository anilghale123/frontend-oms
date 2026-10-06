import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface PanelProps {
	children: ReactNode;
	/**
	 * Drop the built-in padding and gap so `PanelHeader` / `PanelContent` (or a full-width
	 * table) set their own spacing. Default `false`.
	 */
	flush?: boolean;
	className?: string;
}

/**
 * Bordered content surface matching DataTable cards (`rounded-xl` + `bg-bg` +
 * ring). Use for detail sections — not for interactive forms that already
 * live in a Dialog/Card. Use `flush` with `PanelHeader` + `PanelContent` for a
 * divided header row, or to run a table edge to edge.
 */
export function Panel({ children, flush = false, className }: PanelProps) {
	return (
		<div
			data-slot="panel"
			className={cn(
				"flex flex-col rounded-xl bg-bg ring-1 ring-border",
				flush ? "overflow-hidden" : "gap-3 p-4",
				className,
			)}
		>
			{children}
		</div>
	);
}

export interface PanelHeaderProps {
	/** Usually a `PanelTitle`. */
	children: ReactNode;
	/** Right-aligned meta or action, e.g. a count or a button. */
	action?: ReactNode;
	className?: string;
}

/** Header row of a `flush` Panel: title left, optional action right, divider below. */
export function PanelHeader({ children, action, className }: PanelHeaderProps) {
	return (
		<div
			data-slot="panel-header"
			className={cn(
				"flex min-h-12 items-center justify-between gap-2 border-b border-border px-4 py-3",
				className,
			)}
		>
			{children}
			{action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
		</div>
	);
}

export interface PanelContentProps {
	children: ReactNode;
	className?: string;
}

/** Padded body of a `flush` Panel. */
export function PanelContent({ children, className }: PanelContentProps) {
	return (
		<div data-slot="panel-content" className={cn("flex flex-col gap-3 p-4", className)}>
			{children}
		</div>
	);
}

export interface PanelTitleProps {
	children: ReactNode;
	className?: string;
}

/** Small section heading inside a Panel. */
export function PanelTitle({ children, className }: PanelTitleProps) {
	return (
		<h2 className={cn("text-sm font-semibold tracking-tight text-fg", className)}>{children}</h2>
	);
}

export interface PanelHintProps {
	children: ReactNode;
	className?: string;
}

/** Secondary helper text under a PanelTitle. */
export function PanelHint({ children, className }: PanelHintProps) {
	return <p className={cn("text-xs leading-relaxed text-fg-secondary", className)}>{children}</p>;
}
