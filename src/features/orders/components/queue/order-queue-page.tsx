"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClipboardList } from "lucide-react";
import { Page, PageBody } from "@/components/layout";
import {
	DataTableCard,
	// ExportMenu
	// tableToExport
	useDataTable,
} from "@/components/data-display";
import { merchantRoutes } from "@/config/nav";
// import { exportTable } from "@/lib/utils/export";
import { useOrderRoutes } from "../../order-routes";
import { useOrders } from "../../hooks/use-orders";
import { createOrderColumns } from "./order-columns";
import {
	ALL_ORDER_DATES,
	filterOrdersByDate,
	// OrderDateFilter,
	type OrderDateRange,
} from "./order-date-filter";
import { OrderStatusTabs, type OrderStatusFilter } from "./order-status-tabs";

const route = merchantRoutes.orderQueue;

/**
 * Merchant order queue (Meat-Management list pattern): a table card with status tabs and search.
 * The order date filter, show columns, export, row size and full screen are hidden for now.
 */
export function OrderQueuePage() {
	const router = useRouter();
	const orderRoutes = useOrderRoutes();
	const { data, isLoading, isError, refetch, isFetching } = useOrders();
	const [statusFilter, setStatusFilter] = useState<OrderStatusFilter>("all");
	// The date filter is hidden for now, so the range stays at "All dates".
	const [dateRange /* , setDateRange */] = useState<OrderDateRange>(ALL_ORDER_DATES);

	const orders = useMemo(() => data ?? [], [data]);
	// Status counts follow the date filter, so the tabs add up to what the table can show.
	const inDateRange = useMemo(() => filterOrdersByDate(orders, dateRange), [orders, dateRange]);
	const filtered = useMemo(
		() =>
			statusFilter === "all" ? inDateRange : inDateRange.filter((o) => o.status === statusFilter),
		[inDateRange, statusFilter],
	);
	const columns = useMemo(() => createOrderColumns(), []);

	const table = useDataTable({
		data: filtered,
		columns,
		getRowId: (row) => row.omsOrderId,
		pageSize: 20,
		initialSorting: [{ id: "createdAt", desc: true }],
		initialColumnVisibility: { category: false, fonepointsReferenceId: false },
	});
	// const exportCount = table.getPrePaginationRowModel().rows.length;
	const loading = isLoading || (isFetching && !data);

	return (
		<Page
			title={route.title}
			// Order count chip is hidden for now.
			// count={orders.length}
			// Export is hidden for now.
			// actions={
			// 	<ExportMenu
			// 		disabled={loading || isError || exportCount === 0}
			// 		summary={`${exportCount} ${exportCount === 1 ? "order" : "orders"}, visible columns`}
			// 		onExport={(format) =>
			// 			exportTable(tableToExport(table), format, `orders-${exportStamp()}`)
			// 		}
			// 	/>
			// }
		>
			<PageBody>
				<DataTableCard
					table={table}
					searchPlaceholder="Search order ID, customer or product"
					toolbarLeading={
						<OrderStatusTabs
							orders={inDateRange}
							value={statusFilter}
							onValueChange={setStatusFilter}
						/>
					}
					// Date filter and Show columns are hidden for now.
					// toolbarActions={<OrderDateFilter value={dateRange} onValueChange={setDateRange} />}
					// columnToggle
					pageSizes={[10, 20, 50, 100]}
					loading={loading}
					error={
						isError
							? {
									title: "Couldn’t load orders",
									description: "Check your connection and try again.",
								}
							: null
					}
					onRetry={() => void refetch()}
					empty={{
						icon: ClipboardList,
						title:
							statusFilter !== "all"
								? `No ${statusFilter.replaceAll("_", " ")} orders`
								: dateRange.preset !== "all"
									? "No orders in this date range"
									: "No orders yet",
						description:
							statusFilter === "all" && dateRange.preset === "all"
								? "Fonepoints orders for this merchant will appear here."
								: "Try another status tab, date or search.",
					}}
					onRowClick={(row) => router.push(orderRoutes.detail(row.omsOrderId))}
				/>
			</PageBody>
		</Page>
	);
}

// /** "2026-09-28" — date stamp for export file names. */
// function exportStamp() {
// 	return new Date().toISOString().slice(0, 10);
// }
