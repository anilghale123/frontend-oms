"use client";

import type { Table } from "@tanstack/react-table";
import { Columns3 } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuCheckboxItem,
	DropdownMenuContent,
	DropdownMenuDivider,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface DataTableViewOptionsProps<TData> {
	table: Table<TData>;
}

/**
 * "Show columns" icon button (toolbar icon group, next to row size and full screen). Lists
 * every column with `enableHiding` (the default); set `enableHiding: false` on columns that
 * must always show. Labels come from `meta.label`, falling back to the column id. The button
 * looks pressed while any column is hidden.
 */
export function DataTableViewOptions<TData>({ table }: DataTableViewOptionsProps<TData>) {
	const columns = table.getAllLeafColumns().filter((column) => column.getCanHide());
	if (columns.length === 0) return null;

	const hiddenCount = columns.filter((column) => !column.getIsVisible()).length;
	const label = hiddenCount > 0 ? `Show columns (${hiddenCount} hidden)` : "Show columns";

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<IconButton
					variant="outline"
					color="neutral"
					size="32"
					aria-label={label}
					title={label}
					className={cn(hiddenCount > 0 && "border-fg-tertiary bg-fill1")}
				>
					<Columns3 />
				</IconButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-56">
				<DropdownMenuLabel>Show columns</DropdownMenuLabel>
				{columns.map((column) => (
					<DropdownMenuCheckboxItem
						key={column.id}
						className="relative"
						checked={column.getIsVisible()}
						onCheckedChange={(value) => column.toggleVisibility(Boolean(value))}
						onSelect={(event) => event.preventDefault()}
					>
						{column.columnDef.meta?.label ?? column.id}
					</DropdownMenuCheckboxItem>
				))}
				<DropdownMenuDivider />
				<DropdownMenuItem
					disabled={hiddenCount === 0}
					onSelect={(event) => {
						event.preventDefault();
						columns.forEach((column) => column.toggleVisibility(true));
					}}
				>
					Show all columns
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
