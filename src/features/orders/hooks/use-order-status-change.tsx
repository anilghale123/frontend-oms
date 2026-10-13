"use client";

import { useMemo, useState, type ReactNode } from "react";
import {
	goesThroughAssignRider,
	needsConfirmation,
	type Order,
	type OrderStatus,
	type PrimaryAction,
} from "@/lib/domain";
import {
	AssignRiderDialog,
	ConfirmStatusDialog,
	type AssignRiderInput,
} from "@/features/fulfillment";
import { useAssignRider, useUpdateOrderStatus } from "./use-orders";

export interface OrderStatusChange {
	/** Moves the order to `to`, through Assign rider or a confirmation when the rules ask for one. */
	change: (to: OrderStatus) => void;
	/** Runs a status's primary action (`primaryAction` in `@/lib/domain`). */
	run: (action: PrimaryAction) => void;
	/** A change is in flight. */
	pending: boolean;
	/** The status a plain change is moving to, while it is in flight. */
	pendingTo: OrderStatus | null;
	/** The dialogs this needs; render them once, next to the buttons. */
	dialogs: ReactNode;
}

/**
 * Every way a merchant changes an order's status, in one place, so the queue row and the detail
 * page behave the same:
 *
 * - `delivering` goes through Assign rider, so the rider is recorded;
 * - Mark delivered, Mark failed and any change away from Delivered or Failed are confirmed first,
 *   because the customer sees every change (`needsConfirmation`);
 * - anything else is a plain status change.
 *
 * The rules themselves live in `@/lib/domain`; this only wires them to the dialogs and mutations.
 */
export function useOrderStatusChange(order: Order): OrderStatusChange {
	const updateStatus = useUpdateOrderStatus(order.referenceId);
	const assignRider = useAssignRider(order.referenceId);
	const [confirmTo, setConfirmTo] = useState<OrderStatus | null>(null);
	const [assigning, setAssigning] = useState(false);

	// The rider already on the order, so reassigning starts from what is recorded.
	const riderPrefill = useMemo<Partial<AssignRiderInput>>(
		() => ({
			name: order.rider?.name ?? "",
			phone: order.rider?.phone ?? "",
			vehicleNumber:
				order.rider?.extra.find((field) => field.label === "Vehicle number")?.value ?? "",
		}),
		[order.rider],
	);

	function change(to: OrderStatus) {
		if (goesThroughAssignRider(to)) {
			setAssigning(true);
		} else if (needsConfirmation(order.status, to)) {
			setConfirmTo(to);
		} else {
			updateStatus.mutate({ status: to });
		}
	}

	function run(action: PrimaryAction) {
		if (action.kind === "assign_rider") setAssigning(true);
		else change(action.to);
	}

	const dialogs = (
		<>
			{confirmTo && (
				<ConfirmStatusDialog
					open
					onOpenChange={(open) => !open && setConfirmTo(null)}
					omsOrderId={order.omsOrderId}
					from={order.status}
					to={confirmTo}
					onConfirm={async () => {
						await updateStatus.mutateAsync({ status: confirmTo });
					}}
				/>
			)}
			<AssignRiderDialog
				open={assigning}
				onOpenChange={setAssigning}
				omsOrderId={order.omsOrderId}
				initial={riderPrefill}
				onSubmit={async (values) => {
					await assignRider.mutateAsync({
						rider: {
							name: values.name,
							phone: values.phone,
							vehicle_number: values.vehicleNumber,
						},
					});
				}}
			/>
		</>
	);

	return {
		change,
		run,
		pending: updateStatus.isPending || assignRider.isPending,
		pendingTo: updateStatus.isPending ? (updateStatus.variables?.status ?? null) : null,
		dialogs,
	};
}
