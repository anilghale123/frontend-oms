"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { toErrorMessage } from "@/lib/api/errors";
import { assignRiderSchema, type AssignRiderInput, type AssignRiderValues } from "../schema";

const EMPTY: AssignRiderInput = { name: "", phone: "", vehicleNumber: "" };

export interface AssignRiderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Shown in the title, e.g. "OMS-0427". */
	omsOrderId: string;
	/** Prefill, e.g. the rider already on the order. */
	initial?: Partial<AssignRiderInput>;
	/**
	 * Called with the validated rider; the dialog closes once it resolves. A rejection is shown in
	 * the dialog, so the caller should not toast it as well.
	 */
	onSubmit: (values: AssignRiderValues) => Promise<void>;
}

/**
 * Records who is delivering an order. Assigning a rider also moves the order to Delivering, which
 * is why the queue and the "Change status" menu reach Delivering only through here: a plain status
 * change would leave no rider on record (`src/api.md`, "Status flow").
 */
export function AssignRiderDialog({
	open,
	onOpenChange,
	omsOrderId,
	initial,
	onSubmit,
}: AssignRiderDialogProps) {
	const form = useForm<AssignRiderInput, unknown, AssignRiderValues>({
		resolver: zodResolver(assignRiderSchema),
		defaultValues: { ...EMPTY, ...initial },
	});

	useEffect(() => {
		if (open) form.reset({ ...EMPTY, ...initial });
	}, [open, initial, form]);

	async function handleSubmit(values: AssignRiderValues) {
		try {
			await onSubmit(values);
			onOpenChange(false);
		} catch (error) {
			// Shown here rather than as a toast, so the form stays open and nothing is retyped.
			form.setError("root", { message: toErrorMessage(error) });
		}
	}

	const pending = form.formState.isSubmitting;

	return (
		<Dialog open={open} onOpenChange={(next) => !pending && onOpenChange(next)}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Assign a rider to {omsOrderId}</DialogTitle>
					<DialogDescription>
						The order moves to Delivering, and the customer sees it in their order history.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleSubmit)} noValidate>
						<DialogBody className="flex flex-col gap-3">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input {...field} autoComplete="off" disabled={pending} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="phone"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Phone</FormLabel>
										<FormControl>
											<Input
												{...field}
												type="tel"
												inputMode="tel"
												autoComplete="off"
												placeholder="9841122334"
												disabled={pending}
											/>
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							<FormField
								control={form.control}
								name="vehicleNumber"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Vehicle number</FormLabel>
										<FormControl>
											<Input {...field} autoComplete="off" disabled={pending} />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							{form.formState.errors.root?.message && (
								<Alert color="error" variant="soft">
									<AlertDescription>{form.formState.errors.root.message}</AlertDescription>
								</Alert>
							)}
						</DialogBody>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								color="neutral"
								size="36"
								onClick={() => onOpenChange(false)}
								disabled={pending}
							>
								Cancel
							</Button>
							<Button type="submit" size="36" loading={pending}>
								Assign rider
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
