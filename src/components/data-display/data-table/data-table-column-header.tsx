"use client";

import type { Column } from "@tanstack/react-table";
import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface DataTableColumnHeaderProps<TData, TValue> {
	column: Column<TData, TValue>;
	title: string;
	/** Right-align for numeric columns. */
	align?: "left" | "right";
}

/**
 * Column header that toggles sorting when the column can sort, and is plain text otherwise.
 * Use as `header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />`.
 */
export function DataTableColumnHeader<TData, TValue>({
	column,
	title,
	align = "left",
}: DataTableColumnHeaderProps<TData, TValue>) {
	if (!column.getCanSort()) {
		return <span className={cn("block", align === "right" && "text-right")}>{title}</span>;
	}

	const sorted = column.getIsSorted();
	const Icon = sorted === "asc" ? ArrowUp : sorted === "desc" ? ArrowDown : ArrowUpDown;
	const next = sorted === "asc" ? "descending" : "ascending";

	return (
		<div className={cn("flex", align === "right" && "justify-end")}>
			<Button
				variant="ghost"
				color="neutral"
				size="28"
				className="-mx-2 font-medium text-fg-secondary hover:text-fg"
				onClick={() => column.toggleSorting(sorted === "asc")}
				aria-label={`Sort by ${title}, ${next}`}
			>
				{title}
				<Icon className={cn("size-3.5", !sorted && "opacity-50")} aria-hidden />
			</Button>
		</div>
	);
}
