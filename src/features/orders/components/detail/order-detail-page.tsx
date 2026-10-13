"use client";

import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { CircleCheck, Package, PackageCheck, Truck, type LucideIcon } from "lucide-react";
import { Page, PageBody } from "@/components/layout";
import { CopyButton, EmptyState, ErrorState } from "@/components/feedback";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { orderRoutes as orderRouteTitles } from "@/config/nav";
import { ApiError } from "@/lib/api/client";
import { toErrorMessage } from "@/lib/api/errors";
import { primaryAction, type Order, type OrderStatus } from "@/lib/domain";
import { useOrderRoutes } from "../../order-routes";
import { useOrder } from "../../hooks/use-orders";
import { useOrderStatusChange } from "../../hooks/use-order-status-change";
import { OrderProgressTracker } from "./order-fulfillment";
import { OrderSidePanel } from "./order-side-panel";
import { OrderDetailsPanel } from "./order-details-panel";
import { OrderListPanel } from "./order-list-panel";
import { OrderStatusMenu } from "./order-status-menu";
import { OrderSummary } from "./order-summary";
import { StatusBadge } from "../status-badge";

const BACK_LABEL = `Back to ${orderRouteTitles.orderQueue.title}`;

/** The next-step bar's copy per status. */
const NEXT_STEP: Record<OrderStatus, { title: string; description: string }> = {
	preparing: {
		title: "Mark the order ready",
		description: "Pack the item, then mark it ready for delivery.",
	},
	ready_for_delivery: {
		title: "Assign a rider",
		description: "Record who is delivering it. The order moves to Delivering.",
	},
	delivering: {
		title: "Out for delivery",
		description: "The rider confirms delivery with the customer’s voucher, or mark it delivered.",
	},
	delivered: {
		title: "Delivered",
		description: "This order is complete. Change its status only to correct a mistake.",
	},
	failed: {
		title: "Failed",
		description: "This order stopped here. Change its status only to correct a mistake.",
	},
};

/** The primary button's icon, per the status it leads from. */
const PRIMARY_ICON: Partial<Record<OrderStatus, LucideIcon>> = {
	preparing: PackageCheck,
	ready_for_delivery: Truck,
	delivering: CircleCheck,
};

export interface OrderDetailPageProps {
	/** The partner's `reference_id`, from the URL. */
	referenceId: string;
	/** Draws the loading state without fetching (see `OrderScreenSkeleton`). */
	placeholder?: boolean;
}

export interface OrderDetailLayoutProps {
	children: ReactNode;
	/** Draws the order list's loading state without fetching (see `OrderScreenSkeleton`). */
	placeholder?: boolean;
}

/**
 * Order detail with the order list beside it (Multibranch product detail pattern): the list runs
 * edge to edge down the left of the content card and the detail scrolls on its own. Mounted as the
 * route layout so the list keeps its filter, search and scroll while the merchant moves between
 * orders. The list hides below `lg`.
 */
export function OrderDetailLayout({ children, placeholder = false }: OrderDetailLayoutProps) {
	const params = useParams<{ referenceId: string }>();
	return (
		<div className="-m-3 flex min-h-0 flex-1 md:-m-4">
			<OrderListPanel
				selectedId={decodeURIComponent(params.referenceId ?? "")}
				placeholder={placeholder}
				className="hidden lg:flex"
			/>
			<div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-3 md:p-4">{children}</div>
		</div>
	);
}

/**
 * Merchant order detail in two columns: the work on the left (fulfillment tracker, items, order
 * details) and one collapsible side card on the right (customer open, rider and activity closed).
 * The status actions sit in a highlighted bar at the top of the Fulfillment card: the status's
 * primary action, and a "Change status" menu with every other status.
 */
export function OrderDetailPage({ referenceId, placeholder = false }: OrderDetailPageProps) {
	const orderRoutes = useOrderRoutes();
	const back = { href: orderRoutes.queue, label: BACK_LABEL };
	const {
		data: order,
		isLoading,
		isError,
		isFetching,
		refetch,
		error,
	} = useOrder(referenceId, {
		enabled: !placeholder,
	});

	if (placeholder || isLoading) {
		return (
			<Page title={referenceId} back={back}>
				<PageBody>
					<div className="grid items-start gap-4 xl:grid-cols-3">
						<div className="flex flex-col gap-4 xl:col-span-2">
							<Skeleton className="h-36 w-full rounded-xl" />
							<Skeleton className="h-48 w-full rounded-xl" />
							<Skeleton className="h-40 w-full rounded-xl" />
						</div>
						<div className="flex flex-col gap-4">
							<Skeleton className="h-64 w-full rounded-xl" />
						</div>
					</div>
				</PageBody>
			</Page>
		);
	}

	if (isError || !order) {
		const notFound = error instanceof ApiError && error.status === 404;
		return (
			<Page title={referenceId} back={back}>
				<PageBody>
					{notFound ? (
						<EmptyState
							icon={Package}
							title="Order not found"
							description="This order doesn’t exist, or it belongs to another merchant."
						/>
					) : (
						<ErrorState
							title="Couldn’t load this order"
							description={toErrorMessage(error)}
							onRetry={() => void refetch()}
							retrying={isFetching}
						/>
					)}
				</PageBody>
			</Page>
		);
	}

	return <OrderDetail order={order} back={back} />;
}

function OrderDetail({ order, back }: { order: Order; back: { href: string; label: string } }) {
	const statusChange = useOrderStatusChange(order);
	const action = primaryAction(order.status);
	const PrimaryIcon = PRIMARY_ICON[order.status];

	const nextStep = {
		...NEXT_STEP[order.status],
		actions: (
			<>
				{action && (
					<Button
						size="36"
						loading={
							action.kind === "status"
								? statusChange.pendingTo === action.to
								: statusChange.pending && statusChange.pendingTo === null
						}
						disabled={statusChange.pending}
						onClick={() => statusChange.run(action)}
					>
						{PrimaryIcon && <PrimaryIcon aria-hidden />}
						{action.label}
					</Button>
				)}
				<OrderStatusMenu
					status={order.status}
					onSelect={statusChange.change}
					disabled={statusChange.pending}
					prominent={!action}
				/>
			</>
		),
	};

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
							<OrderProgressTracker status={order.status} logs={order.logs} nextStep={nextStep} />
							<OrderSummary order={order} />
							<OrderDetailsPanel order={order} />
						</div>
						<OrderSidePanel order={order} />
					</div>
				</PageBody>
			</Page>
			{statusChange.dialogs}
		</>
	);
}
