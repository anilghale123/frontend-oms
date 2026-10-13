"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PaginationState } from "@tanstack/react-table";
import { ClipboardList } from "lucide-react";
import { Page, PageBody } from "@/components/layout";
import { DataTableCard, useDataTable } from "@/components/data-display";
import { orderRoutes as orderRouteTitles } from "@/config/nav";
import { toErrorMessage } from "@/lib/api/errors";
import { ORDER_STATUS_LABELS } from "@/lib/domain";
import { useOrderRoutes } from "../../order-routes";
import { useOrders } from "../../hooks/use-orders";
import { useOrderSearch } from "../../hooks/use-order-search";
import { createOrderColumns } from "./order-columns";
import { OrderStatusTabs, type OrderStatusFilter } from "./order-status-tabs";

const route = orderRouteTitles.orderQueue;
const columns = createOrderColumns();

/**
 * Merchant order queue (Meat-Management list pattern): a table card with status tabs and search.
 * Paging, the status filter and search all go to the Sales API, which returns newest first.
 */
export function OrderQueuePage() {
	const router = useRouter();
	const orderRoutes = useOrderRoutes();
	const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
	const [search, setSearch] = useState("");
	const [pagination, setPagination] = useState<PaginationState>({ pageIndex: 0, pageSize: 20 });
	const q = useOrderSearch(search);

	const { data, isLoading, isError, error, refetch } = useOrders({
		q,
		status: statusFilter === "all" ? undefined : statusFilter,
		page: pagination.pageIndex + 1,
		count: pagination.pageSize,
	});

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
		<Page title={route.title}>
			<PageBody>
				<DataTableCard
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
					pageSizes={[10, 20, 50, 100]}
					loading={isLoading}
					error={
						isError ? { title: "Couldn’t load orders", description: toErrorMessage(error) } : null
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
					onRowClick={(row) => router.push(orderRoutes.detail(row.referenceId))}
				/>
			</PageBody>
		</Page>
	);
}
