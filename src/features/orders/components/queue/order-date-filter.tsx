"use client";

import { useState } from "react";
import { CalendarDays, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";
import { endOfDay, format, isSameDay, parseISO, startOfDay, subDays } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Divider } from "@/components/ui/divider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { Order } from "@/lib/domain";
import { DetailField } from "../detail-field";

type OrderDatePreset = "all" | "today" | "yesterday" | "last_7_days";

/** Order date filter: a preset, or a custom from–to range (both days inclusive). */
export type OrderDateRange =
	{ preset: OrderDatePreset } | { preset: "custom"; from: Date; to: Date };

export const ALL_ORDER_DATES: OrderDateRange = { preset: "all" };

const PRESETS: { value: OrderDatePreset; label: string }[] = [
	{ value: "all", label: "All dates" },
	{ value: "today", label: "Today" },
	{ value: "yesterday", label: "Yesterday" },
	{ value: "last_7_days", label: "Last 7 days" },
];

/** Start and end of the filter window, or `null` for all dates. */
function dateInterval(range: OrderDateRange, now = new Date()): { start: Date; end: Date } | null {
	switch (range.preset) {
		case "all":
			return null;
		case "today":
			return { start: startOfDay(now), end: endOfDay(now) };
		case "yesterday": {
			const day = subDays(now, 1);
			return { start: startOfDay(day), end: endOfDay(day) };
		}
		case "last_7_days":
			return { start: startOfDay(subDays(now, 6)), end: endOfDay(now) };
		case "custom":
			return { start: startOfDay(range.from), end: endOfDay(range.to) };
		default: {
			const exhaustive: never = range;
			return exhaustive;
		}
	}
}

/** Orders created inside the date filter window. */
export function filterOrdersByDate(orders: Order[], range: OrderDateRange): Order[] {
	const interval = dateInterval(range);
	if (!interval) return orders;
	const start = interval.start.getTime();
	const end = interval.end.getTime();
	return orders.filter((order) => {
		const created = parseISO(order.createdAt).getTime();
		return created >= start && created <= end;
	});
}

function rangeLabel(range: OrderDateRange): string {
	if (range.preset !== "custom") {
		return PRESETS.find((p) => p.value === range.preset)?.label ?? "All dates";
	}
	if (isSameDay(range.from, range.to)) return format(range.from, "dd MMM yyyy");
	return `${format(range.from, "dd MMM")} – ${format(range.to, "dd MMM yyyy")}`;
}

export interface OrderDateFilterProps {
	value: OrderDateRange;
	onValueChange: (value: OrderDateRange) => void;
}

/**
 * Filters the queue by order created date: quick presets (today, yesterday, last 7 days) on the
 * left, and a from–to range calendar on the right that applies on "Apply".
 */
export function OrderDateFilter({ value, onValueChange }: OrderDateFilterProps) {
	const [open, setOpen] = useState(false);
	const [draft, setDraft] = useState<DateRange | undefined>();

	function handleOpenChange(next: boolean) {
		if (next) setDraft(value.preset === "custom" ? { from: value.from, to: value.to } : undefined);
		setOpen(next);
	}

	function choose(next: OrderDateRange) {
		onValueChange(next);
		setOpen(false);
	}

	return (
		<Popover open={open} onOpenChange={handleOpenChange}>
			<PopoverTrigger asChild>
				<Button
					variant="outline"
					color="neutral"
					size="32"
					aria-label={`Filter by order date: ${rangeLabel(value)}`}
				>
					<CalendarDays aria-hidden />
					<span className="whitespace-nowrap">{rangeLabel(value)}</span>
					<ChevronDown aria-hidden />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="flex w-auto p-0">
				<div className="flex w-36 flex-col gap-1 p-2">
					{PRESETS.map((preset) => {
						const active = value.preset === preset.value;
						return (
							<Button
								key={preset.value}
								variant={active ? "soft" : "ghost"}
								color={active ? "primary" : "neutral"}
								size="32"
								className="justify-start"
								aria-pressed={active}
								onClick={() => choose({ preset: preset.value })}
							>
								{preset.label}
							</Button>
						);
					})}
				</div>
				<Divider orientation="vertical" />
				<div className="flex flex-col gap-3 p-3">
					<dl className="grid grid-cols-2 gap-3">
						<DetailField label="From">
							{draft?.from ? format(draft.from, "dd MMM yyyy") : "Pick a date"}
						</DetailField>
						<DetailField label="To">
							{draft?.to
								? format(draft.to, "dd MMM yyyy")
								: draft?.from
									? "Same day"
									: "Pick a date"}
						</DetailField>
					</dl>
					<Calendar
						mode="range"
						selected={draft}
						onSelect={setDraft}
						defaultMonth={draft?.from}
						className="border-0 p-0"
					/>
					<div className="flex justify-end gap-2">
						<Button
							variant="ghost"
							color="neutral"
							size="32"
							disabled={!draft?.from}
							onClick={() => setDraft(undefined)}
						>
							Clear
						</Button>
						<Button
							size="32"
							disabled={!draft?.from}
							onClick={() => {
								if (!draft?.from) return;
								choose({ preset: "custom", from: draft.from, to: draft.to ?? draft.from });
							}}
						>
							Apply
						</Button>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
