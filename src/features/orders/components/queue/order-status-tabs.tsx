"use client";

import { OFFERED_STATUSES, ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain";
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

/** All, then each status the screens offer (Delivering is off for now: `DELIVERING_ENABLED`). */
export const ORDER_STATUS_FILTERS: OrderStatusFilter[] = [ALL, ...OFFERED_STATUSES];

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
				<SelectTrigger
					size="32"
					className="w-full text-xs leading-4 font-semibold text-ink-muted sm:hidden"
					aria-label="Filter by status"
				>
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
				size="28"
				spacing={2}
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
						className="rounded-none border-line px-2.5 text-xs leading-4 font-semibold text-ink-muted first:rounded-none last:rounded-none hover:bg-primary-accent focus-visible:ring-0 focus-visible:ring-offset-0 focus-visible:outline-1 focus-visible:outline-offset-3 focus-visible:outline-btn-primary focus-visible:outline-solid data-[state=on]:border-btn-primary data-[state=on]:bg-btn-primary data-[state=on]:text-btn-primary-fg data-[state=on]:hover:border-btn-primary-hover data-[state=on]:hover:bg-btn-primary-hover"
					>
						{option === ALL ? "All" : ORDER_STATUS_LABELS[option]}
					</ToggleGroupItem>
				))}
			</ToggleGroup>
		</>
	);
}
