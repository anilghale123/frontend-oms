import { Suspense } from "react";
import type { Metadata } from "next";
import { Page, PageBody } from "@/components/layout";
import { documentTitle, riderRoutes } from "@/config/nav";
import { DeliveryValidationForm } from "@/features/delivery-validation";

const route = riderRoutes.deliver;

export const metadata: Metadata = { title: documentTitle(route) };

/**
 * The rider's delivery confirmation. No sign-in: the Order ID and the customer's voucher code are
 * the credential, checked by the Sales service. `/deliver?order=OMS-0427` prefills the Order ID.
 */
export default function DeliverPage() {
	return (
		<Page title={route.title}>
			<PageBody>
				{/* Suspense: the form reads `?order=` to prefill the Order ID. */}
				<Suspense>
					<DeliveryValidationForm />
				</Suspense>
			</PageBody>
		</Page>
	);
}
