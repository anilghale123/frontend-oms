import type { Metadata } from "next";
import { OpenFromPortalState } from "@/features/shell";

export const metadata: Metadata = { title: "Page not found · Fonepoints OMS" };

/**
 * Any address OMS does not have, including a mistyped one inside the portal's frame
 * (`/embed/…`). Without this the frame showed Next's unstyled 404. OMS has no navigation of its own
 * to send anyone back through, so it says where OMS opens from.
 */
export default function NotFound() {
	return (
		<main className="flex flex-1 flex-col justify-center p-4">
			<OpenFromPortalState
				title="Page not found"
				description="This page doesn’t exist. Open OMS again from the Fonepoints Business portal."
			/>
		</main>
	);
}
