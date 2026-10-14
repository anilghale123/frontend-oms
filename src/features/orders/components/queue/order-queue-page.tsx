"use client";

import { useState } from "react";
import type { PaginationState } from "@tanstack/react-table";
import { ClipboardList } from "lucide-react";
import { Page, PageBody } from "@/components/layout";
import { DataTableCard, useDataTable } from "@/components/data-display";
import { orderRoutes as orderRouteTitles } from "@/config/nav";
import { toErrorMessage } from "@/lib/api/errors";
import { ORDER_STATUS_LABELS } from "@/lib/domain";
import { useOrders } from "../../hooks/use-orders";
import { useOrderSearch } from "../../hooks/use-order-search";
import { createOrderColumns } from "./order-columns";
import { OrderStatusTabs, type OrderStatusFilter } from "./order-status-tabs";

const route = orderRouteTitles.orderQueue;
const columns = createOrderColumns();

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
 * The card fills the height left under the page header: the toolbar, the column headers and the
 * pagination stay put while the rows scroll between them. An order opens only from its row's
 * "More actions" menu (`OrderRowMenu`), not by clicking the row.
 */
export function OrderQueuePage({ placeholder = false }: OrderQueuePageProps) {
	const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
	const [search, setSearch] = useState("");
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
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
		// `min-h-0` down to the card, so it takes the height left in the frame and its rows scroll.
		<Page title={route.title} className="min-h-0">
			<PageBody className="min-h-0">
				<DataTableCard
					table={table}
					className="min-h-80 flex-1"
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
					pageSizes={[10, 20, 50, 100]}
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
		</Page>
	);
}
