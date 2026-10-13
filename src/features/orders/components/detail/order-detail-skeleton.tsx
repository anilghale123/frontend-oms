"use client";

import { useParams } from "next/navigation";
import { OrderDetailPage } from "./order-detail-page";

/**
 * The order detail page in its loading state, for the order in the URL. The detail route's
 * `loading.tsx` shows it the moment the merchant opens an order, so the click is answered at once
 * instead of the queue staying on screen until the page arrives.
 *
 * Like `OrderScreenSkeleton`, it *is* the detail page, in `placeholder` mode (no request, loading
 * state forced), so it matches the page's own loading state exactly and the swap moves nothing.
 */
export function OrderDetailSkeleton() {
	const params = useParams<{ referenceId?: string }>();
	return (
		<OrderDetailPage
			referenceId={params.referenceId ? decodeURIComponent(params.referenceId) : ""}
			placeholder
		/>
	);
}
