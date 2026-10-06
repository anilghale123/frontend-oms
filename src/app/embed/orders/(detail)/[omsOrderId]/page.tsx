import type { Metadata } from "next";
import { OrderDetailPage } from "@/features/orders";
import { documentTitle, merchantRoutes } from "@/config/nav";

const route = merchantRoutes.orderDetail;

export const metadata: Metadata = { title: documentTitle(route) };

export default async function EmbeddedOrderDetailPage(
	props: PageProps<"/embed/orders/[omsOrderId]">,
) {
	const { omsOrderId } = await props.params;
	return <OrderDetailPage omsOrderId={omsOrderId} />;
}
