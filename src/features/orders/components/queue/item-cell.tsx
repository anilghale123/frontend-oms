import { Package } from "lucide-react";
import type { Order } from "@/lib/domain";

export interface ItemCellProps {
	order: Pick<Order, "items">;
}

/**
 * Ordered product: a 32px tile and the name (up to two lines; full name on hover). Orders with
 * more than one item show the first and "+N more" below it. The Sales API sends no product photos,
 * so the tile always holds the package icon.
 */
export function ItemCell({ order }: ItemCellProps) {
	const [first, ...rest] = order.items;
	if (!first) return <span className="text-sm leading-5 font-semibold text-ink">—</span>;

	return (
		<div className="flex min-w-0 items-center gap-2">
			<div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-thumb-border bg-thumb">
				<Package className="size-4 text-ink-secondary" aria-hidden />
			</div>
			<div className="flex min-w-0 flex-col">
				<span className="line-clamp-2 text-sm leading-5 font-semibold text-ink" title={first.name}>
					{first.name}
				</span>
				{rest.length > 0 && (
					<span className="text-sm leading-5 font-semibold text-ink">+{rest.length} more</span>
				)}
			</div>
		</div>
	);
}
