import type { ReactNode } from "react";
import { OrderDetailLayout } from "@/features/orders";

/** Keeps the order list mounted while the merchant moves between orders. */
export default function MerchantOrderDetailLayout({ children }: { children: ReactNode }) {
	return <OrderDetailLayout>{children}</OrderDetailLayout>;
}
