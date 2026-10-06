"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
import type { RiderDetails } from "@/lib/domain";
import { assignRiderSchema, type AssignRiderValues } from "../schema";

export interface AssignRiderDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** Prefill when editing an existing assignment. */
	initial?: RiderDetails | null;
	/** Called with validated rider details; close the dialog after it resolves. */
	onSubmit: (values: AssignRiderValues) => Promise<void>;
	/** Button label while idle. */
	submitLabel?: string;
}

/** Dialog to capture rider name, phone, and vehicle (all required). */
export function AssignRiderDialog({
	open,
	onOpenChange,
	initial,
	onSubmit,
	submitLabel = "Assign and start delivery",
}: AssignRiderDialogProps) {
	const form = useForm<AssignRiderValues>({
		resolver: zodResolver(assignRiderSchema),
		defaultValues: {
			name: initial?.name ?? "",
			phone: initial?.phone ?? "",
			vehicleNumber: initial?.vehicleNumber ?? "",
		},
	});

	useEffect(() => {
		if (open) {
			form.reset({
				name: initial?.name ?? "",
				phone: initial?.phone ?? "",
				vehicleNumber: initial?.vehicleNumber ?? "",
			});
		}
	}, [open, initial, form]);

	async function handleSubmit(values: AssignRiderValues) {
		await onSubmit(values);
		onOpenChange(false);
	}

	const pending = form.formState.isSubmitting;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Assign rider</DialogTitle>
					<DialogDescription>
						Name, phone, and vehicle number are all required before delivery can start.
					</DialogDescription>
				</DialogHeader>
				<Form {...form}>
					<form onSubmit={form.handleSubmit(handleSubmit)}>
						<DialogBody className="flex flex-col gap-3">
							<FormField
								control={form.control}
								name="name"
								render={({ field }) => (
									<FormItem>
										<FormLabel>Name</FormLabel>
										<FormControl>
											<Input {...field} autoComplete="name" />
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
											<Input {...field} type="tel" autoComplete="tel" />
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
											<Input {...field} autoComplete="off" />
										</FormControl>
										<FormMessage />
									</FormItem>
								)}
							/>
							{form.formState.errors.root && (
								<p className="text-xs text-error-text">{form.formState.errors.root.message}</p>
							)}
						</DialogBody>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								color="neutral"
								size="32"
								onClick={() => onOpenChange(false)}
								disabled={pending}
							>
								Cancel
							</Button>
							<Button type="submit" size="32" loading={pending}>
								{submitLabel}
							</Button>
						</DialogFooter>
					</form>
				</Form>
			</DialogContent>
		</Dialog>
	);
}
