"use client";

import type { Table } from "@tanstack/react-table";
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface DataTablePaginationProps<TData> {
	table: Table<TData>;
	/** Choices for items per page. */
	pageSizes?: number[];
}

/** How many page numbers the footer shows at once. */
const PAGE_WINDOW = 4;

/**
 * The page numbers to show: up to four, starting one before the current page, slid back so the
 * last page still fills the window.
 */
export function visiblePages(pageIndex: number, pageCount: number, size = PAGE_WINDOW): number[] {
	if (pageCount <= 0) return [];
	const length = Math.min(size, pageCount);
	const start = Math.max(0, Math.min(pageIndex - 1, pageCount - length));
	return Array.from({ length }, (_, i) => start + i);
}

const ARROW =
	"flex h-6.25 items-center justify-center text-ink-muted hover:text-ink focus-visible:outline-1 focus-visible:outline-ink-muted disabled:pointer-events-none disabled:text-ink-disabled";

/**
 * Table footer, right-aligned with no border or fill: "Items per page" picker, the visible range,
 * then « page numbers ». The arrows step one page back and forward; the current page is a solid
 * square, the others plain numbers.
 */
export function DataTablePagination<TData>({
	table,
	pageSizes = [10, 25, 50, 100, 1000, 5000],
}: DataTablePaginationProps<TData>) {
	const { pageIndex, pageSize } = table.getState().pagination;
	// The filtered row count client-side; the API's total when the table is paged by the server.
	const total = table.getRowCount();
	const start = total === 0 ? 0 : pageIndex * pageSize + 1;
	const end = Math.min(total, (pageIndex + 1) * pageSize);
	const pages = visiblePages(pageIndex, table.getPageCount());

	return (
		<div className="flex shrink-0 justify-end px-6 py-4">
			<div className="flex flex-wrap items-center justify-end gap-x-7 gap-y-2 text-xs leading-4 font-bold whitespace-nowrap text-ink-muted">
				<Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
					<SelectTrigger
						size="32"
						aria-label="Items per page"
						className="h-auto w-auto gap-7 rounded-none border-0 bg-transparent p-0 text-xs leading-4 font-bold text-ink-muted shadow-none hover:text-ink focus-visible:ring-0 focus-visible:outline-1 focus-visible:outline-ink-muted [&>svg]:m-0 [&>svg]:size-3 [&>svg]:opacity-100"
					>
						<span>
							Items per page:&nbsp; <SelectValue />
						</span>
					</SelectTrigger>
					<SelectContent>
						{pageSizes.map((size) => (
							<SelectItem key={size} value={String(size)}>
								{size}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<p aria-live="polite" className="tabular-nums">
					{start}-{end} of {total}
				</p>

				<Pagination className="mx-0 w-auto">
					<PaginationContent className="gap-7">
						<PaginationItem>
							<button
								type="button"
								aria-label="Go to previous page"
								disabled={!table.getCanPreviousPage()}
								onClick={() => table.previousPage()}
								className={ARROW}
							>
								<ChevronsLeft className="size-5" strokeWidth={1.5} aria-hidden />
							</button>
						</PaginationItem>
						{pages.map((page) => {
							const current = page === pageIndex;
							return (
								<PaginationItem key={page}>
									<button
										type="button"
										aria-label={`Page ${page + 1}`}
										aria-current={current ? "page" : undefined}
										onClick={() => table.setPageIndex(page)}
										className={cn(
											"flex h-6.25 min-w-5.75 items-center justify-center px-1 tabular-nums focus-visible:outline-1 focus-visible:outline-ink-muted",
											current
												? "bg-page-current text-page-current-fg"
												: "text-ink-muted hover:text-ink",
										)}
									>
										{page + 1}
									</button>
								</PaginationItem>
							);
						})}
						<PaginationItem>
							<button
								type="button"
								aria-label="Go to next page"
								disabled={!table.getCanNextPage()}
								onClick={() => table.nextPage()}
								className={ARROW}
							>
								<ChevronsRight className="size-5" strokeWidth={1.5} aria-hidden />
							</button>
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			</div>
		</div>
	);
}
