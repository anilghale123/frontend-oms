// import { Package } from "lucide-react"; // the product image/icon tile is hidden for now — see below
import type { Order } from "@/lib/domain";

export interface ItemCellProps {
	order: Pick<Order, "items">;
}

/**
 * Ordered product: name only (up to two lines; full name on hover). Orders with more than one
 * item show the first and "+N more" below it. The Sales API sends no product photos.
 *
 * The icon tile that used to sit before the name is commented out for now (listing page should
 * not show a product image placeholder). Uncomment the `Package` import above and the tile below
 * to bring it back.
 */
export function ItemCell({ order }: ItemCellProps) {
	const [first, ...rest] = order.items;
	if (!first) return <span className="text-fg-tertiary">—</span>;

	return (
		<div className="flex max-w-xs min-w-0 items-center gap-2.5">
			{/* <div className="flex size-8 shrink-0 items-center justify-center rounded-md border border-soft bg-fill1">
				<Package className="size-4 text-fg-tertiary" aria-hidden />
			</div> */}
			<div className="flex min-w-0 flex-col">
				<span className="line-clamp-2 font-medium text-fg" title={first.name}>
					{first.name}
				</span>
				{rest.length > 0 && (
					<span className="text-xs text-fg-secondary tabular-nums">+{rest.length} more</span>
				)}
			</div>
		</div>
	);
}
