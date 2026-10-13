import type { Metadata } from "next";
import { OrderQueuePage } from "@/features/orders";
import { documentTitle, orderRoutes } from "@/config/nav";

const route = orderRoutes.orderQueue;

export const metadata: Metadata = { title: documentTitle(route) };

/** Order Queue, embedded in the Fonepoints Business portal. The portal supplies the chrome. */
export default function EmbeddedOrdersPage() {
	return <OrderQueuePage />;
}
