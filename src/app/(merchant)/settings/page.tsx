import type { Metadata } from "next";
import { Page, PageBody } from "@/components/layout";
import { EmptyState } from "@/components/feedback";
import { documentTitle, merchantRoutes } from "@/config/nav";

const route = merchantRoutes.settings;

export const metadata: Metadata = { title: documentTitle(route) };

export default function PageRoute() {
	return (
		<Page title={route.title}>
			<PageBody>
				<EmptyState
					icon={route.icon}
					title={`${route.title} will appear here`}
					description="Placeholder page for layout preview. Content will be added later."
				/>
			</PageBody>
		</Page>
	);
}
