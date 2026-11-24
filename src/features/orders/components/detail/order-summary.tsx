import { Package } from "lucide-react";
import { Panel, PanelContent, PanelHeader, PanelHint, PanelTitle } from "@/components/layout";
import type { Order, OrderItem } from "@/lib/domain";
import { formatOrderValue, formatPoints, formatRs } from "@/lib/utils";

export interface OrderSummaryProps {
	order: Order;
}

/**
 * Items card: each ordered product (name, quantity, product ID, and when it was redeemed),
 * then what the customer paid — points, plus cash for `points_money` orders.
 */
export function OrderSummary({ order }: OrderSummaryProps) {
	const count = order.items.length;
	const single = count === 1;

	return (
		<Panel flush>
			<PanelHeader
				action={
					count > 1 && <span className="text-xs text-fg-secondary tabular-nums">{count} items</span>
				}
			>
				<PanelTitle className="text-2xl leading-8 font-normal tracking-normal text-ink">
					{single ? "Item" : "Items"}
				</PanelTitle>
			</PanelHeader>
			{count === 0 ? (
				<PanelContent>
					<PanelHint>No items on this order.</PanelHint>
				</PanelContent>
			) : (
				<ul className="divide-y divide-border">
					{order.items.map((item, index) => (
						<ItemRow key={`${item.productId}-${index}`} item={item} />
					))}
				</ul>
			)}
			<PanelContent className="gap-2 border-t border-border text-sm">
				<dl className="grid gap-2">
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-sm leading-5 font-semibold text-detail-text">Points redeemed</dt>
						<dd className="text-xs leading-4 font-normal text-detail-text">
							{order.points !== null ? formatPoints(order.points) : "None"}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-sm leading-5 font-semibold text-detail-text">Cash paid</dt>
						<dd className="text-xs leading-4 font-normal text-detail-text">
							{order.amount !== null && order.amount > 0 ? formatRs(order.amount) : "None"}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3 border-t border-border pt-2">
						<dt className="text-sm leading-5 font-semibold text-detail-text">Order value</dt>
						<dd className="text-sm leading-5 font-semibold text-detail-text">
							{formatOrderValue(order)}
						</dd>
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
				{item.name ? (
					<p className="line-clamp-2 text-sm leading-5 font-semibold text-ink">{item.name}</p>
				) : (
					<p className="text-sm leading-5 font-semibold text-fg-tertiary">Unnamed item</p>
				)}
				<div className="flex flex-wrap items-center gap-2 text-xs leading-4 font-normal text-detail-text">
					<span>
						Qty {item.quantity}
						{item.unitName && ` ${item.unitName}`}
					</span>
					{item.productId && <span>{item.productId}</span>}
				</div>
				{/* Nepal time, formatted by the server; shown as it is. */}
				{item.redeemedDate && (
					<p className="text-xs leading-4 font-normal text-detail-text">
						Redeemed {item.redeemedDate}
					</p>
				)}
			</div>
		</li>
	);
}
