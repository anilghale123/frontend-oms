"use client";

import { useId, useState, type FormEvent } from "react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toErrorMessage } from "@/lib/api/errors";
import type { Order } from "@/lib/domain";
import { useVerifyVoucher } from "../../hooks/use-verify-voucher";

export interface VerifyVoucherSectionProps {
	order: Pick<Order, "omsOrderId" | "referenceId">;
}

/**
 * "Verify Voucher Code" block under the fulfillment tracker, shown only while the order is
 * Delivering. It checks the code the way the rider's form does (`rider/deliver`, through
 * `/api/oms/orders/{id}/verify-voucher`): when the customer's code matches, the server marks the
 * order Delivered and the screen follows. Nothing else moves an order to Delivered.
 *
 * Ticket illustration, heading and hint, then the code input with its button: 545px wide on
 * desktop; the input shrinks first and the button wraps below it only when the card is too narrow
 * for both.
 */
export function VerifyVoucherSection({ order }: VerifyVoucherSectionProps) {
	const inputId = useId();
	const { verify, pending } = useVerifyVoucher(order);
	const [code, setCode] = useState("");
	const [error, setError] = useState<string | null>(null);

	const canVerify = Boolean(code.trim()) && !pending;

	async function handleSubmit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (!canVerify) return;
		setError(null);
		try {
			await verify(code.trim());
		} catch (cause) {
			setError(toErrorMessage(cause));
		}
	}

	return (
		<section
			aria-labelledby={`${inputId}-heading`}
			className="flex w-full max-w-136.25 flex-col gap-6 rounded-lg bg-bg pt-6"
		>
			<div className="flex items-start gap-6">
				<Image
					src="/illustrations/verify-voucher.svg"
					alt=""
					width={82}
					height={72}
					unoptimized
					className="h-18 w-20.5 shrink-0"
				/>
				<div className="flex min-w-0 flex-1 flex-col gap-2.5">
					<h3
						id={`${inputId}-heading`}
						className="text-2xl leading-8 font-extrabold tracking-normal text-ink"
					>
						Verify Voucher Code
					</h3>
					<p className="text-base leading-6 font-normal text-ink-secondary">
						Enter the voucher code provided by your customer
					</p>
				</div>
			</div>
			<form onSubmit={handleSubmit} className="flex flex-col gap-3">
				<div className="flex flex-wrap items-center gap-4">
					<Label htmlFor={inputId} className="sr-only">
						Voucher code
					</Label>
					<Input
						id={inputId}
						size="32"
						autoComplete="off"
						autoCapitalize="characters"
						spellCheck={false}
						placeholder="Enter Voucher Code"
						value={code}
						disabled={pending}
						aria-invalid={error ? true : undefined}
						aria-describedby={error ? `${inputId}-error` : undefined}
						onChange={(event) => setCode(event.target.value.toUpperCase())}
						className="min-w-0 flex-1 basis-40 placeholder:text-field-muted"
					/>
					<Button
						type="submit"
						variant="strong"
						color="primary"
						size="36"
						disabled={!canVerify}
						className="h-8.5 w-36.5 shrink-0 rounded-control px-4 py-2 normal-case"
					>
						Verify Voucher Code
					</Button>
				</div>
				{error && (
					<p
						id={`${inputId}-error`}
						role="alert"
						className="text-xs leading-3.5 font-normal text-field-error"
					>
						{error}
					</p>
				)}
			</form>
		</section>
	);
}
