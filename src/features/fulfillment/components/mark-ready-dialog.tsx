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

export interface MarkReadyDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	omsOrderId: string;
	/** Runs the status change; the dialog stays open (button loading) until it settles. */
	onConfirm: () => Promise<void>;
}

/**
 * "Are you sure" before Mark ready: the move is one way (Ready for delivery cannot go back to
 * Preparing), so the merchant confirms the item is packed first.
 */
export function MarkReadyDialog({
	open,
	onOpenChange,
	omsOrderId,
	onConfirm,
}: MarkReadyDialogProps) {
	const [pending, setPending] = useState(false);

	async function handleConfirm() {
		setPending(true);
		try {
			await onConfirm();
			onOpenChange(false);
		} finally {
			setPending(false);
		}
	}

	return (
		<AlertDialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>Mark {omsOrderId} ready?</AlertDialogTitle>
					<AlertDialogDescription>
						Make sure the item is packed. The order moves to Ready for delivery and can&apos;t go
						back to Preparing.
					</AlertDialogDescription>
				</AlertDialogHeader>
				<AlertDialogFooter>
					<AlertDialogCancel asChild>
						<Button variant="outline" color="neutral" size="36" disabled={pending}>
							Cancel
						</Button>
					</AlertDialogCancel>
					<Button size="36" loading={pending} onClick={() => void handleConfirm()}>
						Mark ready
					</Button>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
