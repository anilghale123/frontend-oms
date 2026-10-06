"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { canTransition, type Order } from "@/lib/domain";
import { AssignRiderDialog } from "@/features/fulfillment";
import { useAssignRider } from "../../hooks/use-assign-rider";
import { useUpdateOrderStatus } from "../../hooks/use-orders";

export interface OrderStatusActionProps {
	order: Order;
}

/**
 * The one next status step for a queue row, from the transition table: "Mark ready" while
 * preparing, "Assign rider" when ready (moves it to Delivering). Other statuses have no merchant
 * action, so the cell shows a dash.
 */
export function OrderStatusAction({ order }: OrderStatusActionProps) {
	const updateStatus = useUpdateOrderStatus(order.omsOrderId);
	const assignRider = useAssignRider(order.omsOrderId);
	const [riderOpen, setRiderOpen] = useState(false);

	if (canTransition(order.status, "ready_for_delivery")) {
		return (
			<Button
				size="28"
				variant="outline"
				color="neutral"
				loading={updateStatus.isPending}
				onClick={() => void updateStatus.mutateAsync({ status: "ready_for_delivery" })}
			>
				Mark ready
			</Button>
		);
	}

	if (canTransition(order.status, "delivering")) {
		return (
			<>
				{/* Assign rider is disabled for now; remove `disabled` to bring it back. */}
				<Button size="28" disabled onClick={() => setRiderOpen(true)}>
					Assign rider
				</Button>
				<AssignRiderDialog
					open={riderOpen}
					onOpenChange={setRiderOpen}
					initial={order.rider}
					onSubmit={async (values) => {
						await assignRider.mutateAsync(values);
						await updateStatus.mutateAsync({ status: "delivering" });
					}}
				/>
			</>
		);
	}

	return (
		<span className="block text-center text-fg-tertiary">
			<span aria-hidden>—</span>
			<span className="sr-only">No action</span>
		</span>
	);
}
