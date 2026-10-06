import type { Metadata } from "next";
import { OrderQueuePage } from "@/features/orders";
import { documentTitle, merchantRoutes } from "@/config/nav";

const route = merchantRoutes.orderQueue;

export const metadata: Metadata = { title: documentTitle(route) };

/** Order Queue as embedded in the Fonepoints Business portal. Same screen, no OMS chrome. */
export default function EmbeddedOrdersPage() {
	return <OrderQueuePage />;
}
