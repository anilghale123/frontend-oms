"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ScanLine } from "lucide-react";
import { Alert, AlertContent, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import type { DeliverySummary, ValidateVoucherResponse } from "@/lib/api/contracts";
import { MAX_VALIDATION_ATTEMPTS, isValidationBlocked } from "@/lib/domain";
import { useSimulateDelivery } from "../hooks/use-simulate-delivery";
import { useValidateVoucher } from "../hooks/use-validate-voucher";
import { deliveryValidationSchema, type DeliveryValidationValues } from "../schema";
import { AttemptsCounter } from "./attempts-counter";
import { DeliveryConfirmed } from "./delivery-confirmed";
import { QrScanSheet } from "./qr-scan-sheet";
import { SimulateDeliveryButton } from "./simulate-delivery-button";

/** What to do next after each failed outcome. The first line comes from the server. */
const NEXT_STEP: Record<Exclude<ValidateVoucherResponse["outcome"], "success">, string> = {
	mismatch: "Check the Order ID and the voucher number with the customer, then try again.",
	already_redeemed: "This order is already delivered. There is nothing more to confirm.",
	redemption_failed: "Fonepoints couldn't redeem the voucher. Wait a moment, then try again.",
	blocked: `All ${MAX_VALIDATION_ATTEMPTS} attempts are used. Ask the merchant to contact Fonepoints support.`,
};

const normalize = (id: string) => id.trim().toUpperCase();

/**
 * The rider's delivery confirmation: OMS Order ID + voucher number (typed or scanned). No order
 * details are shown until validation succeeds. Attempts are counted by the server; this only
 * shows the last count it returned for the Order ID.
 */
export function DeliveryValidationForm() {
	const searchParams = useSearchParams();
	const validate = useValidateVoucher();
	const simulate = useSimulateDelivery();
	const [scanOpen, setScanOpen] = useState(false);
	const [noOrderToSimulate, setNoOrderToSimulate] = useState(false);
	const [delivered, setDelivered] = useState<DeliverySummary | null>(null);
	/** Last server response per Order ID, so switching orders shows that order's count. */
	const [results, setResults] = useState<Record<string, ValidateVoucherResponse>>({});
	const [networkError, setNetworkError] = useState(false);

	const form = useForm<DeliveryValidationValues>({
		resolver: zodResolver(deliveryValidationSchema),
		defaultValues: { omsOrderId: searchParams.get("order") ?? "", voucherCode: "" },
	});
	const omsOrderId = useWatch({ control: form.control, name: "omsOrderId" });
	const last = results[normalize(omsOrderId)];
	const attemptsRemaining = last ? last.attemptsRemaining : null;
	const blocked = attemptsRemaining !== null && isValidationBlocked(attemptsRemaining);

	async function handleSubmit(values: DeliveryValidationValues) {
		setNetworkError(false);
		try {
			const result = await validate.mutateAsync(values);
			if (result.outcome === "success" && result.delivery) {
				setDelivered(result.delivery);
				return;
			}
			setResults((prev) => ({ ...prev, [values.omsOrderId]: result }));
			form.setValue("voucherCode", "");
			form.setFocus("voucherCode");
		} catch {
			setNetworkError(true);
		}
	}

	/** Prototype shortcut: fill the typed (or an out-for-delivery) Order ID and its voucher. It
	 * doesn't submit; the rider still presses Confirm delivery. */
	async function simulateDelivery() {
		setNoOrderToSimulate(false);
		try {
			const pair = await simulate.mutateAsync(normalize(form.getValues("omsOrderId")));
			form.setValue("omsOrderId", pair.omsOrderId, { shouldValidate: true });
			form.setValue("voucherCode", pair.voucherCode, { shouldValidate: true });
			form.setFocus("voucherCode");
		} catch {
			setNoOrderToSimulate(true);
		}
	}

	function reset() {
		setDelivered(null);
		setResults({});
		setNoOrderToSimulate(false);
		form.reset({ omsOrderId: "", voucherCode: "" });
	}

	if (delivered) {
		return <DeliveryConfirmed delivery={delivered} onReset={reset} />;
	}

	const pending = validate.isPending;
	const failureOutcome = last && last.outcome !== "success" ? last.outcome : null;

	return (
		<Form {...form}>
			<form
				onSubmit={form.handleSubmit(handleSubmit)}
				className="flex flex-col gap-5 pb-16"
				noValidate
			>
				<p className="text-sm text-fg-secondary">
					Ask the customer for their voucher number, or scan the QR code in their Fonepoints app.
				</p>

				<FormField
					control={form.control}
					name="omsOrderId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>OMS Order ID</FormLabel>
							<FormControl>
								<Input
									{...field}
									size="48"
									placeholder="OMS-1003"
									autoComplete="off"
									autoCapitalize="characters"
									spellCheck={false}
									disabled={pending}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<FormField
					control={form.control}
					name="voucherCode"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Voucher number</FormLabel>
							<div className="flex gap-2">
								<FormControl>
									<Input
										{...field}
										size="48"
										placeholder="8VMI05"
										autoComplete="off"
										autoCapitalize="characters"
										spellCheck={false}
										disabled={pending || blocked}
										className="min-w-0 flex-1"
									/>
								</FormControl>
								<Button
									size="48"
									variant="outline"
									color="neutral"
									disabled={pending || blocked}
									onClick={() => setScanOpen(true)}
								>
									<ScanLine aria-hidden />
									Scan QR
								</Button>
							</div>
							<FormMessage />
						</FormItem>
					)}
				/>

				<AttemptsCounter attemptsRemaining={attemptsRemaining} />

				{failureOutcome && (
					<Alert color={failureOutcome === "already_redeemed" ? "info" : "error"} variant="soft">
						<AlertContent>
							<AlertTitle>{last?.message}</AlertTitle>
							<AlertDescription>{NEXT_STEP[failureOutcome]}</AlertDescription>
						</AlertContent>
					</Alert>
				)}
				{networkError && (
					<Alert color="error" variant="soft">
						<AlertDescription>
							Couldn&apos;t reach OMS. Check your connection and try again.
						</AlertDescription>
					</Alert>
				)}
				{noOrderToSimulate && (
					<Alert color="warning" variant="soft">
						<AlertDescription>
							No order is out for delivery. Assign a rider to an order, then try again.
						</AlertDescription>
					</Alert>
				)}

				<Button type="submit" size="48" className="w-full" loading={pending} disabled={blocked}>
					Confirm delivery
				</Button>
			</form>

			<SimulateDeliveryButton
				onClick={() => void simulateDelivery()}
				loading={simulate.isPending}
				disabled={pending}
			/>

			<QrScanSheet
				open={scanOpen}
				onOpenChange={setScanOpen}
				omsOrderId={omsOrderId}
				onScan={(code) => form.setValue("voucherCode", code, { shouldValidate: true })}
			/>
		</Form>
	);
}
