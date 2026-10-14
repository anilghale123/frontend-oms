"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
	AlertDialog,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ORDER_STATUS_LABELS, type OrderStatus } from "@/lib/domain";

interface Copy {
	title: string;
	description: string;
	action: string;
	color: "primary" | "error";
}

/** What the dialog says for a move from `from` to `to`, on order `omsOrderId`. */
function copyFor(from: OrderStatus, to: OrderStatus, omsOrderId: string): Copy {
	const history = "The customer sees this in their order history.";
	if (to === "delivered") {
		return {
			title: `Mark ${omsOrderId} delivered?`,
			description: `Only do this once the customer has the order. ${history}`,
			action: "Mark delivered",
			color: "primary",
		};
	}
	if (to === "failed") {
		return {
			title: `Mark ${omsOrderId} failed?`,
			description: `The order stops here and the customer sees it failed. ${history}`,
			action: "Mark failed",
			color: "error",
		};
	}
	return {
		title: `Change ${omsOrderId} to ${ORDER_STATUS_LABELS[to]}?`,
		description: history,
		action: "Change status",
		color: "primary",
	};
}

export interface ConfirmStatusDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Shown in the title, e.g. "OMS-0427". */
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
 * `@/lib/domain`): Mark delivered, Mark failed, and any change away from Delivered or Failed —
 * every change is shown to the customer. The dialog closes however the call ends: a failure has
 * already been shown, and the order reloaded on a conflict.
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
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{copy.title}</AlertDialogTitle>
					<AlertDialogDescription>{copy.description}</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button variant="outline" color="neutral" size="36" disabled={pending}>
							Cancel
						</Button>
					</AlertDialogCancel>
					<Button
						size="36"
						color={copy.color}
						loading={pending}
						onClick={() => void handleConfirm()}
					>
						{copy.action}
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
