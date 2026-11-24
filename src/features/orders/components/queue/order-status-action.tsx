"use client";

import { Button } from "@/components/ui/button";
import { primaryAction, type Order } from "@/lib/domain";
import { useOrderStatusChange } from "../../hooks/use-order-status-change";

export interface OrderStatusActionProps {
	order: Order;
}

/**
 * The one next step for a queue row, from `primaryAction`: Mark ready while preparing. Other
 * statuses show an em dash, and every row has its "More actions" menu.
 *
 * Assign rider is never offered in this column (`action.kind === "assign_rider"` below). Remove
 * that check to bring it back.
 */
export function OrderStatusAction({ order }: OrderStatusActionProps) {
	const statusChange = useOrderStatusChange(order);
	const action = primaryAction(order.status);

	// No next step (delivering, delivered, failed): an em dash holds the cell.
	if (!action || action.kind === "assign_rider") {
		return (
			<span className="text-xs leading-4 font-extrabold text-action" aria-label="No action">
				—
			</span>
		);
	}

	return (
		<>
			<Button
				// The Secondary button (Small): its colors and states come from the shared component.
				size="32"
				variant="outline"
				color="primary"
				loading={statusChange.pending}
				// Block a second click while the change is in flight.
				disabled={statusChange.pending}
				onClick={() => statusChange.run(action)}
			>
				{action.label}
			</Button>
			{statusChange.dialogs}
		</>
	);
}
