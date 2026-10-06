"use client";

import type { ReactNode } from "react";
import {
	CircleCheck,
	CircleX,
	Package,
	PackageCheck,
	ShieldCheck,
	Truck,
	type LucideIcon,
} from "lucide-react";
import { Panel, PanelContent, PanelHeader, PanelHint, PanelTitle } from "@/components/layout";
import {
	ORDER_STATUS_LABELS,
	ORDER_STATUS_SEQUENCE,
	type ActivityLogEntry,
	type OrderStatus,
} from "@/lib/domain";
import {
	MOCK_MERCHANTS,
	MOCK_ROLE_LABELS,
	isMerchantRole,
	type MockRole,
} from "@/config/constants";
import { useMerchant } from "@/providers/AuthProvider";
import type { MerchantProfile } from "@/lib/auth";
import { cn, formatDateTime } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
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
	/** When the order entered this status, if the activity log records it. */
	time: string | null;
}

export interface OrderProgressTrackerProps {
	status: OrderStatus;
	entries: ActivityLogEntry[];
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
export function OrderProgressTracker({ status, entries, nextStep }: OrderProgressTrackerProps) {
	const steps = buildFulfillmentSteps(status, entries);

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
								{step.time ? (
									<time dateTime={step.time} className="text-xs text-fg-tertiary tabular-nums">
										{formatDateTime(step.time)}
									</time>
								) : (
									<span className="text-xs text-fg-tertiary">{upcoming ? "Pending" : " "}</span>
								)}
							</li>
						);
					})}
				</ol>
			</PanelContent>
		</Panel>
	);
}

export interface OrderActivityListProps {
	entries: ActivityLogEntry[];
}

/** Activity section body: every log entry, oldest first, on a dotted rail. */
export function OrderActivityList({ entries }: OrderActivityListProps) {
	const merchant = useMerchant();
	const sorted = [...entries].sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);

	if (sorted.length === 0) {
		return <PanelHint>No activity recorded yet.</PanelHint>;
	}

	return (
		<ol className="flex flex-col">
			{sorted.map((entry, index) => (
				<li key={entry.id} className="relative flex gap-3 pb-4 last:pb-0">
					{index < sorted.length - 1 && (
						<span
							aria-hidden
							className="absolute top-4 bottom-0 left-1.5 w-px -translate-x-1/2 bg-border"
						/>
					)}
					<span
						aria-hidden
						className={cn(
							"relative z-10 mt-1 size-3 shrink-0 rounded-full",
							isOverride(entry) ? "border-2 border-primary bg-bg" : "bg-primary",
						)}
					/>
					<div className="flex min-w-0 flex-1 flex-col gap-0.5">
						<p className="text-sm text-fg">{activityMessage(entry)}</p>
						{isOverride(entry) && (
							<Badge variant="soft" color="neutral" size="20" className="w-fit">
								<ShieldCheck aria-hidden />
								CS override
							</Badge>
						)}
						<p className="text-xs text-fg-tertiary">
							{actorLabel(entry.actor, merchant)} ·{" "}
							<time dateTime={entry.timestamp} className="tabular-nums">
								{formatDateTime(entry.timestamp)}
							</time>
						</p>
					</div>
				</li>
			))}
		</ol>
	);
}

/** CS overrides are audited (PRD §10): actor, previous and new status, time, override flag. */
function isOverride(entry: ActivityLogEntry): boolean {
	return entry.type === "cs_override" || entry.metadata?.override === true;
}

/** Status-change messages carry raw status keys; show the status labels instead. */
function activityMessage(entry: ActivityLogEntry): string {
	const entered = enteredStatus(entry);
	if (isOverride(entry) && entered) {
		const previous = statusFromMetadata(entry.metadata?.previousStatus);
		return previous
			? `Status overridden from ${ORDER_STATUS_LABELS[previous]} to ${ORDER_STATUS_LABELS[entered]}`
			: `Status overridden to ${ORDER_STATUS_LABELS[entered]}`;
	}
	if (entry.type === "status_changed" && entered) {
		return `Status changed to ${ORDER_STATUS_LABELS[entered]}`;
	}
	return entry.message;
}

function statusFromMetadata(value: unknown): OrderStatus | null {
	return typeof value === "string" && value in ORDER_STATUS_LABELS ? (value as OrderStatus) : null;
}

/** The status an entry moved the order into, when it records a status change. */
function enteredStatus(entry: ActivityLogEntry): OrderStatus | null {
	if (entry.type === "order_created") return "preparing";
	if (entry.type !== "status_changed" && entry.type !== "cs_override") return null;
	return statusFromMetadata(entry.metadata?.newStatus);
}

/**
 * Tracker steps: the status sequence with reached / current / upcoming states and the time each
 * step was entered. A failed order shows only the steps it is known to have reached, then Failed.
 */
export function buildFulfillmentSteps(
	status: OrderStatus,
	entries: ActivityLogEntry[],
): FulfillmentStep[] {
	const anchors = new Map<OrderStatus, string>();
	const sorted = [...entries].sort(
		(a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime(),
	);
	for (const entry of sorted) {
		const entered = enteredStatus(entry);
		if (entered) anchors.set(entered, entry.timestamp);
	}

	if (status === "failed") {
		return [
			...ORDER_STATUS_SEQUENCE.filter((step) => anchors.has(step)).map((step): FulfillmentStep => ({
				status: step,
				state: "reached",
				time: anchors.get(step) ?? null,
			})),
			{ status: "failed", state: "current", time: anchors.get("failed") ?? null },
		];
	}

	const currentIndex = ORDER_STATUS_SEQUENCE.indexOf(status);
	return ORDER_STATUS_SEQUENCE.map((step, index): FulfillmentStep => ({
		status: step,
		state: index < currentIndex ? "reached" : index === currentIndex ? "current" : "upcoming",
		time: index <= currentIndex ? (anchors.get(step) ?? null) : null,
	}));
}

/**
 * Who did it, in words: the merchant's company name, a role label, or "System" / "Rider".
 *
 * The signed-in merchant is resolved from the session first, so an entry this merchant wrote is
 * labelled with the company name the access token reports. `MOCK_MERCHANTS` stays underneath it
 * for the seeded history, which names merchants by id and predates any session.
 */
function actorLabel(actor: string, merchant: MerchantProfile | null): string {
	if (merchant && actor === merchant.merchantId) return merchant.companyName;
	if (isMerchantRole(actor)) return MOCK_MERCHANTS[actor].companyName;
	if (actor in MOCK_ROLE_LABELS) return MOCK_ROLE_LABELS[actor as MockRole];
	return actor.charAt(0).toUpperCase() + actor.slice(1);
}
