"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import { ApiError } from "@/lib/api/client";
import { RIDER_VERIFICATION_FAILED } from "@/lib/api/contracts";
import { toErrorMessage } from "@/lib/api/errors";
import type { DeliveryResult } from "../api";
import { useConfirmDelivery } from "../hooks/use-confirm-delivery";
import { deliveryValidationSchema, type DeliveryValidationValues } from "../schema";
import { DeliveryConfirmed } from "./delivery-confirmed";
import { TurnstileWidget } from "./turnstile-widget";

/** Why the last attempt failed, which decides what the rider is told to do next. */
type FailureKind = "rejected" | "verification" | "connection";

const NEXT_STEP: Record<FailureKind, string> = {
	rejected: "Check the Order ID and the voucher code with the customer, then try again.",
	verification: "Complete the security check again, then confirm delivery.",
	connection: "Check your connection, then try again.",
};

/**
 * The rider's delivery confirmation: the Order ID and the customer's voucher code, checked by the
 * Sales service (`POST api/oms/rider/deliver/`). No order details are shown until it succeeds. A
 * wrong pair comes back as the server's own message, with what to do next under it.
 *
 * Confirm delivery stays disabled until the Cloudflare Turnstile check above it succeeds, and
 * locks again whenever that token is gone: expired, failed, or spent by a submission (a token
 * passes Cloudflare once, so every attempt needs a new check).
 */
export function DeliveryValidationForm() {
	const searchParams = useSearchParams();
	const confirm = useConfirmDelivery();
	const [delivered, setDelivered] = useState<{ orderId: string; result: DeliveryResult } | null>(
		null,
	);
	const [failure, setFailure] = useState<{ message: string; kind: FailureKind } | null>(null);
	// A new key draws a new Turnstile widget, so the rider gets a fresh check (and token).
	const [checkRound, setCheckRound] = useState(0);

	const form = useForm<DeliveryValidationValues>({
		resolver: zodResolver(deliveryValidationSchema),
		defaultValues: {
			orderId: searchParams.get("order") ?? "",
			voucherCode: "",
			turnstileToken: "",
		},
	});
	const turnstileToken = useWatch({ control: form.control, name: "turnstileToken" });

	async function handleSubmit(values: DeliveryValidationValues) {
		setFailure(null);
		// This attempt spends the token, so Confirm delivery locks until the next check passes.
		form.setValue("turnstileToken", "");
		try {
			const result = await confirm.mutateAsync(values);
			setDelivered({ orderId: values.orderId, result });
		} catch (error) {
			const kind = failureKind(error);
			setFailure({ message: toErrorMessage(error), kind });
			// The token was spent (or refused) whatever went wrong: run a new check.
			setCheckRound((round) => round + 1);
			if (kind === "rejected") {
				form.setValue("voucherCode", "");
				form.setFocus("voucherCode");
			}
		}
	}

	function reset() {
		setDelivered(null);
		setFailure(null);
		form.reset({ orderId: "", voucherCode: "", turnstileToken: "" });
	}

	if (delivered) {
		return (
			<DeliveryConfirmed orderId={delivered.orderId} result={delivered.result} onReset={reset} />
		);
	}

	const pending = confirm.isPending;

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(handleSubmit)} className="flex flex-col gap-5" noValidate>
				<p className="text-sm text-fg-secondary">
					Ask the customer for the voucher code in their Fonepoints app.
				</p>

				<FormField
					control={form.control}
					name="orderId"
					render={({ field }) => (
						<FormItem>
							<FormLabel>Order ID</FormLabel>
							<FormControl>
								<Input
									{...field}
									size="48"
									placeholder="OMS-0427"
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
							<FormLabel>Voucher code</FormLabel>
							<FormControl>
								<Input
									{...field}
									size="48"
									autoComplete="off"
									spellCheck={false}
									disabled={pending}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>

				<TurnstileWidget
					key={checkRound}
					onToken={(token) => form.setValue("turnstileToken", token ?? "")}
				/>

				{failure && (
					<Alert color="error" variant="soft">
						<AlertContent>
							<AlertTitle>{failure.message}</AlertTitle>
							<AlertDescription>{NEXT_STEP[failure.kind]}</AlertDescription>
						</AlertContent>
					</Alert>
				)}

				<Button
					type="submit"
					size="48"
					className="w-full"
					loading={pending}
					disabled={pending || !turnstileToken}
				>
					Confirm delivery
				</Button>
			</form>
		</Form>
	);
}

/**
 * A refused Turnstile token and a wrong Order ID + voucher pair are both a `400`; the code tells
 * them apart, because only the second one means the voucher was checked. Anything else is the
 * connection or the server.
 */
function failureKind(error: unknown): FailureKind {
	if (!(error instanceof ApiError) || error.status !== 400) return "connection";
	return error.code === RIDER_VERIFICATION_FAILED ? "verification" : "rejected";
}
