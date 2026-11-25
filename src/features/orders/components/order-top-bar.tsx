"use client";

import { useParams } from "next/navigation";
import { TopBar } from "@/components/layout";
import { orderRoutes as orderRouteTitles } from "@/config/nav";
import { useOrderRoutes } from "../order-routes";

const TITLE = orderRouteTitles.orderQueue.title;

/**
 * The "Order Management" bar across the top of the order screens. On an order it starts with a
 * back arrow to the queue; on the queue it is the title alone.
 */
export function OrderTopBar() {
	const routes = useOrderRoutes();
	const { referenceId } = useParams<{ referenceId?: string }>();
	return (
		<TopBar
			title={TITLE}
			back={referenceId ? { href: routes.queue, label: `Back to ${TITLE}` } : undefined}
		/>
	);
}
