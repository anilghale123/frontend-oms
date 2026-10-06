"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, List, Search } from "lucide-react";
import { Button, IconButton } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input, InputWrapper } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

import { ORDER_STATUS_LABELS, ORDER_STATUS_SEQUENCE, type Order } from "@/lib/domain";
import { cn, formatOrderValue } from "@/lib/utils";
import { useOrderRoutes } from "../../order-routes";
import { useOrders } from "../../hooks/use-orders";
import type { OrderStatusFilter } from "../queue/order-status-tabs";
import { StatusBadge } from "../status-badge";

// Failed filter hidden for now: ["all", ...ORDER_STATUS_SEQUENCE, "failed"]
// Delivering filter hidden for now: drop the `.filter` to show it again.
const FILTERS: OrderStatusFilter[] = [
	"all",
	...ORDER_STATUS_SEQUENCE.filter((status) => status !== "delivering"),
];

function filterLabel(filter: OrderStatusFilter) {
	return filter === "all" ? "All orders" : ORDER_STATUS_LABELS[filter];
}

export interface OrderListPanelProps {
	/** OMS Order ID open in the detail pane; its row is highlighted and scrolled into view. */
	selectedId: string;
	className?: string;
}

/**
 * Order list beside the order detail (Multibranch product list panel): status filter, search,
 * newest-first rows, and a count footer. Clicking a row opens that order without leaving the list.
 */
export function OrderListPanel({ selectedId, className }: OrderListPanelProps) {
	const orderRoutes = useOrderRoutes();
	const { data, isLoading, isError, refetch } = useOrders();
	const [filter, setFilter] = useState<OrderStatusFilter>("all");
	const [query, setQuery] = useState("");
	const selectedRowRef = useRef<HTMLAnchorElement | null>(null);

	const orders = useMemo(
		() => [...(data ?? [])].sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
		[data],
	);
	const counts = useMemo(() => countByFilter(orders), [orders]);
	const visible = useMemo(() => {
		const needle = query.trim().toLowerCase();
		return orders.filter((order) => {
			if (filter !== "all" && order.status !== filter) return false;
			if (!needle) return true;
			return [
				order.omsOrderId,
				order.customerName,
				order.customerPhone,
				order.customerPhone.replace(/\D/g, ""),
				...order.items.map((item) => item.name),
			].some((value) => value.toLowerCase().includes(needle));
		});
	}, [orders, filter, query]);

	useEffect(() => {
		selectedRowRef.current?.scrollIntoView({ block: "nearest" });
	}, [selectedId, data]);

	return (
		<aside
			aria-label="Orders"
			className={cn("w-72 shrink-0 flex-col border-r border-border bg-bg xl:w-80", className)}
		>
			<div className="flex shrink-0 flex-col gap-2 border-b border-border px-3 py-2.5">
				<div className="flex items-center gap-1.5">
					<DropdownMenu>
						<DropdownMenuTrigger asChild>
							<Button
								variant="ghost"
								color="neutral"
								size="32"
								className="min-w-0 flex-1 justify-start font-semibold"
							>
								<span className="truncate">{filterLabel(filter)}</span>
								<ChevronDown aria-hidden />
							</Button>
						</DropdownMenuTrigger>
						<DropdownMenuContent align="start" className="w-56">
							<DropdownMenuRadioGroup
								value={filter}
								onValueChange={(next) => setFilter(next as OrderStatusFilter)}
							>
								{FILTERS.map((option) => (
									<DropdownMenuRadioItem key={option} value={option}>
										<span className="flex-1">{filterLabel(option)}</span>
										<span className="text-fg-tertiary tabular-nums">{counts[option]}</span>
									</DropdownMenuRadioItem>
								))}
							</DropdownMenuRadioGroup>
						</DropdownMenuContent>
					</DropdownMenu>
					<IconButton
						variant="outline"
						color="neutral"
						size="32"
						aria-label="Open full list"
						asChild
					>
						<Link href={orderRoutes.queue}>
							<List />
						</Link>
					</IconButton>
				</div>
				<InputWrapper size="32">
					<Search aria-hidden />
					<Input
						type="search"
						placeholder="Search ID, customer or product"
						aria-label="Search orders"
						value={query}
						onChange={(event) => setQuery(event.target.value)}
					/>
				</InputWrapper>
			</div>

			<ScrollArea className="min-h-0 flex-1">
				{isLoading ? (
					<div className="flex flex-col gap-2 p-3">
						{Array.from({ length: 8 }, (_, i) => (
							<Skeleton key={i} className="h-12 w-full rounded-md" />
						))}
					</div>
				) : isError ? (
					<div className="flex flex-col items-center gap-2 px-4 py-10 text-center text-sm text-fg-secondary">
						Couldn’t load orders.
						<Button variant="outline" color="neutral" size="28" onClick={() => void refetch()}>
							Try again
						</Button>
					</div>
				) : visible.length === 0 ? (
					<p className="px-4 py-10 text-center text-sm text-fg-secondary">
						No orders match this filter.
					</p>
				) : (
					<ul className="divide-y divide-border">
						{visible.map((order) => (
							<OrderListRow
								key={order.omsOrderId}
								order={order}
								active={order.omsOrderId === selectedId}
								rowRef={order.omsOrderId === selectedId ? selectedRowRef : undefined}
							/>
						))}
					</ul>
				)}
			</ScrollArea>

			<div className="shrink-0 border-t border-border px-3 py-2 text-xs text-fg-secondary tabular-nums">
				{visible.length} of {orders.length} orders
			</div>
		</aside>
	);
}

function OrderListRow({
	order,
	active,
	rowRef,
}: {
	order: Order;
	active: boolean;
	rowRef?: React.Ref<HTMLAnchorElement>;
}) {
	const orderRoutes = useOrderRoutes();
	return (
		<li>
			<Link
				ref={rowRef}
				href={orderRoutes.detail(order.omsOrderId)}
				aria-current={active ? "page" : undefined}
				className={cn(
					"flex flex-col gap-1 border-l-2 px-3 py-2.5 outline-none focus-visible:bg-fill1-alpha",
					active ? "border-primary bg-primary-accent" : "border-transparent hover:bg-fill1-alpha",
				)}
			>
				<span className="flex items-baseline justify-between gap-2">
					<span
						className={cn("truncate text-sm text-fg", active ? "font-semibold" : "font-medium")}
					>
						{order.omsOrderId}
					</span>
					<span className="shrink-0 text-xs text-fg-secondary tabular-nums">
						{formatOrderValue(order)}
					</span>
				</span>
				<span className="flex items-center justify-between gap-2">
					<span className="truncate text-xs text-fg-secondary">
						{order.customerName.trim() || order.customerPhone}
					</span>
					<StatusBadge status={order.status} className="shrink-0" />
				</span>
			</Link>
		</li>
	);
}

function countByFilter(orders: Order[]): Record<OrderStatusFilter, number> {
	const counts: Record<OrderStatusFilter, number> = {
		all: orders.length,
		preparing: 0,
		ready_for_delivery: 0,
		delivering: 0,
		delivered: 0,
		failed: 0,
	};
	for (const order of orders) counts[order.status] += 1;
	return counts;
}
