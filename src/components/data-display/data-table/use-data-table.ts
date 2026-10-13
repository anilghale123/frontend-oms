"use client";

import { useState } from "react";
import {
	type ColumnDef,
	type ColumnFiltersState,
	type OnChangeFn,
	type PaginationState,
	type SortingState,
	type VisibilityState,
	getCoreRowModel,
	getFilteredRowModel,
	getPaginationRowModel,
	getSortedRowModel,
	useReactTable,
} from "@tanstack/react-table";

/**
 * Paging and search done by the API rather than in the browser. The caller owns both and sends
 * them with its query; `data` is then just the current page.
 */
export interface DataTableServerOptions {
	/** Rows across every page, as the API reports it. */
	rowCount: number;
	pagination: PaginationState;
	onPaginationChange: OnChangeFn<PaginationState>;
	/** The search box's text. Debouncing it before a request is the caller's job. */
	globalFilter: string;
	onGlobalFilterChange: (value: string) => void;
}

export interface UseDataTableOptions<TData> {
	data: TData[];
	columns: ColumnDef<TData, unknown>[];
	/** Rows per page. Defaults to 10. Ignored in server mode, where `pagination` decides. */
	pageSize?: number;
	/** Initial sort, e.g. `[{ id: "createdAt", desc: true }]` for newest first. */
	initialSorting?: SortingState;
	/** Stable row id, e.g. `(row) => row.referenceId`. Defaults to the row index. */
	getRowId?: (row: TData) => string;
	/** Columns hidden on first render, e.g. `{ reference: false }`. Users can toggle them back. */
	initialColumnVisibility?: VisibilityState;
	/**
	 * Server-side paging and search. Sorting is off in this mode: sorting one page would look like
	 * sorting the list while quietly leaving the other pages out, so the API's order stands.
	 */
	server?: DataTableServerOptions;
}

/**
 * TanStack Table instance with client-side sorting, column filters, a global search and
 * pagination — or, with `server`, the API's. Pair with `DataTableView`, or use `DataTable` for the
 * all-in-one version.
 */
export function useDataTable<TData>({
	data,
	columns,
	pageSize = 10,
	initialSorting = [],
	getRowId,
	initialColumnVisibility = {},
	server,
}: UseDataTableOptions<TData>) {
	const [sorting, setSorting] = useState<SortingState>(initialSorting);
	const [columnVisibility, setColumnVisibility] =
		useState<VisibilityState>(initialColumnVisibility);
	const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
	const [globalFilter, setGlobalFilter] = useState("");

	const serverMode = server
		? {
				manualPagination: true,
				manualFiltering: true,
				manualSorting: true,
				enableSorting: false,
				rowCount: server.rowCount,
				onPaginationChange: server.onPaginationChange,
				onGlobalFilterChange: (value: unknown) =>
					server.onGlobalFilterChange(typeof value === "string" ? value : ""),
			}
		: {
				onGlobalFilterChange: setGlobalFilter,
				getFilteredRowModel: getFilteredRowModel(),
				getSortedRowModel: getSortedRowModel(),
				getPaginationRowModel: getPaginationRowModel(),
				initialState: { pagination: { pageIndex: 0, pageSize } },
			};

	// TanStack Table returns non-memoizable functions, so the React Compiler skips this hook.
	// That is expected and safe here; consumers re-render from the table's own state.
	// eslint-disable-next-line react-hooks/incompatible-library
	return useReactTable({
		data,
		columns,
		getRowId,
		state: {
			sorting,
			columnFilters,
			columnVisibility,
			globalFilter: server ? server.globalFilter : globalFilter,
			...(server ? { pagination: server.pagination } : {}),
		},
		onSortingChange: setSorting,
		onColumnVisibilityChange: setColumnVisibility,
		onColumnFiltersChange: setColumnFilters,
		globalFilterFn: "includesString",
		getCoreRowModel: getCoreRowModel(),
		...serverMode,
	});
}
