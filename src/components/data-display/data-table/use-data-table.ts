"use client";

import { useState } from "react";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type SortingState,
	type VisibilityState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";

export interface UseDataTableOptions<TData> {
	data: TData[];
	columns: ColumnDef<TData, unknown>[];
	/** Rows per page. Defaults to 10. */
	pageSize?: number;
	/** Initial sort, e.g. `[{ id: "createdAt", desc: true }]` for newest first. */
	initialSorting?: SortingState;
	/** Stable row id, e.g. `(row) => row.omsOrderId`. Defaults to the row index. */
	getRowId?: (row: TData) => string;
	/** Columns hidden on first render, e.g. `{ reference: false }`. Users can toggle them back. */
	initialColumnVisibility?: VisibilityState;
}

/**
 * TanStack Table instance with client-side sorting, column filters, a global search and
 * pagination. Pair with `DataTableView`, or use `DataTable` for the all-in-one version.
 */
export function useDataTable<TData>({
	data,
	columns,
	pageSize = 10,
	initialSorting = [],
	getRowId,
	initialColumnVisibility = {},
}: UseDataTableOptions<TData>) {
	const [sorting, setSorting] = useState<SortingState>(initialSorting);
	const [columnVisibility, setColumnVisibility] =
		useState<VisibilityState>(initialColumnVisibility);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");

	// TanStack Table returns non-memoizable functions, so the React Compiler skips this hook.
	// That is expected and safe here; consumers re-render from the table's own state.
	// eslint-disable-next-line react-hooks/incompatible-library
	return useReactTable({
		data,
		columns,
		getRowId,
		state: { sorting, columnFilters, globalFilter, columnVisibility },
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		onColumnFiltersChange: setColumnFilters,
		onGlobalFilterChange: setGlobalFilter,
		globalFilterFn: "includesString",
		getCoreRowModel: getCoreRowModel(),
		getFilteredRowModel: getFilteredRowModel(),
		getSortedRowModel: getSortedRowModel(),
		getPaginationRowModel: getPaginationRowModel(),
		initialState: { pagination: { pageIndex: 0, pageSize } },
	});
}
