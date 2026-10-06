"use client";

import {
	ORDER_STATUS_LABELS,
	ORDER_STATUS_SEQUENCE,
	type Order,
	type OrderStatus,
} from "@/lib/domain";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

const ALL = "all";

export type OrderStatusFilter = OrderStatus | typeof ALL;

export interface OrderStatusTabsProps {
	orders: Order[];
	value: OrderStatusFilter;
	onValueChange: (value: OrderStatusFilter) => void;
}

/**
 * Status filter with per-status counts (Multibranch list pattern): a joined outline button row,
 * active option in solid primary. Built on Radian `ToggleGroup` (single select). Below `sm` the
 * row doesn't fit, so the same options render as a full-width Radian `Select` instead.
 */
export function OrderStatusTabs({ orders, value, onValueChange }: OrderStatusTabsProps) {
	const counts = countByStatus(orders);
	const options: { value: OrderStatusFilter; label: string; count: number }[] = [
		{ value: ALL, label: "All", count: orders.length },
		// Failed tab hidden for now: ...[...ORDER_STATUS_SEQUENCE, "failed" as const]
		// Delivering tab hidden for now: drop the filter to show it again.
		...ORDER_STATUS_SEQUENCE.filter((status) => status !== "delivering").map((status) => ({
			value: status,
			label: ORDER_STATUS_LABELS[status],
			count: counts[status],
		})),
	];

	return (
		<>
			{/* Phones: the joined button row doesn't fit, so the same options become a select. */}
			<Select value={value} onValueChange={(next) => onValueChange(next as OrderStatusFilter)}>
				<SelectTrigger size="32" className="w-full sm:hidden" aria-label="Filter by status">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.value === ALL ? "All statuses" : option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
			<ToggleGroup
				type="single"
				variant="outline"
				size="32"
				aria-label="Filter by status"
				className="hidden sm:flex"
				value={value}
				onValueChange={(next) => {
					// Single toggle groups emit "" when the active item is clicked again; keep a selection.
					if (next) onValueChange(next as OrderStatusFilter);
				}}
			>
				{options.map((option) => (
					<ToggleGroupItem
						key={option.value}
						value={option.value}
						className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-fg data-[state=on]:hover:bg-primary-hover"
					>
						{option.label}
						{/* Counts hidden for now.
					<span className="text-fg-tertiary tabular-nums group-data-[state=on]/toggle:text-primary-fg">
						{option.count}
					</span> */}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</>
	);
}

function countByStatus(orders: Order[]): Record<OrderStatus, number> {
	const counts: Record<OrderStatus, number> = {
		preparing: 0,
		ready_for_delivery: 0,
		delivering: 0,
		delivered: 0,
		failed: 0,
	};
	for (const order of orders) {
		counts[order.status] += 1;
	}
	return counts;
}
