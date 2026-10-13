import type { Metadata } from "next";
import { OrderDetailPage } from "@/features/orders";
import { documentTitle, orderRoutes } from "@/config/nav";

const route = orderRoutes.orderDetail;

export const metadata: Metadata = { title: documentTitle(route) };

/** One order, by the partner's `reference_id` — the key every order endpoint takes. */
export default async function EmbeddedOrderDetailPage(
	props: PageProps<"/embed/orders/[referenceId]">,
) {
	const { referenceId } = await props.params;
	return <OrderDetailPage referenceId={referenceId} />;
}
