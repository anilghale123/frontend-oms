import { Suspense } from "react";
import type { Metadata } from "next";
import { Page, PageBody } from "@/components/layout";
import { documentTitle, riderRoutes } from "@/config/nav";
import { DeliveryValidationForm } from "@/features/delivery-validation";

const route = riderRoutes.deliver;

export const metadata: Metadata = { title: documentTitle(route) };

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
