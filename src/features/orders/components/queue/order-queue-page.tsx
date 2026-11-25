"use client";

import { useState } from "react";
import type { PaginationState } from "@tanstack/react-table";
import { ClipboardList } from "lucide-react";
import { PageBody } from "@/components/layout";
import { DataTableCard, useDataTable } from "@/components/data-display";
import { orderRoutes as orderRouteTitles } from "@/config/nav";
import { MAX_PAGE_SIZE } from "@/lib/api/contracts";
import { toErrorMessage } from "@/lib/api/errors";
import { ORDER_STATUS_LABELS } from "@/lib/domain";
import { useOrders } from "../../hooks/use-orders";
import { useOrderSearch } from "../../hooks/use-order-search";
import { createOrderColumns } from "./order-columns";
import { OrderStatusTabs, type OrderStatusFilter } from "./order-status-tabs";

const route = orderRouteTitles.orderQueue;
const columns = createOrderColumns();

/**
 * Items-per-page choices. The Sales API serves at most `MAX_PAGE_SIZE` (100) per page, so the
 * larger choices only appear once it serves them; offering them sooner would page wrongly.
 */
const PAGE_SIZES = [10, 25, 50, 100, 1000, 5000].filter((size) => size <= MAX_PAGE_SIZE);

export interface OrderQueuePageProps {
	/**
	 * Draws the queue's loading state without fetching. `OrderScreenSkeleton` shows it while OMS
	 * opens, so the queue that follows starts from the same picture.
	 */
	placeholder?: boolean;
}

/**
 * Merchant order queue (Meat-Management list pattern): a table card with status tabs and search.
 * Paging, the status filter and search all go to the Sales API, which returns newest first.
 *
 * The table fills the frame, so the pagination always sits at the bottom, however few rows there
 * are. With more rows than fit, the toolbar, the column headers and the pagination stay put while
 * only the rows scroll between them. An order opens only from its row's
 * "More actions" menu (`OrderRowMenu`), not by clicking the row.
 */
export function OrderQueuePage({ placeholder = false }: OrderQueuePageProps) {
	const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
	const [search, setSearch] = useState("");
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 10 });
	const q = useOrderSearch(search);

	const { data, isLoading, isError, error, refetch } = useOrders(
		{
			q,
			status: statusFilter === "all" ? undefined : statusFilter,
			page: pagination.pageIndex + 1,
			count: pagination.pageSize,
		},
		{ enabled: !placeholder },
	);

	// A new filter or search starts again from the first page.
	const firstPage = () => setPagination((current) => ({ ...current, pageIndex: 0 }));

	const table = useDataTable({
		data: data?.orders ?? [],
		columns,
		getRowId: (row) => row.referenceId,
		initialColumnVisibility: { referenceId: false },
		server: {
			rowCount: data?.total ?? 0,
			pagination,
			onPaginationChange: setPagination,
			globalFilter: search,
			onGlobalFilterChange: (value) => {
				setSearch(value);
				firstPage();
			},
		},
	});

	return (
		// `min-h-0` down to the card: it fills the frame and the rows scroll inside it.
		// Flat white page: the embed layout's gray and 16px padding are cancelled here, and the
		// content takes the listing's own 24px, under the layout's top bar.
		<div className="-m-4 flex min-h-0 flex-1 flex-col bg-bg">
			{/* The visible title is the embed layout's top bar; this keeps the screen's heading. */}
			<h1 className="sr-only">{route.title}</h1>
			<PageBody className="min-h-0 px-6">
				<DataTableCard
					className="min-h-0 flex-1 rounded-none border-0 bg-transparent"
					toolbarClassName="min-h-13.5 flex-row flex-wrap items-center justify-between border-b-0 px-0 py-3 xl:justify-between"
					headerClassName="h-10 bg-bg"
					// No row hover: the stripe stays put under the pointer.
					rowClassName="h-16 border-0 odd:bg-bg even:bg-row-alt odd:[&:has(td):hover]:bg-bg! even:[&:has(td):hover]:bg-row-alt!"
					table={table}
					searchPlaceholder="Search order ID, customer or product"
					toolbarLeading={
						<OrderStatusTabs
							value={statusFilter}
							onValueChange={(next) => {
								setStatusFilter(next);
								firstPage();
							}}
						/>
					}
					pageSizes={PAGE_SIZES}
					loading={placeholder || isLoading}
					// The placeholder is a picture of the queue loading, never of its last failure: while
					// OMS waits for a token, the cached query holds the 401 that started the wait.
					error={
						!placeholder && isError
							? { title: "Couldn’t load orders", description: toErrorMessage(error) }
							: null
					}
					onRetry={() => void refetch()}
					empty={{
						icon: ClipboardList,
						title: q
							? "No orders match your search"
							: statusFilter !== "all"
								? `No ${ORDER_STATUS_LABELS[statusFilter].toLowerCase()} orders`
								: "No orders yet",
						description:
							q || statusFilter !== "all"
								? "Try another status or search."
								: "Orders for this merchant will appear here.",
					}}
				/>
			</PageBody>
		</div>
	);
}
