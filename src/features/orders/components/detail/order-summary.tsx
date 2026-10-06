import { Package } from "lucide-react";
import { Panel, PanelContent, PanelHeader, PanelTitle } from "@/components/layout";
import { Badge } from "@/components/ui/badge";
import { ORDER_CATEGORY_LABELS, type Order, type OrderItem } from "@/lib/domain";
import { formatOrderValue, formatRs } from "@/lib/utils";

export interface OrderSummaryProps {
	order: Order;
}

/**
 * Item card: the redeemed deal as the customer saw it in the Fonepoints app (photo, deal title,
 * price in Rs + points, struck-through market price), then what the customer paid.
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
					<DealRow
						key={`${item.name}-${index}`}
						item={item}
						category={ORDER_CATEGORY_LABELS[order.category]}
						price={single ? formatOrderValue(order) : null}
					/>
				))}
			</ul>
			<PanelContent className="gap-2 border-t border-border text-sm">
				<dl className="grid gap-2">
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-fg-secondary">Points redeemed</dt>
						<dd className="text-fg tabular-nums">
							{formatOrderValue({ ...order, cashAmount: 0 })}
						</dd>
					</div>
					<div className="flex items-baseline justify-between gap-3">
						<dt className="text-fg-secondary">Cash paid</dt>
						<dd className="text-fg tabular-nums">
							{order.cashAmount > 0 ? formatRs(order.cashAmount) : "None"}
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

function DealRow({
	item,
	category,
	price,
}: {
	item: OrderItem;
	category: string;
	/** Deal price, shown only when the order has a single deal (the total is per order). */
	price: string | null;
}) {
	return (
		<li className="flex gap-4 p-4">
			<div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-soft bg-fill1">
				{item.imageUrl ? (
					// Deal photos are remote Fonepoints assets; a plain img avoids image-optimiser config.
					// eslint-disable-next-line @next/next/no-img-element
					<img src={item.imageUrl} alt="" className="size-full object-contain" loading="lazy" />
				) : (
					<Package className="size-6 text-fg-tertiary" aria-hidden />
				)}
			</div>
			<div className="flex min-w-0 flex-1 flex-col gap-1.5">
				<p className="line-clamp-2 text-sm font-medium text-fg">{item.name}</p>
				<div className="flex flex-wrap items-center gap-2 text-xs text-fg-secondary">
					<Badge variant="soft" color="neutral" size="20">
						{category}
					</Badge>
					<span className="tabular-nums">Qty {item.quantity}</span>
				</div>
				{(price || item.marketPrice) && (
					<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
						{price && <span className="text-sm font-semibold text-fg tabular-nums">{price}</span>}
						{item.marketPrice && (
							<span className="text-xs text-fg-secondary">
								Market price{" "}
								<span className="text-fg-tertiary tabular-nums line-through">
									{formatRs(item.marketPrice)}
								</span>
							</span>
						)}
					</div>
				)}
			</div>
		</li>
	);
}
