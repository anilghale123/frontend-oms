"use client";

import type { KeyboardEvent, MouseEvent, ReactNode } from "react";
import {
	type Row,
	type RowData,
	type Table as TanstackTable,
	flexRender,
} from "@tanstack/react-table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState, type EmptyStateProps } from "@/components/feedback/empty-state";
import { DATA_TABLE_ROW_SIZE_CLASS, type DataTableRowSize } from "./data-table-styles";
import { ErrorState } from "@/components/feedback/error-state";

declare module "@tanstack/react-table" {
	// eslint-disable-next-line @typescript-eslint/no-unused-vars
	interface ColumnMeta<TData extends RowData, TValue> {
		/** Extra classes for this column's header and cells, e.g. "text-right tabular-nums". */
		className?: string;
		/** Human label for the column, used by `DataTableViewOptions` and exports. */
		label?: string;
		/**
		 * How this column appears in exports. Omit to export `label` + the cell value; pass
		 * several entries to split one column (e.g. customer → name and email); pass `[]` to skip.
		 */
		export?: { label: string; value: (row: TData) => string | number | null | undefined }[];
	}
}

export interface DataTableViewProps<TData> {
	table: TanstackTable<TData>;
	/** Shows skeleton rows instead of data. */
	loading?: boolean;
	/** When set, replaces the rows with an ErrorState. */
	error?: { title?: string; description?: string } | null;
	onRetry?: () => void;
	/** Shown when there are no rows (after filtering). */
	empty?: Pick<EmptyStateProps, "icon" | "title" | "description" | "action">;
	/** Makes rows clickable (and keyboard-activatable with Enter). */
	onRowClick?: (row: TData) => void;
	/** Number of skeleton rows while loading. */
	skeletonRows?: number;
	/** Row density. Default `md`. */
	rowSize?: DataTableRowSize;
	/** Classes for the scroll container, e.g. `flex-1` to fill a full-screen card. */
	className?: string;
}

// Clicks inside these never trigger onRowClick. Menu roles are listed because React bubbles
// events from portaled dropdown content up to the row.
const INTERACTIVE = [
	"button",
	"a",
	"input",
	"select",
	"textarea",
	"label",
	"[role='checkbox']",
	"[role='menu']",
	"[role='menuitem']",
	"[role='menuitemcheckbox']",
	"[role='menuitemradio']",
	"[data-slot='button']",
].join(", ");

/** Table body for a TanStack instance, with loading, empty and error states. */
export function DataTableView<TData>({
	table,
	loading,
	error,
	onRetry,
	empty = { title: "No results", description: "Try a different search or filter." },
	onRowClick,
	skeletonRows = 5,
	rowSize = "md",
	className,
}: DataTableViewProps<TData>) {
	const sizeClass = DATA_TABLE_ROW_SIZE_CLASS[rowSize];
	const columns = table.getVisibleLeafColumns();
	const rows = table.getRowModel().rows;

	const activate = (row: Row<TData>, event: MouseEvent | KeyboardEvent) => {
		if ((event.target as HTMLElement).closest(INTERACTIVE)) return;
		// Ignore events bubbled (through React portals) from outside the row's DOM.
		if (!event.currentTarget.contains(event.target as Node)) return;
		onRowClick?.(row.original);
	};

	let body: ReactNode;
	if (error) {
		body = (
			<FullRow span={columns.length}>
				<ErrorState {...error} onRetry={onRetry} className="border-0" />
			</FullRow>
		);
	} else if (loading) {
		body = Array.from({ length: skeletonRows }, (_, i) => (
			<TableRow key={i}>
				{columns.map((column) => (
					<TableCell key={column.id} className={sizeClass}>
						<Skeleton className="h-4 w-full rounded" />
					</TableCell>
				))}
			</TableRow>
		));
	} else if (rows.length === 0) {
		body = (
			<FullRow span={columns.length}>
				<EmptyState {...empty} variant="plain" />
			</FullRow>
		);
	} else {
		body = rows.map((row) => (
			<TableRow
				key={row.id}
				data-state={row.getIsSelected() ? "selected" : undefined}
				className={cn(onRowClick && "cursor-pointer outline-none focus-visible:bg-fill1")}
				tabIndex={onRowClick ? 0 : undefined}
				onClick={onRowClick ? (e) => activate(row, e) : undefined}
				onKeyDown={onRowClick ? (e) => e.key === "Enter" && activate(row, e) : undefined}
			>
				{row.getVisibleCells().map((cell) => (
					<TableCell key={cell.id} className={cn(sizeClass, cell.column.columnDef.meta?.className)}>
						{flexRender(cell.column.columnDef.cell, cell.getContext())}
					</TableCell>
				))}
			</TableRow>
		));
	}

	return (
		// The table's own overflow wrapper is disabled so the ScrollArea viewport is the scroll
		// container (the sticky header needs that); scrollbars sit above the sticky header.
		<ScrollArea
			scrollbars="both"
			className={cn(
				"min-h-0 *:data-[slot=scroll-area-scrollbar]:z-20 **:data-[slot=table-wrapper]:overflow-visible",
				className,
			)}
		>
			<Table aria-busy={loading || undefined}>
				<TableHeader className="sticky top-0 z-10">
					{table.getHeaderGroups().map((group) => (
						<TableRow key={group.id}>
							{group.headers.map((header) => (
								<TableHead
									key={header.id}
									className={cn(sizeClass, header.column.columnDef.meta?.className)}
								>
									{header.isPlaceholder
										? null
										: flexRender(header.column.columnDef.header, header.getContext())}
								</TableHead>
							))}
						</TableRow>
					))}
				</TableHeader>
				<TableBody>{body}</TableBody>
			</Table>
		</ScrollArea>
	);
}

function FullRow({ span, children }: { span: number; children: ReactNode }) {
	return (
		<TableRow>
			<TableCell colSpan={span} className="p-0">
				{children}
			</TableCell>
		</TableRow>
	);
}
