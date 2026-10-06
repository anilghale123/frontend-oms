"use client";

import type { ColumnDef } from "@tanstack/react-table";
import { DataTableColumnHeader } from "@/components/data-display";
import { Badge } from "@/components/ui/badge";
import { ORDER_CATEGORY_LABELS, ORDER_STATUS_LABELS, type Order } from "@/lib/domain";
import { formatDateTime, formatOrderValue } from "@/lib/utils";
import { CustomerCell } from "./customer-cell";
import { ItemCell } from "./item-cell";
import { OrderStatusAction } from "./order-status-action";
import { StatusBadge } from "../status-badge";

/**
 * Order queue columns. OMS Order ID, customer, status and actions always show; the rest are
 * secondary and can be hidden from the "Columns" menu. `meta.export` drives CSV/Excel output.
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
			// Name + phone (formatted and digits-only) so search matches either; sorting follows the name.
			accessorFn: (order) =>
				`${order.customerName || order.customerPhone} ${order.customerPhone} ${order.customerPhone.replace(/\D/g, "")}`,
			enableHiding: false,
			meta: {
				label: "Customer",
				export: [
					{ label: "Customer", value: (order) => order.customerName },
					{ label: "Phone", value: (order) => order.customerPhone },
					{ label: "Email", value: (order) => order.customerEmail },
				],
			},
			header: ({ column }) => <DataTableColumnHeader column={column} title="Customer" />,
			cell: ({ row }) => <CustomerCell order={row.original} />,
		},
		{
			id: "product",
			// Deal titles joined so search matches any product; sorting follows the first.
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
			id: "category",
			accessorFn: (order) => ORDER_CATEGORY_LABELS[order.category],
			meta: { label: "Category" },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Category" />,
			cell: ({ row }) => (
				<Badge variant="soft" color="neutral" size="20" className="whitespace-nowrap">
					{ORDER_CATEGORY_LABELS[row.original.category]}
				</Badge>
			),
		},
		{
			accessorKey: "orderValue",
			meta: {
				label: "Value",
				export: [
					{ label: "Points", value: (order) => order.orderValue },
					{ label: "Cash (Rs)", value: (order) => order.cashAmount },
					{
						label: "Value type",
						value: (order) => (order.valueType === "points" ? "Points" : "Points + cash"),
					},
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
			// The delivery address as the customer typed it, from "Sanepa, Lalitpur" to
			// "House 82, Sanepa, Lalitpur, behind the ward office". Long ones clamp to two lines.
			accessorFn: (order) => order.delivery.address || order.location,
			meta: { label: "Location" },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Location" />,
			cell: ({ getValue }) => {
				const address = getValue<string>();
				return (
					<span className="line-clamp-2 max-w-xs min-w-40 text-fg-secondary" title={address}>
						{address}
					</span>
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
			filterFn: (row, _id, value: string) => row.original.status === value,
		},
		{
			accessorKey: "fonepointsReferenceId",
			meta: { label: "Reference" },
			header: ({ column }) => <DataTableColumnHeader column={column} title="Reference" />,
			cell: ({ row }) => (
				<span className="whitespace-nowrap text-fg-secondary">
					{row.original.fonepointsReferenceId}
				</span>
			),
		},
		{
			accessorKey: "createdAt",
			meta: {
				label: "Created",
				export: [{ label: "Created", value: (order) => formatDateTime(order.createdAt) }],
			},
			header: ({ column }) => <DataTableColumnHeader column={column} title="Created" />,
			cell: ({ row }) => (
				<span className="whitespace-nowrap text-fg-secondary tabular-nums">
					{formatDateTime(row.original.createdAt)}
				</span>
			),
		},
		{
			id: "actions",
			enableSorting: false,
			enableHiding: false,
			meta: { label: "Actions", className: "w-32", export: [] },
			header: () => <span className="block text-center">Actions</span>,
			cell: ({ row }) => (
				<div className="flex justify-center">
					<OrderStatusAction order={row.original} />
				</div>
			),
		},
	];
}
