"use client";

import { useState } from "react";
import {
	CircleCheck,
	Package,
	PackageCheck,
	PackageX,
	Truck,
	X,
	type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain";

interface Copy {
	title: string;
	description: string;
	action: string;
}

/** What the dialog says for a move from `from` to `to`, on order `omsOrderId`. */
function copyFor(from: OrderStatus, to: OrderStatus, omsOrderId: string): Copy {
	const history = "The customer sees this in their order history.";
	if (to === "failed") {
		return {
			title: `Mark ${omsOrderId} failed?`,
			description: `The order stops here and the customer sees it failed. ${history}`,
			action: "Mark failed",
		};
	}
	return {
		title: `Change ${omsOrderId} to ${ORDER_STATUS_LABELS[to]}?`,
		description: `It is now ${ORDER_STATUS_LABELS[from]}. ${history}`,
		action: "Change status",
	};
}

const STATUS_ICON: Record<OrderStatus, LucideIcon> = {
	preparing: Package,
	ready_for_delivery: PackageCheck,
	delivering: Truck,
	delivered: CircleCheck,
	failed: PackageX,
};

/** Popup button type: Nunito ExtraBold 12/16, as written (no uppercase), 96px wide at least. */
const POPUP_BUTTON =
	"h-8 min-w-24 px-3 font-body text-xs leading-4 font-extrabold normal-case focus-visible:font-extrabold";

export interface ConfirmStatusDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Shown in the message, e.g. "OMS-0427". */
	omsOrderId: string;
	/** The order's status now. */
	from: OrderStatus;
	/** The status the merchant chose. */
	to: OrderStatus;
	/** Runs the status change; the dialog stays open (button loading) until it settles. */
	onConfirm: () => Promise<void>;
}

/**
 * "Are you sure" before a status change the guide asks to confirm (`needsConfirmation` in
 * `@/lib/domain`): every status change, since each is shown to the customer.
 *
 * A centred card: close ×, the target status's icon in a ringed badge, the question and what it means, and
 * the confirm (Primary, or error for Failed) and Cancel (Default) buttons. The dialog closes
 * however the call ends: a failure has already been shown, and the order reloaded on a conflict.
 */
export function ConfirmStatusDialog({
	open,
	onOpenChange,
	omsOrderId,
	from,
	to,
	onConfirm,
}: ConfirmStatusDialogProps) {
	const [pending, setPending] = useState(false);
	const copy = copyFor(from, to, omsOrderId);
	const Icon = STATUS_ICON[to];
	const failing = to === "failed";

	async function handleConfirm() {
		setPending(true);
		try {
			await onConfirm();
		} catch {
			// Reported by the mutation hook; nothing more to say here.
		} finally {
			setPending(false);
			onOpenChange(false);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<AlertDialogContent
				className="flex max-w-137.5 flex-col items-center px-11 pt-9 pb-6 font-body"
			>
				<AlertDialogCancel asChild>
					<button
						type="button"
						aria-label="Close"
						disabled={pending}
						className="absolute top-4 right-4 flex size-5 items-center justify-center text-dialog-close hover:text-fg-secondary focus-visible:outline-1 focus-visible:outline-fg-secondary disabled:pointer-events-none"
					>
						<X className="size-3" strokeWidth={2} absoluteStrokeWidth aria-hidden />
					</button>
				</AlertDialogCancel>

				<span
					className={cn(
						"flex size-17 shrink-0 items-center justify-center rounded-full border",
						failing
							? "border-error bg-error-accent text-error-text"
							: "border-btn-primary bg-dialog-badge text-btn-primary",
					)}
				>
					<Icon className="size-10.5" strokeWidth={2} absoluteStrokeWidth aria-hidden />
				</span>

				<AlertDialogTitle className="mt-7.5 w-full text-center text-base leading-5.5 font-extrabold text-dialog-text">
					{copy.title}
				</AlertDialogTitle>
				<AlertDialogDescription className="mt-2 text-center text-sm text-dialog-text">
					{copy.description}
				</AlertDialogDescription>

				<div className="mt-6 flex items-center justify-center gap-2.5">
					<Button
						size="32"
						color={failing ? "error" : "primary"}
						loading={pending}
						onClick={() => void handleConfirm()}
						className={cn(POPUP_BUTTON, !failing && "bg-btn-primary", failing && "text-white")}
					>
						{copy.action}
					</Button>
					<AlertDialogCancel asChild>
						<Button size="32" color="default" disabled={pending} className={POPUP_BUTTON}>
							Cancel
						</Button>
					</AlertDialogCancel>
				</div>
			</AlertDialogContent>
		</AlertDialog>
	);
}
