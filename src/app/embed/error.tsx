"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ErrorState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { useOrderRoutes } from "@/features/orders";

interface EmbedErrorProps {
	error: Error & { digest?: string };
	/** Fetches and renders the failed screen again. */
	retry: () => void;
}

/**
 * A screen inside the portal's frame failed to render. Query failures already have their own error
 * states; this catches what those cannot, such as a component throwing on data it did not expect.
 * Without it the merchant saw Next's bare "Application error" page inside the frame, with no way
 * back. It renders inside the embed layout, so the session and the theme stay as they were.
 */
export default function EmbedError({ error, retry }: EmbedErrorProps) {
	const orderRoutes = useOrderRoutes();

	useEffect(() => {
		console.error("[OMS] a screen failed to render", error);
	}, [error]);

	return (
		<div className="flex flex-1 flex-col justify-center">
			<ErrorState
				title="This screen couldn’t be shown"
				description="Try again. If it keeps happening, go back to the order list."
				onRetry={retry}
				action={
					<Button asChild variant="ghost" color="neutral" size="32">
						<Link href={orderRoutes.queue}>Back to orders</Link>
					</Button>
				}
			/>
		</div>
	);
}
