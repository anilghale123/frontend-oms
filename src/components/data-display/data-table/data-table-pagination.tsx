"use client";

import { useId } from "react";
import type { Table } from "@tanstack/react-table";
import { ChevronFirst, ChevronLast, ChevronLeft, ChevronRight } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Pagination, PaginationContent, PaginationItem } from "@/components/ui/pagination";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";

export interface DataTablePaginationProps<TData> {
	table: Table<TData>;
	/** Choices for rows per page. */
	pageSizes?: number[];
}

/** Radian table pagination: rows-per-page select, visible range, and first/previous/next/last buttons. */
export function DataTablePagination<TData>({
	table,
	pageSizes = [10, 20, 50],
}: DataTablePaginationProps<TData>) {
	const labelId = useId();
	const { pageIndex, pageSize } = table.getState().pagination;
	const total = table.getFilteredRowModel().rows.length;
	const start = total === 0 ? 0 : pageIndex * pageSize + 1;
	const end = Math.min(total, (pageIndex + 1) * pageSize);

	const canPrevious = table.getCanPreviousPage();
	const canNext = table.getCanNextPage();
	const steps = [
		{
			label: "Go to first page",
			icon: ChevronFirst,
			disabled: !canPrevious,
			onClick: () => table.firstPage(),
		},
		{
			label: "Go to previous page",
			icon: ChevronLeft,
			disabled: !canPrevious,
			onClick: () => table.previousPage(),
		},
		{
			label: "Go to next page",
			icon: ChevronRight,
			disabled: !canNext,
			onClick: () => table.nextPage(),
		},
		{
			label: "Go to last page",
			icon: ChevronLast,
			disabled: !canNext,
			onClick: () => table.lastPage(),
		},
	];

	return (
		<div className="flex items-center justify-between gap-8 border-t border-border bg-fill1 px-3 py-2">
			<div className="flex items-center gap-3">
				<Label id={labelId} className="text-fg-secondary max-sm:sr-only">
					Rows per page
				</Label>
				<Select value={String(pageSize)} onValueChange={(v) => table.setPageSize(Number(v))}>
					<SelectTrigger size="32" className="w-fit whitespace-nowrap" aria-labelledby={labelId}>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{pageSizes.map((size) => (
							<SelectItem key={size} value={String(size)}>
								{size}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="flex grow justify-end text-sm whitespace-nowrap text-fg-secondary">
				<p className="tabular-nums" aria-live="polite">
					<span className="text-fg">
						{start}–{end}
					</span>{" "}
					of {total}
				</p>
			</div>
			<Pagination className="mx-0 w-auto">
				<PaginationContent>
					{steps.map(({ label, icon: Icon, disabled, onClick }) => (
						<PaginationItem key={label}>
							<IconButton
								variant="outline"
								color="neutral"
								size="32"
								aria-label={label}
								disabled={disabled}
								onClick={onClick}
							>
								<Icon />
							</IconButton>
						</PaginationItem>
					))}
				</PaginationContent>
			</Pagination>
		</div>
	);
}
