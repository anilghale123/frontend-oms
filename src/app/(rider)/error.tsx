"use client";

import { useEffect } from "react";
import { RotateCw } from "lucide-react";
import { ErrorState } from "@/components/feedback";
import { Button } from "@/components/ui/button";

interface RiderErrorProps {
	error: Error & { digest?: string };
	/** Fetches and renders the failed screen again. */
	retry: () => void;
}

/**
 * The rider page failed to render. Shown inside the rider shell, with a full-width, size 44 retry
 * because riders use a phone, often outdoors.
 */
export default function RiderError({ error, retry }: RiderErrorProps) {
	useEffect(() => {
		console.error("[OMS] the rider page failed to render", error);
	}, [error]);

	return (
		<ErrorState
			title="This page couldn’t be shown"
			description="Check your connection, then try again."
			action={
				<Button size="44" variant="outline" color="neutral" className="w-full" onClick={retry}>
					<RotateCw aria-hidden />
					Try again
				</Button>
			}
		/>
	);
}
