"use client";

import type { ColumnDef, SortingState, VisibilityState } from "@tanstack/react-table";
import { type DataTableCardProps, DataTableCard } from "./data-table-card";
import { useDataTable } from "./use-data-table";

export interface DataTableProps<TData> extends Omit<DataTableCardProps<TData>, "table"> {
	data: TData[];
	columns: ColumnDef<TData, unknown>[];
	/** Columns hidden on first render, e.g. `{ reference: false }`. */
	initialColumnVisibility?: VisibilityState;
	pageSize?: number;
	initialSorting?: SortingState;
	getRowId?: (row: TData) => string;
}

/**
 * All-in-one table: creates the TanStack instance and renders a `DataTableCard` (toolbar with
 * search, filter, show columns, row size and full screen; rows; pagination; loading, empty and
 * error states). Client-side data only. When the page needs the table instance too (e.g. an
 * export action in the page header), call `useDataTable` and render `DataTableCard` yourself.
 */
export function DataTable<TData>({
	data,
	columns,
	initialColumnVisibility,
	pageSize,
	initialSorting,
	getRowId,
	...card
}: DataTableProps<TData>) {
	const table = useDataTable({
		data,
		columns,
		pageSize,
		initialSorting,
		getRowId,
		initialColumnVisibility,
	});
	return <DataTableCard table={table} {...card} />;
}
