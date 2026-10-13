import { OrderDetailSkeleton } from "@/features/orders";

/**
 * Shown the moment the merchant opens an order (Next prefetches it), while the detail page loads:
 * the page's own loading state, so the queue never sits on screen after the click.
 */
export default function OrderDetailLoading() {
	return <OrderDetailSkeleton />;
}
