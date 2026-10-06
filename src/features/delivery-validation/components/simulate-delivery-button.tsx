"use client";

import { PackageCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface SimulateDeliveryButtonProps {
	onClick: () => void;
	loading: boolean;
	disabled?: boolean;
}

/**
 * PROTOTYPE shortcut pinned to the bottom right of the delivery portal. Fills an Order ID and its
 * correct voucher so a successful delivery is one Confirm away in demos. It never submits.
 */
export function SimulateDeliveryButton({
	onClick,
	loading,
	disabled,
}: SimulateDeliveryButtonProps) {
	return (
		<Button
			size="44"
			variant="outline"
			color="neutral"
			className="fixed right-4 bottom-4 z-40 bg-bg shadow-lg"
			loading={loading}
			disabled={disabled}
			onClick={onClick}
		>
			<PackageCheck aria-hidden />
			Simulate delivery
		</Button>
	);
}
