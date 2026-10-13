import { Package } from "lucide-react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import type { Order, OrderItem } from "@/lib/domain";
import { formatOrderValue, formatPoints, formatRs } from "@/lib/utils";

export interface OrderSummaryProps {
	order: Order;
}

const PRODUCT_TYPE_LABELS: Record<OrderItem["productType"], string> = {
	goods: "Goods",
	service: "Service",
};

/**
 * Items card: each ordered product (name, type, quantity, product ID), then what the customer
 * paid — points, plus cash for `points_money` orders.
 */
export function OrderSummary({ order }: OrderSummaryProps) {
	const single = order.items.length === 1;

	return (
		<Panel flush>
			<PanelHeader
				action={
					!single && (
						<span className="text-xs text-fg-secondary tabular-nums">
							{order.items.length} items
						</span>
					)
				}
			>
				<PanelTitle>{single ? "Item" : "Items"}</PanelTitle>
			</PanelHeader>
			<ul className="divide-y divide-border">
				{order.items.map((item, index) => (
					<ItemRow key={`${item.productId}-${index}`} item={item} />
				))}
			</ul>
			<PanelContent className="gap-2 border-t border-border text-sm">
				<dl className="grid gap-2">
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-fg-secondary">Points redeemed</dt>
						<dd className="text-fg tabular-nums">
							{order.points !== null ? formatPoints(order.points) : "None"}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-fg-secondary">Cash paid</dt>
						<dd className="text-fg tabular-nums">
							{order.amount !== null && order.amount > 0 ? formatRs(order.amount) : "None"}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
						<dt className="font-medium text-fg">Order value</dt>
						<dd className="font-semibold text-fg tabular-nums">{formatOrderValue(order)}</dd>
					</div>
				</dl>
			</PanelContent>
		</Panel>
	);
}

function ItemRow({ item }: { item: OrderItem }) {
	return (
		<li className="flex gap-4 p-4">
			<div className="flex size-14 shrink-0 items-center justify-center rounded-lg border border-soft bg-fill1">
				<Package className="size-6 text-fg-tertiary" aria-hidden />
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<p className="line-clamp-2 text-sm font-medium text-fg">{item.name}</p>
				<div className="flex flex-wrap items-center gap-2 text-xs text-fg-secondary">
					<Badge variant="soft" color="neutral" size="20">
						{PRODUCT_TYPE_LABELS[item.productType]}
					</Badge>
					<span className="tabular-nums">
						Qty {item.quantity}
						{item.unitName && ` ${item.unitName}`}
					</span>
					{item.productId && <span className="tabular-nums">{item.productId}</span>}
				</div>
			</div>
		</li>
	);
}
