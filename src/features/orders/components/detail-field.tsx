import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface DetailFieldProps {
	label: string;
	/** Tabular figures for numbers, dates and IDs. */
	numeric?: boolean;
	/** Span every column of the parent grid (addresses, remarks). */
	wide?: boolean;
	children: ReactNode;
}

/**
 * One label/value pair on the order detail page: small muted label above the value. Every
 * detail card uses this so customer, delivery, rider and order facts read the same way.
 */
export function DetailField({ label, numeric = false, wide = false, children }: DetailFieldProps) {
	return (
		<div className={cn("flex min-w-0 flex-col gap-0.5", wide && "col-span-full")}>
			<dt className="text-xs text-fg-secondary">{label}</dt>
			<dd className={cn("text-sm break-words text-fg", numeric && "tabular-nums")}>{children}</dd>
		</div>
	);
}

/** Placeholder for a field with no value. */
export function EmptyValue({ children = "Not provided" }: { children?: ReactNode }) {
	return <span className="text-fg-tertiary">{children}</span>;
}
