import type { Metadata } from "next";
import { OrderQueuePage } from "@/features/orders";
import { documentTitle, merchantRoutes } from "@/config/nav";

const route = merchantRoutes.orderQueue;

export const metadata: Metadata = { title: documentTitle(route) };

export default function MerchantOrdersPage() {
	return <OrderQueuePage />;
}
