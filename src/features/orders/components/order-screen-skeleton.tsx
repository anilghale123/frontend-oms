"use client";

import { useParams } from "next/navigation";
import { OrderDetailLayout, OrderDetailPage } from "./detail/order-detail-page";
import { OrderQueuePage } from "./queue/order-queue-page";

/**
 * The order screen being opened, drawn in its loading state before there is a session to fetch
 * with. `SessionGate` shows it while OMS opens, instead of a spinner.
 *
 * It is not a copy of the screens' skeletons: it *is* the screens, in `placeholder` mode (no
 * request, loading state forced). So when the session settles and the real screen mounts in its
 * own loading state, nothing moves — the same header, toolbar, column headers and skeleton rows
 * stay where they are, and only the data arrives. A hand-drawn skeleton would drift from the real
 * one with the next layout change, and the swap would jump.
 *
 * The Fonepoints portal draws the queue's version of this while the iframe loads
 * (`fonepoints-business`, `oms-page.ts`), measured against this one; keep the two in step.
 *
 * Inert: it looks like the screen but is only a picture of it, so nothing in it can be focused,
 * typed into or clicked (whatever was typed would be lost when the real screen replaces it).
 */
export function OrderScreenSkeleton() {
	const params = useParams<{ referenceId?: string }>();
	const referenceId = params.referenceId ? decodeURIComponent(params.referenceId) : null;

	return (
		<div inert className="flex flex-1 flex-col">
			{referenceId ? (
				<OrderDetailLayout placeholder>
					<OrderDetailPage referenceId={referenceId} placeholder />
				</OrderDetailLayout>
			) : (
				<OrderQueuePage placeholder />
			)}
		</div>
	);
}
