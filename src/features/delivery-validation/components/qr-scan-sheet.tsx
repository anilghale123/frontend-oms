"use client";

import { ScanLine } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerBody,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { useScanVoucher } from "../hooks/use-scan-voucher";

export interface QrScanSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Order ID typed so far; the simulated scan needs it to find the customer's voucher. */
	omsOrderId: string;
	/** Called with the scanned voucher number. */
	onScan: (voucherCode: string) => void;
}

/**
 * Bottom sheet that stands in for the camera. PROTOTYPE: there is no camera; "Simulate scan"
 * reads the voucher the customer's QR would carry, and "Scan a wrong voucher" fills one that
 * won't match.
 */
export function QrScanSheet({ open, onOpenChange, omsOrderId, onScan }: QrScanSheetProps) {
	const scan = useScanVoucher();
	const orderId = omsOrderId.trim();

	function finish(voucherCode: string) {
		onScan(voucherCode);
		onOpenChange(false);
	}

	async function simulateScan() {
		finish(await scan.mutateAsync(orderId));
	}

	return (
		<Drawer open={open} onOpenChange={onOpenChange} direction="bottom" variant="rounded" handle>
			<DrawerContent className="right-0 mx-auto max-w-md">
				<DrawerHeader>
					<DrawerTitle>Scan voucher QR</DrawerTitle>
					<DrawerDescription>
						Point the camera at the QR code in the customer&apos;s Fonepoints app.
					</DrawerDescription>
				</DrawerHeader>
				<DrawerBody className="flex flex-col gap-4">
					<div
						aria-hidden
						className="mx-auto flex aspect-square w-full max-w-56 items-center justify-center rounded-xl border-2 border-dashed border-border bg-fill2 text-fg-tertiary"
					>
						<ScanLine className="size-16" strokeWidth={1.25} />
					</div>
					{orderId ? (
						<p className="text-center text-xs text-fg-tertiary">
							Prototype: the camera is simulated.
						</p>
					) : (
						<Alert color="warning" variant="soft">
							<AlertDescription>
								Enter the OMS Order ID first so the scan can match the customer&apos;s voucher.
							</AlertDescription>
						</Alert>
					)}
					{scan.isError && (
						<Alert color="error" variant="soft">
							<AlertDescription>Couldn&apos;t read the QR code. Try again.</AlertDescription>
						</Alert>
					)}
				</DrawerBody>
				<DrawerFooter className="flex-col items-stretch">
					<Button
						size="48"
						className="w-full"
						disabled={!orderId}
						loading={scan.isPending}
						onClick={() => void simulateScan()}
					>
						Simulate scan
					</Button>
					<Button
						size="48"
						className="w-full"
						variant="outline"
						color="neutral"
						disabled={!orderId || scan.isPending}
						onClick={() => finish("WRONG-VOUCHER")}
					>
						Scan a wrong voucher
					</Button>
				</DrawerFooter>
			</DrawerContent>
		</Drawer>
	);
}
