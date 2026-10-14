"use client";

import type { ReactNode } from "react";
import { CircleCheck, CircleX, Package, PackageCheck, Truck, type LucideIcon } from "lucide-react";
import { Panel, PanelContent, PanelHeader, PanelHint, PanelTitle } from "@/components/layout";
import {
	ORDER_STATUS_LABELS,
	fulfillmentSequence,
	type OrderLog,
	type OrderStatus,
} from "@/lib/domain";
import { cn } from "@/lib/utils";
import { StatusBadge } from "../status-badge";

const STEP_ICONS: Record<OrderStatus, LucideIcon> = {
	preparing: Package,
	ready_for_delivery: PackageCheck,
	delivering: Truck,
	delivered: CircleCheck,
	failed: CircleX,
};

type StepState = "reached" | "current" | "upcoming";

export interface FulfillmentStep {
	status: OrderStatus;
	state: StepState;
	/** When the order entered this status, from the log; Nepal time as the server sent it. */
	time: string | null;
}

export interface OrderProgressTrackerProps {
	status: OrderStatus;
	logs: OrderLog[];
	/** The merchant's next step, shown in a highlighted bar above the steps. */
	nextStep?: FulfillmentNextStep;
}

export interface FulfillmentNextStep {
	/** What to do, e.g. "Mark the order ready". */
	title: string;
	/** Why or when, one short sentence. */
	description: string;
	/** The action buttons, primary first. Omit when the next step is someone else's. */
	actions?: ReactNode;
}

/**
 * Horizontal fulfillment tracker (CommerceO tracking pattern): icon circles joined by a line that
 * fills as steps are reached, label and time under each. A failed order ends at a failed step.
 * Custom rather than Radian `Stepper`: its separator centres on the whole trigger, so it cannot
 * join the icon centres when labels sit under the icons.
 */
export function OrderProgressTracker({ status, logs, nextStep }: OrderProgressTrackerProps) {
	const steps = buildFulfillmentSteps(status, logs);

	return (
		<Panel flush>
			<PanelHeader>
				<PanelTitle>Fulfillment</PanelTitle>
			</PanelHeader>
			{nextStep && (
				<div
					data-slot="fulfillment-next-step"
					className="flex flex-col gap-3 border-b border-primary-border bg-primary-accent px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
				>
					<div className="flex min-w-0 flex-col gap-0.5">
						<p className="text-sm font-semibold text-primary-text">{nextStep.title}</p>
						<p className="text-sm text-fg-secondary">{nextStep.description}</p>
					</div>
					{nextStep.actions && (
						<div className="flex shrink-0 flex-wrap items-center gap-2">{nextStep.actions}</div>
					)}
				</div>
			)}
			<PanelContent>
				<ol className="flex">
					{steps.map((step, index) => {
						const Icon = STEP_ICONS[step.status];
						const next = steps[index + 1];
						const failed = step.status === "failed";
						const upcoming = step.state === "upcoming";
						return (
							<li
								key={step.status}
								className="relative flex min-w-0 flex-1 flex-col items-center gap-2 px-1 text-center"
							>
								{next && (
									<span
										aria-hidden
										className={cn(
											"absolute top-5 left-1/2 h-0.5 w-full -translate-y-1/2",
											next.state === "upcoming" || next.status === "failed"
												? "bg-border"
												: "bg-primary",
										)}
									/>
								)}
								<span
									aria-hidden
									className={cn(
										"relative z-10 flex size-10 items-center justify-center rounded-full",
										failed
											? "bg-fg-secondary text-bg"
											: upcoming
												? "border border-border bg-fill1 text-fg-tertiary"
												: "bg-primary text-primary-fg",
										step.state === "current" && "ring-2 ring-primary ring-offset-2 ring-offset-bg",
									)}
								>
									<Icon className="size-4" />
								</span>
								{failed ? (
									<StatusBadge status="failed" />
								) : (
									<p
										className={cn("text-sm font-medium", upcoming ? "text-fg-tertiary" : "text-fg")}
									>
										{ORDER_STATUS_LABELS[step.status]}
										{step.state === "current" && <span className="sr-only"> (current step)</span>}
									</p>
								)}
								<span className="text-xs text-fg-tertiary tabular-nums">
									{step.time ?? (upcoming ? "Pending" : " ")}
								</span>
							</li>
						);
					})}
				</ol>
			</PanelContent>
		</Panel>
	);
}

export interface OrderActivityListProps {
	/** The order's status timeline, oldest first, as the API sends it. */
	logs: OrderLog[];
}

/**
 * Activity section body: every status change on a dotted rail, oldest first — the status, the
 * message the customer was shown, and when.
 */
export function OrderActivityList({ logs }: OrderActivityListProps) {
	if (logs.length === 0) {
		return <PanelHint>No activity recorded yet.</PanelHint>;
	}

	return (
		<ol className="flex flex-col">
			{logs.map((log, index) => (
				<li
					key={`${log.status}-${log.date}-${index}`}
					className="relative flex gap-3 pb-4 last:pb-0"
				>
					{index < logs.length - 1 && (
						<span
							aria-hidden
							className="absolute top-4 bottom-0 left-1.5 w-px -translate-x-1/2 bg-border"
						/>
					)}
					<span
						aria-hidden
						className="relative z-10 mt-1 size-3 shrink-0 rounded-full bg-primary"
					/>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<p className="text-sm font-medium text-fg">{ORDER_STATUS_LABELS[log.status]}</p>
						{log.remarks && <p className="text-sm text-fg-secondary">{log.remarks}</p>}
						<p className="text-xs text-fg-tertiary tabular-nums">{log.date}</p>
					</div>
				</li>
			))}
		</ol>
	);
}

/**
 * Tracker steps: the status sequence with reached / current / upcoming states and the time each
 * step was entered. A failed order shows only the steps it is known to have reached, then Failed.
 */
export function buildFulfillmentSteps(status: OrderStatus, logs: OrderLog[]): FulfillmentStep[] {
	const anchors = new Map<OrderStatus, string>();
	for (const log of logs) anchors.set(log.status, log.date);
	const sequence = fulfillmentSequence(status);

	if (status === "failed") {
		return [
			...sequence
				.filter((step) => anchors.has(step))
				.map((step): FulfillmentStep => ({
					status: step,
					state: "reached",
					time: anchors.get(step) ?? null,
				})),
			{ status: "failed", state: "current", time: anchors.get("failed") ?? null },
		];
	}

	const currentIndex = sequence.indexOf(status);
	return sequence.map((step, index): FulfillmentStep => ({
		status: step,
		state: index < currentIndex ? "reached" : index === currentIndex ? "current" : "upcoming",
		time: index <= currentIndex ? (anchors.get(step) ?? null) : null,
	}));
}
