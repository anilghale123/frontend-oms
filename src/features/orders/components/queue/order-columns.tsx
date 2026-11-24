"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-display";
import type { Order } from "@/lib/domain";
import { formatOrderValue, splitOrderDate } from "@/lib/utils";
import { CustomerCell } from "./customer-cell";
import { ItemCell } from "./item-cell";
import { OrderRowMenu } from "./order-row-menu";
import { OrderStatusAction } from "./order-status-action";
import { StatusBadge } from "../status-badge";

/** Cell padding: 8px all round (the table supplies the vertical 8px). */
const CELL = "px-2";

/**
 * Order queue columns. OMS Order ID, customer, status and actions always show; Partner order ID is
 * hidden by default. Search, filtering and paging are done by the API, so columns do not sort.
 */
export function createOrderColumns(): ColumnDef<Order, unknown>[] {
	return [
		{
			accessorKey: "omsOrderId",
			enableHiding: false,
			meta: { label: "Order ID", width: 108, className: CELL },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Order ID" />,
			cell: ({ row }) => (
				<span className="text-sm leading-5 font-bold whitespace-nowrap text-ink">
					{row.original.omsOrderId}
				</span>
			),
		},
		{
			id: "customer",
			accessorFn: (order) => order.customer.name || order.customer.contact,
			enableHiding: false,
			meta: { label: "Customer", width: 154, className: CELL },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
			cell: ({ row }) => <CustomerCell customer={row.original.customer} />,
		},
		{
			id: "product",
			accessorFn: (order) => order.items.map((item) => item.name).join(" "),
			meta: { label: "Items", width: 190, className: CELL },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Items" />,
			cell: ({ row }) => <ItemCell order={row.original} />,
		},
		{
			id: "value",
			accessorFn: (order) => formatOrderValue(order),
			meta: { label: "Value", width: 118, className: CELL },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Value" />,
			cell: ({ row }) => (
				<span className="text-sm leading-5 font-bold text-ink">
					{formatOrderValue(row.original)}
				</span>
			),
		},
		{
			id: "location",
			// The delivery address, one line. Service-only orders may have none.
			accessorFn: (order) => order.customer.deliveryAddress,
			meta: { label: "Location", width: 160, className: CELL },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
			cell: ({ getValue }) => {
				const address = getValue<string>();
				return address ? (
					<span className="line-clamp-2 text-sm leading-5 font-semibold text-ink" title={address}>
						{address}
					</span>
				) : (
					<span className="text-sm leading-5 font-semibold text-ink">—</span>
				);
			},
		},
		{
			accessorKey: "status",
			enableHiding: false,
			meta: { label: "Status", width: 128, className: CELL },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
			cell: ({ row }) => <StatusBadge status={row.original.status} />,
		},
		{
			accessorKey: "referenceId",
			meta: { label: "Partner order ID", className: CELL },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Partner order ID" />,
			cell: ({ row }) => (
				<span className="text-sm leading-5 font-semibold whitespace-nowrap text-ink">
					{row.original.referenceId}
				</span>
			),
		},
		{
			accessorKey: "created",
			meta: { label: "Order Date", width: 138, className: CELL },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Order Date" />,
			// Nepal time, formatted by the server; only rearranged here: date, then time beneath.
			cell: ({ row }) => {
				const { date, time } = splitOrderDate(row.original.created);
				return (
					<span className="text-sm leading-5 font-semibold text-ink">
						{date}
						{time && (
							<>
								,<br />
								{time}
							</>
						)}
					</span>
				);
			},
		},
		{
			id: "actions",
			enableSorting: false,
			enableHiding: false,
			meta: { label: "Actions", width: 200, className: CELL },
			header: () => (
				<span className="block text-center text-xs leading-4 font-extrabold text-ink">Actions</span>
			),
			// The status button centred, then "More actions" (View details) at the edge, so the menus
			// line up down the column. Rows are not clickable.
			cell: ({ row }) => (
				<div className="flex items-center gap-1">
					<div className="flex flex-1 justify-center">
						<OrderStatusAction order={row.original} />
					</div>
					<OrderRowMenu order={row.original} />
				</div>
			),
		},
	];
}
