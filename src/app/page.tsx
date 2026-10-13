import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { EmptyState } from "@/components/feedback";

export const metadata: Metadata = { title: "Fonepoints OMS" };

/**
 * OMS has no front door of its own. Merchants reach it inside the Fonepoints Business portal
 * (`/embed/orders`), which is what hands OMS an access token; riders use the link they are sent
 * (`/deliver`). Anyone landing here is told where to go instead.
 */
export default function HomePage() {
	return (
		<main className="flex flex-1 flex-col justify-center p-4">
			<EmptyState
				icon={Lock}
				title="OMS opens from the Fonepoints portal"
				description="Sign in to Fonepoints Business and choose OMS. The portal is what grants this app access to your orders."
			/>
		</main>
	);
}
