"use client";

import { useRef, useState } from "react";
import { CameraOff } from "lucide-react";
import { Alert, AlertContent, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Drawer,
	DrawerBody,
	DrawerClose,
	DrawerContent,
	DrawerDescription,
	DrawerFooter,
	DrawerHeader,
	DrawerTitle,
} from "@/components/ui/drawer";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";
import { useQrScanner, type CameraError } from "../hooks/use-qr-scanner";
import { parseVoucherQr } from "../schema";

export interface QrScanSheetProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Called with the voucher number read from the customer's QR code. */
	onScan: (voucherCode: string) => void;
}

/** What went wrong with the camera, and what the rider can do instead. */
const CAMERA_ERRORS: Record<CameraError, { title: string; description: string; retry: boolean }> = {
	insecure: {
		title: "The camera needs a secure connection",
		description: "Open the delivery portal over https, or type the voucher number.",
		retry: false,
	},
	unsupported: {
		title: "This browser can't use the camera",
		description: "Type the voucher number instead.",
		retry: false,
	},
	denied: {
		title: "Camera access is blocked",
		description:
			"Allow the camera for this site in your browser settings, then try again. Or type the voucher number.",
		retry: true,
	},
	not_found: {
		title: "No camera found",
		description: "Type the voucher number instead.",
		retry: false,
	},
	in_use: {
		title: "The camera is in use by another app",
		description: "Close the other app, then try again. Or type the voucher number.",
		retry: true,
	},
	failed: {
		title: "Couldn't start the camera",
		description: "Try again, or type the voucher number.",
		retry: true,
	},
};

/** Corner marks of the aiming frame drawn over the camera view. */
const FRAME_CORNERS = [
	"top-0 left-0 rounded-tl-lg border-t-4 border-l-4",
	"top-0 right-0 rounded-tr-lg border-t-4 border-r-4",
	"bottom-0 left-0 rounded-bl-lg border-b-4 border-l-4",
	"right-0 bottom-0 rounded-br-lg border-r-4 border-b-4",
];

/**
 * Bottom sheet with a live camera view. It reads the voucher QR in the customer's Fonepoints app
 * (`{"voucherCode": "…"}`), hands the voucher number to the form and closes. It never submits.
 */
export function QrScanSheet({ open, onOpenChange, onScan }: QrScanSheetProps) {
	return (
		<Drawer open={open} onOpenChange={onOpenChange} direction="bottom" variant="rounded" handle>
			<DrawerContent className="right-0 mx-auto max-w-md">
				<DrawerHeader>
					<DrawerTitle>Scan voucher QR</DrawerTitle>
					<DrawerDescription>
						Point the camera at the QR code in the customer&apos;s Fonepoints app.
					</DrawerDescription>
				</DrawerHeader>
				{/* Mounts with the sheet's content, so every opening starts the camera afresh. */}
				<VoucherScanner
					active={open}
					onScan={(voucherCode) => {
						onScan(voucherCode);
						onOpenChange(false);
					}}
				/>
			</DrawerContent>
		</Drawer>
	);
}

/** Camera view, scan feedback and the sheet's buttons. The camera runs only while `active`, so
 * it turns off as soon as the sheet starts closing. */
function VoucherScanner({
	active,
	onScan,
}: {
	active: boolean;
	onScan: (voucherCode: string) => void;
}) {
	const videoRef = useRef<HTMLVideoElement>(null);
	/** A QR code was read but it isn't a Fonepoints voucher. */
	const [wrongQr, setWrongQr] = useState(false);
	const { state, retry } = useQrScanner({
		videoRef,
		enabled: active,
		onDecode: (text) => {
			const voucherCode = parseVoucherQr(text);
			if (voucherCode) onScan(voucherCode);
			else setWrongQr(true);
		},
	});
	const error = state.status === "error" ? CAMERA_ERRORS[state.error] : null;

	return (
		<>
			<DrawerBody className="flex flex-col gap-4">
				{/* 240px keeps every state, buttons included, on a 360×640 screen; shrink-0 keeps it
				    square when a shorter screen has to scroll. */}
				<div className="relative mx-auto aspect-square w-full max-w-60 shrink-0 overflow-hidden rounded-xl bg-fill2 text-fg-tertiary">
					<video
						ref={videoRef}
						muted
						playsInline
						aria-hidden
						className={cn("size-full object-cover", state.status !== "scanning" && "invisible")}
					/>
					{state.status === "starting" && (
						<div className="absolute inset-0 flex items-center justify-center">
							<Spinner size={32} aria-hidden />
						</div>
					)}
					{state.status === "scanning" && (
						<div aria-hidden className="absolute inset-8">
							{FRAME_CORNERS.map((corner) => (
								<span key={corner} className={cn("absolute size-8 border-primary", corner)} />
							))}
						</div>
					)}
					{error && (
						<div className="absolute inset-0 flex items-center justify-center">
							<CameraOff className="size-16" strokeWidth={1.25} aria-hidden />
						</div>
					)}
				</div>

				{!error && (
					<p role="status" className="text-center text-sm text-fg-secondary">
						{state.status === "starting"
							? "Starting the camera…"
							: "Hold the QR code inside the frame."}
					</p>
				)}
				{error && (
					<Alert color="error" variant="soft">
						<AlertContent>
							<AlertTitle>{error.title}</AlertTitle>
							<AlertDescription>{error.description}</AlertDescription>
						</AlertContent>
					</Alert>
				)}
				{wrongQr && !error && (
					<Alert color="warning" variant="soft">
						<AlertContent>
							<AlertTitle>This isn&apos;t a voucher QR code</AlertTitle>
							<AlertDescription>
								Ask the customer to open the voucher in their Fonepoints app, then scan its QR code.
							</AlertDescription>
						</AlertContent>
					</Alert>
				)}
			</DrawerBody>
			<DrawerFooter className="flex-col items-stretch">
				{error?.retry && (
					<Button
						size="48"
						className="w-full"
						onClick={() => {
							setWrongQr(false);
							retry();
						}}
					>
						Try again
					</Button>
				)}
				<DrawerClose>
					<Button size="48" className="w-full" variant="outline" color="neutral">
						Cancel
					</Button>
				</DrawerClose>
			</DrawerFooter>
		</>
	);
}
