"use client";

import { useState, type ReactNode } from "react";
import { useParams } from "next/navigation";
import { Package, PackageCheck, Truck } from "lucide-react";
import { Page, PageBody } from "@/components/layout";
import { CopyButton, EmptyState, ErrorState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { merchantRoutes } from "@/config/nav";
import { ApiError } from "@/lib/api/client";
import { canTransition } from "@/lib/domain";
import { AssignRiderDialog, MarkReadyDialog } from "@/features/fulfillment";
import { useAssignRider } from "../../hooks/use-assign-rider";
import { useOrderRoutes } from "../../order-routes";
import { useOrder, useUpdateOrderStatus } from "../../hooks/use-orders";
import { OrderProgressTracker, type FulfillmentNextStep } from "./order-fulfillment";
import { OrderSidePanel } from "./order-side-panel";
import { OrderDeliveryPanel } from "./order-delivery-panel";
import { OrderListPanel } from "./order-list-panel";
import { OrderSummary } from "./order-summary";
import { StatusBadge } from "../status-badge";

const BACK_LABEL = `Back to ${merchantRoutes.orderQueue.title}`;

export interface OrderDetailPageProps {
	omsOrderId: string;
}

/**
 * Order detail with the order list beside it (Multibranch product detail pattern): the list runs
 * edge to edge down the left of the content card and the detail scrolls on its own. Mounted as the
 * route layout so the list keeps its filter, search and scroll while the merchant moves between
 * orders. The list hides below `lg`.
 */
export function OrderDetailLayout({ children }: { children: ReactNode }) {
	const params = useParams<{ omsOrderId: string }>();
	return (
		<div className="-m-3 flex min-h-0 flex-1 md:-m-4">
			<OrderListPanel
				selectedId={decodeURIComponent(params.omsOrderId ?? "")}
				className="hidden lg:flex"
			/>
			<div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-3 md:p-4">{children}</div>
		</div>
	);
}

/**
 * Merchant order detail in two columns: the work on the left (fulfillment tracker, items, delivery
 * details from the redeem form) and one collapsible side card on the right (customer profile open,
 * rider and activity closed).
 * The next fulfillment action sits in a highlighted bar at the top of the Fulfillment card;
 * Mark ready asks for confirmation first.
 */
export function OrderDetailPage({ omsOrderId }: OrderDetailPageProps) {
	const orderRoutes = useOrderRoutes();
	const back = { href: orderRoutes.queue, label: BACK_LABEL };
	const { data, isLoading, isError, refetch, error } = useOrder(omsOrderId);
	const updateStatus = useUpdateOrderStatus(omsOrderId);
	const assignRider = useAssignRider(omsOrderId);
	const [riderOpen, setRiderOpen] = useState(false);
	const [confirmReadyOpen, setConfirmReadyOpen] = useState(false);

	if (isLoading) {
		return (
			<Page title={omsOrderId} back={back}>
				<PageBody>
					<div className="grid items-start gap-4 xl:grid-cols-3">
						<div className="flex flex-col gap-4 xl:col-span-2">
							<Skeleton className="h-36 w-full rounded-xl" />
							<Skeleton className="h-48 w-full rounded-xl" />
							<Skeleton className="h-56 w-full rounded-xl" />
						</div>
						<div className="flex flex-col gap-4">
							<Skeleton className="h-64 w-full rounded-xl" />
						</div>
					</div>
				</PageBody>
			</Page>
		);
	}

	if (isError) {
		const notFound = error instanceof ApiError && error.status === 404;
		return (
			<Page title={omsOrderId} back={back}>
				<PageBody>
					{notFound ? (
						<EmptyState
							icon={Package}
							title="Order not found"
							description="This OMS Order ID does not exist, or it belongs to another merchant."
						/>
					) : (
						<ErrorState
							title="Couldn’t load this order"
							description="Check your connection and try again."
							onRetry={() => void refetch()}
						/>
					)}
				</PageBody>
			</Page>
		);
	}

	if (!data) {
		return null;
	}

	const { order, activity } = data;
	const canMarkReady = canTransition(order.status, "ready_for_delivery");
	const canAssignRider = order.status === "ready_for_delivery";

	async function handleMarkReady() {
		await updateStatus.mutateAsync({ status: "ready_for_delivery" });
	}

	async function handleAssignRider(values: { name: string; phone: string; vehicleNumber: string }) {
		await assignRider.mutateAsync(values);
		await updateStatus.mutateAsync({ status: "delivering" });
	}

	// The merchant's next action sits in the Fulfillment card, right under the steps it moves.
	let nextStep: FulfillmentNextStep | undefined;
	if (canMarkReady) {
		nextStep = {
			title: "Mark the order ready",
			description: "Pack the item, then mark it ready so a rider can be assigned.",
			actions: (
				<Button
					size="36"
					onClick={() => setConfirmReadyOpen(true)}
					loading={updateStatus.isPending}
				>
					<PackageCheck aria-hidden />
					Mark ready
				</Button>
			),
		};
	} else if (canAssignRider) {
		nextStep = {
			title: order.rider ? "Update the rider" : "Assign a rider",
			description: "Add the rider's name, phone and vehicle to send the order out.",
			actions: (
				// Assign rider is disabled for now; remove `disabled` to bring it back.
				<Button
					size="36"
					disabled
					onClick={() => setRiderOpen(true)}
					loading={assignRider.isPending}
				>
					<Truck aria-hidden />
					{order.rider ? "Update rider" : "Assign rider"}
				</Button>
			),
		};
	} else if (order.status === "delivering") {
		nextStep = {
			title: "Waiting for delivery",
			description: "The rider confirms delivery with the customer's voucher.",
		};
	}

	return (
		<>
			<Page
				title={order.omsOrderId}
				back={back}
				badge={
					<>
						<CopyButton value={order.omsOrderId} label="order ID" />
						<StatusBadge status={order.status} />
					</>
				}
			>
				<PageBody>
					<div className="grid items-start gap-4 xl:grid-cols-3">
						<div className="flex flex-col gap-4 xl:col-span-2">
							<OrderProgressTracker status={order.status} entries={activity} nextStep={nextStep} />
							<OrderSummary order={order} />
							<OrderDeliveryPanel order={order} />
						</div>
						<OrderSidePanel order={order} activity={activity} />
					</div>
				</PageBody>
			</Page>

			<MarkReadyDialog
				open={confirmReadyOpen}
				onOpenChange={setConfirmReadyOpen}
				omsOrderId={order.omsOrderId}
				onConfirm={handleMarkReady}
			/>

			<AssignRiderDialog
				open={riderOpen}
				onOpenChange={setRiderOpen}
				initial={order.rider}
				onSubmit={handleAssignRider}
			/>
		</>
	);
}
