"use client";

import { ORDER_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain";
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

/** All, then each status the API can filter by. */
export const ORDER_STATUS_FILTERS: OrderStatusFilter[] = [ALL, ...ORDER_STATUSES];

export interface OrderStatusTabsProps {
	value: OrderStatusFilter;
	onValueChange: (value: OrderStatusFilter) => void;
}

/**
 * Status filter (Multibranch list pattern): a joined outline button row, active option in solid
 * primary. Built on Radian `ToggleGroup` (single select). Below `sm` the row doesn't fit, so the
 * same options render as a full-width Radian `Select` instead. No counts: the API reports only the
 * total for the current filter.
 */
export function OrderStatusTabs({ value, onValueChange }: OrderStatusTabsProps) {
	return (
		<>
			{/* Phones: the joined button row doesn't fit, so the same options become a select. */}
			<Select value={value} onValueChange={(next) => onValueChange(next as OrderStatusFilter)}>
				<SelectTrigger size="32" className="w-full sm:hidden" aria-label="Filter by status">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{ORDER_STATUS_FILTERS.map((option) => (
						<SelectItem key={option} value={option}>
							{option === ALL ? "All statuses" : ORDER_STATUS_LABELS[option]}
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
				{ORDER_STATUS_FILTERS.map((option) => (
					<ToggleGroupItem
						key={option}
						value={option}
						className="data-[state=on]:border-primary data-[state=on]:bg-primary data-[state=on]:text-primary-fg data-[state=on]:hover:bg-primary-hover"
					>
						{option === ALL ? "All" : ORDER_STATUS_LABELS[option]}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</>
	);
}
