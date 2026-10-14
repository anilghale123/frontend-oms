"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-display";
import { ORDER_STATUS_LABELS, type Order } from "@/lib/domain";
import { formatOrderValue } from "@/lib/utils";
import { CustomerCell } from "./customer-cell";
import { ItemCell } from "./item-cell";
import { OrderRowMenu } from "./order-row-menu";
import { OrderStatusAction } from "./order-status-action";
import { StatusBadge } from "../status-badge";

/**
 * Order queue columns. OMS Order ID, customer, status and actions always show; Partner order ID is
 * hidden by default. Search, filtering and paging are done by the API, so columns do not sort.
 * `meta.export` drives CSV/Excel output.
 */
export function createOrderColumns(): ColumnDef<Order, unknown>[] {
	return [
		{
			accessorKey: "omsOrderId",
			enableHiding: false,
			meta: { label: "OMS Order ID" },
			header: ({ column }) => <DataTableColumnHeader column={column} title="OMS Order ID" />,
			cell: ({ row }) => (
				<span className="font-medium whitespace-nowrap text-fg">{row.original.omsOrderId}</span>
			),
		},
		{
			id: "customer",
			accessorFn: (order) => order.customer.name || order.customer.contact,
			enableHiding: false,
			meta: {
				label: "Customer",
				export: [
					{ label: "Customer", value: (order) => order.customer.name },
					{ label: "Phone", value: (order) => order.customer.contact },
					{ label: "Customer ID", value: (order) => order.customer.identifier },
				],
			},
			header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
			cell: ({ row }) => <CustomerCell customer={row.original.customer} />,
		},
		{
			id: "product",
			accessorFn: (order) => order.items.map((item) => item.name).join(" "),
			meta: {
				label: "Product",
				export: [
					{
						label: "Product",
						value: (order) =>
							order.items.map((item) => `${item.name} x${item.quantity}`).join("; "),
					},
				],
			},
			header: ({ column }) => <DataTableColumnHeader column={column} title="Product" />,
			cell: ({ row }) => <ItemCell order={row.original} />,
		},
		{
			id: "value",
			accessorFn: (order) => formatOrderValue(order),
			meta: {
				label: "Value",
				export: [
					{ label: "Points", value: (order) => order.points },
					{ label: "Cash (Rs)", value: (order) => order.amount },
				],
			},
			header: ({ column }) => <DataTableColumnHeader column={column} title="Value" />,
			cell: ({ row }) => (
				<span className="whitespace-nowrap text-fg tabular-nums">
					{formatOrderValue(row.original)}
				</span>
			),
		},
		{
			id: "location",
			// The delivery address, one line. Service-only orders may have none.
			accessorFn: (order) => order.customer.deliveryAddress,
			meta: { label: "Location" },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
			cell: ({ getValue }) => {
				const address = getValue<string>();
				return address ? (
					<span className="line-clamp-2 max-w-xs min-w-40 text-fg-secondary" title={address}>
						{address}
					</span>
				) : (
					<span className="text-fg-tertiary">—</span>
				);
			},
		},
		{
			accessorKey: "status",
			enableHiding: false,
			meta: {
				label: "Status",
				export: [{ label: "Status", value: (order) => ORDER_STATUS_LABELS[order.status] }],
			},
			header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
			cell: ({ row }) => <StatusBadge status={row.original.status} />,
		},
		{
			accessorKey: "referenceId",
			meta: { label: "Partner order ID" },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Partner order ID" />,
			cell: ({ row }) => (
				<span className="whitespace-nowrap text-fg-secondary">{row.original.referenceId}</span>
			),
		},
		{
			accessorKey: "created",
			meta: { label: "Created" },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
			// Nepal time, formatted by the server; shown as it is.
			cell: ({ row }) => (
				<span className="whitespace-nowrap text-fg-secondary tabular-nums">
					{row.original.created}
				</span>
			),
		},
		{
			id: "actions",
			enableSorting: false,
			enableHiding: false,
			meta: { label: "Actions", className: "w-32", export: [] },
			header: () => <span className="block text-center">Actions</span>,
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
