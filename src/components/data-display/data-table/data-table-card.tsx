"use client";

import type { ReactNode } from "react";
import type { Table } from "@tanstack/react-table";
import { cn } from "@/lib/utils";
import { DataTablePagination } from "./data-table-pagination";
import type { DataTableRowSize } from "./data-table-styles";
import { type DataTableFilter, DataTableToolbar } from "./data-table-toolbar";
import { type DataTableViewProps, DataTableView } from "./data-table-view";

export interface DataTableCardProps<TData> extends Omit<DataTableViewProps<TData>, "className"> {
	/** A `useDataTable` instance, so the page can also read it (e.g. its filters). */
	table: Table<TData>;
	/** Shows a search box over all columns. */
	searchPlaceholder?: string;
	/** Optional single-select filter on one column. */
	filter?: DataTableFilter;
	/** Extra classes for the toolbar row. */
	toolbarClassName?: string;
	/** Left side of the toolbar, e.g. status tabs. */
	toolbarLeading?: ReactNode;
	/** Extra toolbar controls after the icon group. Prefer `Page actions` for page-level actions. */
	toolbarActions?: ReactNode;
	/** Shows the "Show columns" icon button. */
	columnToggle?: boolean;
	/** Row density. Default `md`. */
	rowSize?: DataTableRowSize;
	/** Rows-per-page choices in the pagination bar. */
	pageSizes?: number[];
	className?: string;
}

/**
 * Table card (Meat-Management pattern): toolbar with search, filter and an optional "Show columns"
 * button, the rows, and pagination. The table instance comes from the caller.
 *
 * A column that is as tall as its rows. In a parent with a bounded height it stops at that height
 * (it shrinks, never grows past its content): the toolbar and the pagination keep their size and
 * only the rows scroll, under the sticky column headers.
 */
export function DataTableCard<TData>({
	table,
	searchPlaceholder,
	filter,
	toolbarLeading,
	toolbarClassName,
	toolbarActions,
	columnToggle,
	rowSize = "md",
	pageSizes,
	className,
	...view
}: DataTableCardProps<TData>) {
	// Shown whenever there are rows, even on a single page, so a large page size can be changed back.
	const showPagination = !view.loading && !view.error && table.getRowCount() > 0;

	return (
		<div
			className={cn(
				"flex flex-col overflow-hidden rounded-xl border border-border bg-bg",
				className,
			)}
		>
			<DataTableToolbar
				table={table}
				searchPlaceholder={searchPlaceholder}
				filter={filter}
				leading={toolbarLeading}
				className={toolbarClassName}
				columnToggle={columnToggle}
				actions={toolbarActions}
			/>
			<DataTableView table={table} rowSize={rowSize} className="flex-1" {...view} />
			{showPagination && <DataTablePagination table={table} pageSizes={pageSizes} />}
		</div>
	);
}
