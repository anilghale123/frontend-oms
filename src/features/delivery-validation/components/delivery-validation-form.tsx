"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
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
import { toErrorMessage } from "@/lib/api/errors";
import type { DeliveryResult } from "../api";
import { useConfirmDelivery } from "../hooks/use-confirm-delivery";
import { deliveryValidationSchema, type DeliveryValidationValues } from "../schema";
import { DeliveryConfirmed } from "./delivery-confirmed";

/**
 * The rider's delivery confirmation: the Order ID and the customer's voucher code, checked by the
 * Sales service (`POST api/oms/rider/deliver/`). No order details are shown until it succeeds. A
 * wrong pair comes back as the server's own message, with what to do next under it.
 */
export function DeliveryValidationForm() {
	const searchParams = useSearchParams();
	const confirm = useConfirmDelivery();
	const [delivered, setDelivered] = useState<{ orderId: string; result: DeliveryResult } | null>(
		null,
	);
	const [failure, setFailure] = useState<{ message: string; rejected: boolean } | null>(null);

	const form = useForm<DeliveryValidationValues>({
		resolver: zodResolver(deliveryValidationSchema),
		defaultValues: { orderId: searchParams.get("order") ?? "", voucherCode: "" },
	});

	async function handleSubmit(values: DeliveryValidationValues) {
		setFailure(null);
		try {
			const result = await confirm.mutateAsync(values);
			setDelivered({ orderId: values.orderId, result });
		} catch (error) {
			// A 400 is the server saying the pair is wrong; anything else is the connection.
			const rejected = error instanceof ApiError && error.status === 400;
			setFailure({ message: toErrorMessage(error), rejected });
			if (rejected) {
				form.setValue("voucherCode", "");
				form.setFocus("voucherCode");
			}
		}
	}

	function reset() {
		setDelivered(null);
		setFailure(null);
		form.reset({ orderId: "", voucherCode: "" });
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

				{failure && (
					<Alert color="error" variant="soft">
						<AlertContent>
							<AlertTitle>{failure.message}</AlertTitle>
							<AlertDescription>
								{failure.rejected
									? "Check the Order ID and the voucher code with the customer, then try again."
									: "Check your connection, then try again."}
							</AlertDescription>
						</AlertContent>
					</Alert>
				)}

				<Button type="submit" size="48" className="w-full" loading={pending}>
					Confirm delivery
				</Button>
			</form>
		</Form>
	);
}
