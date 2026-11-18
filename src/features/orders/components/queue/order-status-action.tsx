"use client";

import { Button } from "@/components/ui/button";
import { primaryAction, type Order } from "@/lib/domain";
import { useOrderStatusChange } from "../../hooks/use-order-status-change";

export interface OrderStatusActionProps {
	order: Order;
}

/**
 * The one next step for a queue row, from `primaryAction`: Mark ready while preparing. Other
 * statuses show nothing (the merchant never marks delivered: the rider and backend do), and every
 * row has its "More actions" menu.
 *
 * Assign rider is never offered in this column (`action.kind === "assign_rider"` below). Remove
 * that check to bring it back.
 */
export function OrderStatusAction({ order }: OrderStatusActionProps) {
	const statusChange = useOrderStatusChange(order);
	const action = primaryAction(order.status);

	// No button when there is no next step: the row's "More actions" menu is always there, so the
	// cell needs no placeholder.
	if (!action || action.kind === "assign_rider") return null;

	return (
		<>
			<Button
				size="28"
				variant="outline"
				color="neutral"
				loading={statusChange.pending}
				// Mark ready is not confirmed first, so a second click must not send it again.
				disabled={statusChange.pending}
				onClick={() => statusChange.run(action)}
			>
				{action.label}
			</Button>
			{statusChange.dialogs}
		</>
	);
}
