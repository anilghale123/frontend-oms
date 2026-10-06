"use client";

import type { ReactNode } from "react";
import type { Table } from "@tanstack/react-table";
import { Maximize2, Minimize2, Search } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Input, InputWrapper } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { DataTableRowSizeMenu } from "./data-table-row-size";
import type { DataTableRowSize } from "./data-table-styles";
import { DataTableViewOptions } from "./data-table-view-options";

export interface DataTableFilterOption {
	value: string;
	label: string;
}

export interface DataTableFilter {
	/** Column id the filter applies to. */
	columnId: string;
	/** Label of the "no filter" option, e.g. "All statuses". */
	allLabel: string;
	options: DataTableFilterOption[];
}

export interface DataTableToolbarProps<TData> {
	table: Table<TData>;
	/** Shows a search box over all columns when set. */
	searchPlaceholder?: string;
	/** Optional single-select column filter. */
	filter?: DataTableFilter;
	/** Extra controls on the left, e.g. status tabs. */
	leading?: ReactNode;
	/** Shows the "Show columns" icon button. */
	columnToggle?: boolean;
	/** Shows the "Row size" icon button when both are set. */
	rowSize?: DataTableRowSize;
	onRowSizeChange?: (size: DataTableRowSize) => void;
	/** Shows the "Full screen" icon button when `onToggleFullscreen` is set. */
	isFullscreen?: boolean;
	onToggleFullscreen?: () => void;
	/** Extra controls after the icon group. Page-level actions (export, create) belong in `Page actions`. */
	actions?: ReactNode;
}

const ALL = "__all__";

/**
 * Table toolbar (Meat-Management pattern): optional leading content on the left; search,
 * filter and a compact icon group (show columns, row size, full screen) on the right.
 */
export function DataTableToolbar<TData>({
	table,
	searchPlaceholder,
	filter,
	leading,
	columnToggle,
	rowSize,
	onRowSizeChange,
	isFullscreen = false,
	onToggleFullscreen,
	actions,
}: DataTableToolbarProps<TData>) {
	const filterColumn = filter ? table.getColumn(filter.columnId) : undefined;
	const filterValue = (filterColumn?.getFilterValue() as string | undefined) ?? ALL;
	const fullscreenLabel = isFullscreen ? "Exit full screen" : "Full screen";
	const hasIconGroup = columnToggle || (rowSize && onRowSizeChange) || onToggleFullscreen;

	return (
		<div className="flex flex-col gap-2 border-b border-border px-3 py-2.5 lg:flex-row lg:items-center lg:justify-between">
			<div className="flex min-w-0 items-center gap-2">{leading}</div>
			<div className="flex flex-wrap items-center gap-2 lg:justify-end">
				{searchPlaceholder && (
					<InputWrapper size="32" className="w-full sm:w-80">
						<Search aria-hidden />
						<Input
							type="search"
							placeholder={searchPlaceholder}
							aria-label={searchPlaceholder}
							value={(table.getState().globalFilter as string | undefined) ?? ""}
							onChange={(e) => table.setGlobalFilter(e.target.value)}
						/>
					</InputWrapper>
				)}
				{filter && filterColumn && (
					<Select
						value={filterValue}
						onValueChange={(v) => filterColumn.setFilterValue(v === ALL ? undefined : v)}
					>
						<SelectTrigger size="32" className="w-full sm:w-48" aria-label={filter.allLabel}>
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectItem value={ALL}>{filter.allLabel}</SelectItem>
							{filter.options.map((o) => (
								<SelectItem key={o.value} value={o.value}>
									{o.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				)}
				{hasIconGroup && (
					<div className="flex items-center gap-1">
						{columnToggle && <DataTableViewOptions table={table} />}
						{rowSize && onRowSizeChange && (
							<DataTableRowSizeMenu value={rowSize} onValueChange={onRowSizeChange} />
						)}
						{onToggleFullscreen && (
							<IconButton
								variant="outline"
								color="neutral"
								size="32"
								aria-label={fullscreenLabel}
								title={fullscreenLabel}
								aria-pressed={isFullscreen}
								onClick={onToggleFullscreen}
							>
								{isFullscreen ? <Minimize2 /> : <Maximize2 />}
							</IconButton>
						)}
					</div>
				)}
				{actions && <div className="flex items-center gap-2">{actions}</div>}
			</div>
		</div>
	);
}
