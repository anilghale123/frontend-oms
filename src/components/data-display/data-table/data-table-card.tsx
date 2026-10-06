"use client";

import { type ReactNode, useState } from "react";
import type { Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "./data-table-pagination";
import type { DataTableRowSize } from "./data-table-styles";
import { type DataTableFilter, DataTableToolbar } from "./data-table-toolbar";
import { type DataTableViewProps, DataTableView } from "./data-table-view";
import { dataTableFullscreenClassName, useDataTableFullscreen } from "./use-data-table-fullscreen";

export interface DataTableCardProps<TData> extends Omit<
	DataTableViewProps<TData>,
	"rowSize" | "className"
> {
	/** A `useDataTable` instance, so the page can also read it (e.g. for an export action). */
	table: Table<TData>;
	/** Shows a search box over all columns. */
	searchPlaceholder?: string;
	/** Optional single-select filter on one column. */
	filter?: DataTableFilter;
	/** Left side of the toolbar, e.g. status tabs. */
	toolbarLeading?: ReactNode;
	/** Extra toolbar controls after the icon group. Prefer `Page actions` for page-level actions. */
	toolbarActions?: ReactNode;
	/** Shows the "Show columns" icon button. */
	columnToggle?: boolean;
	/** Starting row density. Default `md`. */
	initialRowSize?: DataTableRowSize;
	/** Shows the "Full screen" icon button. Default `true`. */
	allowFullscreen?: boolean;
	/** Rows-per-page choices in the pagination bar. */
	pageSizes?: number[];
	className?: string;
}

/**
 * Table card (Meat-Management pattern): toolbar with search, filter and an icon group
 * (show columns, row size, full screen), the rows, and pagination. Owns row size and
 * full-screen state; the table instance comes from the caller.
 */
export function DataTableCard<TData>({
	table,
	searchPlaceholder,
	filter,
	toolbarLeading,
	toolbarActions,
	columnToggle,
	initialRowSize = "md",
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- full screen is hidden for now
	allowFullscreen = true,
	pageSizes,
	className,
	...view
}: DataTableCardProps<TData>) {
	// Row size and full screen controls are hidden for now; the state stays so they can return.
	const [rowSize /* , setRowSize */] = useState<DataTableRowSize>(initialRowSize);
	const { isFullscreen /* , toggleFullscreen */ } = useDataTableFullscreen();
	const showPagination = !view.loading && !view.error && table.getPageCount() > 1;

	return (
		<div
			className={cn(
				"overflow-hidden rounded-xl border border-border bg-bg",
				className,
				dataTableFullscreenClassName(isFullscreen),
			)}
		>
			<DataTableToolbar
				table={table}
				searchPlaceholder={searchPlaceholder}
				filter={filter}
				leading={toolbarLeading}
				columnToggle={columnToggle}
				// rowSize={rowSize}
				// onRowSizeChange={setRowSize}
				// isFullscreen={isFullscreen}
				// onToggleFullscreen={allowFullscreen ? toggleFullscreen : undefined}
				actions={toolbarActions}
			/>
			<DataTableView
				table={table}
				rowSize={rowSize}
				className={isFullscreen ? "flex-1" : undefined}
				{...view}
			/>
			{showPagination && <DataTablePagination table={table} pageSizes={pageSizes} />}
		</div>
	);
}
