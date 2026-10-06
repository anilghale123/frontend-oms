"use client";

import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { Palette, Upload, User, X } from "lucide-react";
import { AppearancePanel } from "@/components/layout/appearance-panel";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DEFAULT_APPEARANCE,
	applyAppearance,
	loadAppearance,
	saveAppearance,
	setAppearanceDrafting,
	type Appearance,
} from "@/lib/appearance";
import { cn } from "@/lib/utils";

export type CurrentProfile = {
	name: string;
	email: string;
	initials: string;
	role: string;
};

export type SettingsSection = "profile" | "appearance";

export interface ProfileDialogProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	profile: CurrentProfile;
	onSave?: (profile: CurrentProfile) => void;
	initialSection?: SettingsSection;
	/** Roles offered in the profile select. */
	roles?: readonly string[];
}

const SECTIONS: {
	id: SettingsSection;
	label: string;
	icon: ComponentType<{ className?: string }>;
}[] = [
	{ id: "profile", label: "Profile", icon: User },
	{ id: "appearance", label: "Appearance", icon: Palette },
];

const DEFAULT_ROLES = ["Merchant", "Owner", "Staff"] as const;

function Field({
	label,
	description,
	badge,
	children,
}: {
	label: string;
	description: string;
	badge?: ReactNode;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-3 border-b border-border py-4 sm:grid-cols-2 sm:items-start">
			<div className="space-y-1">
				<div className="flex flex-wrap items-center gap-2">
					<p className="text-sm font-semibold">{label}</p>
					{badge}
				</div>
				<p className="text-xs text-fg-secondary">{description}</p>
			</div>
			<div>{children}</div>
		</div>
	);
}

function initialsFromName(name: string) {
	const parts = name.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) return "U";
	if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
	return `${parts[0][0] ?? ""}${parts[1][0] ?? ""}`.toUpperCase();
}

/** Profile + appearance settings dialog (Meat-Management pattern). */
export function ProfileDialog({
	open,
	onOpenChange,
	profile,
	onSave,
	initialSection = "profile",
	roles = DEFAULT_ROLES,
}: ProfileDialogProps) {
	const [section, setSection] = useState<SettingsSection>(initialSection);
	const [name, setName] = useState(profile.name);
	const [email, setEmail] = useState(profile.email);
	const [role, setRole] = useState(profile.role);
	const [appearance, setAppearance] = useState<Appearance>(DEFAULT_APPEARANCE);
	const savedAppearance = useRef<Appearance>(DEFAULT_APPEARANCE);
	const committed = useRef(false);

	useEffect(() => {
		if (!open) return;
		const saved = loadAppearance();
		savedAppearance.current = saved;
		committed.current = false;
		setAppearanceDrafting(true);
		// Reset draft fields when the dialog opens (intentional sync from props).
		/* eslint-disable react-hooks/set-state-in-effect -- draft reset on open */
		setSection(initialSection);
		setName(profile.name);
		setEmail(profile.email);
		setRole(profile.role);
		setAppearance(saved);
		/* eslint-enable react-hooks/set-state-in-effect */
		return () => setAppearanceDrafting(false);
	}, [open, initialSection, profile]);

	useEffect(() => {
		if (!open) return;
		applyAppearance(appearance);
	}, [open, appearance]);

	function handleOpenChange(next: boolean) {
		if (!next && !committed.current) {
			applyAppearance(savedAppearance.current);
		}
		if (!next) {
			committed.current = false;
			setAppearanceDrafting(false);
		}
		onOpenChange(next);
	}

	function handleSave() {
		const next: CurrentProfile = {
			name: name.trim() || profile.name,
			email: email.trim().toLowerCase() || profile.email,
			role,
			initials: initialsFromName(name.trim() || profile.name),
		};
		onSave?.(next);
		saveAppearance(appearance);
		savedAppearance.current = appearance;
		committed.current = true;
		onOpenChange(false);
	}

	const sectionLabel = SECTIONS.find((item) => item.id === section)?.label ?? "Profile";
	const roleOptions = roles.includes(role) ? roles : [role, ...roles];

	return (
		<Dialog open={open} onOpenChange={handleOpenChange}>
			<DialogContent className="flex h-svh max-h-svh w-full flex-col gap-0 overflow-hidden p-0 sm:h-160 sm:max-h-160 sm:max-w-4xl">
				<div className="flex min-h-0 flex-1 flex-col sm:flex-row">
					<nav
						aria-label="Settings sections"
						className="flex gap-1 overflow-x-auto border-b border-border p-2 sm:w-54 sm:shrink-0 sm:flex-col sm:overflow-visible sm:border-r sm:border-b-0 sm:p-3"
					>
						{SECTIONS.map((item) => {
							const Icon = item.icon;
							const selected = section === item.id;
							return (
								<button
									key={item.id}
									type="button"
									aria-current={selected ? "page" : undefined}
									onClick={() => setSection(item.id)}
									className={cn(
										"inline-flex h-9 shrink-0 items-center gap-2 rounded-lg px-2.5 text-sm font-medium",
										selected
											? "bg-fill2 text-fg"
											: "text-fg-secondary hover:bg-fill1 hover:text-fg",
									)}
								>
									<Icon className="size-4" />
									{item.label}
								</button>
							);
						})}
					</nav>

					<div className="flex min-h-0 min-w-0 flex-1 flex-col">
						<DialogHeader className="border-b border-border p-4">
							<DialogTitle>{sectionLabel}</DialogTitle>
							<DialogDescription className="sr-only">
								Manage your profile and appearance.
							</DialogDescription>
						</DialogHeader>

						<DialogBody className="min-h-0 flex-1 overflow-y-auto border-t-0">
							{section === "profile" ? (
								<div className="flex flex-col">
									<Field
										label="Profile photo"
										description="A photo helps your teammates recognize you."
									>
										<div className="flex items-center gap-3">
											<Avatar size="48">
												<AvatarFallback className="text-sm">
													{initialsFromName(name || profile.name)}
												</AvatarFallback>
											</Avatar>
											<div className="flex items-center gap-2">
												<Button type="button" variant="outline" color="neutral" size="32">
													<Upload className="size-3.5" />
													Change
												</Button>
												<Button type="button" variant="outline" color="neutral" size="32">
													<X className="size-3.5" />
													Remove
												</Button>
											</div>
										</div>
									</Field>

									<Field label="Full name" description="Your display name in the workspace.">
										<Input value={name} onChange={(event) => setName(event.target.value)} />
									</Field>

									<Field
										label="Email address"
										description="Used for sign-in and notifications."
										badge={
											<Badge size="20" variant="soft" color="success">
												Verified
											</Badge>
										}
									>
										<Input
											type="email"
											value={email}
											onChange={(event) => setEmail(event.target.value)}
										/>
									</Field>

									<Field label="Role" description="Your position within the organization.">
										<Select value={role} onValueChange={setRole}>
											<SelectTrigger>
												<SelectValue placeholder="Select a role" />
											</SelectTrigger>
											<SelectContent>
												{roleOptions.map((item) => (
													<SelectItem key={item} value={item}>
														{item}
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</Field>
								</div>
							) : (
								<AppearancePanel value={appearance} onChange={setAppearance} />
							)}
						</DialogBody>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								color="neutral"
								onClick={() => handleOpenChange(false)}
							>
								Cancel
							</Button>
							<Button type="button" onClick={handleSave}>
								Save changes
							</Button>
						</DialogFooter>
					</div>
				</div>
			</DialogContent>
		</Dialog>
	);
}
