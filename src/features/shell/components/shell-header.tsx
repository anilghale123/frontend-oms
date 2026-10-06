"use client";

import { useCallback, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { LogOut, Settings, SunMoon, User } from "lucide-react";
import {
	AppHeader,
	NavBreadcrumbs,
	ProfileDialog,
	type CurrentProfile,
	type SettingsSection,
} from "@/components/layout";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuDivider,
	DropdownMenuShortcut,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { breadcrumbsFor, surfaces } from "@/config/nav";
import { toggleDarkMode } from "@/lib/appearance";

const DEFAULT_PROFILE: CurrentProfile = {
	name: "Merchant User",
	email: "merchant@fonepoints.local",
	initials: "MU",
	role: "Merchant",
};

export interface ShellHeaderProps {
	actions?: ReactNode;
}

function useModKeyLabel() {
	return useSyncExternalStore(
		() => () => {},
		() => (/Mac|iPhone|iPad|iPod/.test(navigator.platform) ? "⌘" : "Ctrl"),
		() => "Ctrl",
	);
}

/** Merchant header beside the sidebar: mobile trigger, breadcrumbs, profile + appearance menu. */
export function ShellHeader({ actions }: ShellHeaderProps = {}) {
	const pathname = usePathname();
	const mod = useModKeyLabel();
	const { name, home } = surfaces.merchant;
	const crumbs = breadcrumbsFor("merchant", pathname);
	const breadcrumbItems =
		crumbs.length > 0 ? [{ label: name, href: home }, ...crumbs] : [{ label: name }];

	const [profileOpen, setProfileOpen] = useState(false);
	const [settingsSection, setSettingsSection] = useState<SettingsSection>("profile");
	const [profile, setProfile] = useState<CurrentProfile>(DEFAULT_PROFILE);

	const openSettings = useCallback((section: SettingsSection) => {
		setSettingsSection(section);
		setProfileOpen(true);
	}, []);

	useEffect(() => {
		const onKeyDown = (event: KeyboardEvent) => {
			if (!(event.metaKey || event.ctrlKey) || !event.shiftKey) return;
			const target = event.target as HTMLElement | null;
			const tag = target?.tagName;
			if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target?.isContentEditable) {
				return;
			}
			const key = event.key.toLowerCase();
			if (key === "p") {
				event.preventDefault();
				openSettings("profile");
			}
		};
		window.addEventListener("keydown", onKeyDown);
		return () => window.removeEventListener("keydown", onKeyDown);
	}, [openSettings]);

	return (
		<>
			<AppHeader
				variant="inset"
				leading={
					<>
						<SidebarTrigger />
						<NavBreadcrumbs items={breadcrumbItems} />
					</>
				}
				actions={
					actions ?? (
						<>
							<Badge size="24" variant="soft" color="neutral" className="hidden sm:inline-flex">
								{profile.role}
							</Badge>
							<DropdownMenu>
								<DropdownMenuTrigger asChild>
									<button
										type="button"
										className="focus-visible:ring-ring/30 inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-full outline-none focus-visible:ring-2"
										aria-label="User menu"
									>
										<Avatar size="36">
											<AvatarFallback className="text-xs">{profile.initials}</AvatarFallback>
										</Avatar>
									</button>
								</DropdownMenuTrigger>
								<DropdownMenuContent align="end" className="w-64">
									<DropdownMenuGroup>
										<DropdownMenuItem className="p-0" onSelect={() => openSettings("profile")}>
											<div className="flex w-full items-center gap-2 px-1.5 py-1.5">
												<Avatar size="32">
													<AvatarFallback>{profile.initials}</AvatarFallback>
												</Avatar>
												<div className="flex min-w-0 flex-col">
													<span className="flex items-center gap-1.5">
														<span className="truncate text-sm font-semibold">{profile.name}</span>
														<Badge size="20" variant="soft" color="neutral">
															{profile.role}
														</Badge>
													</span>
													<span className="truncate text-xs text-fg-secondary">
														{profile.email}
													</span>
												</div>
											</div>
										</DropdownMenuItem>
										<DropdownMenuDivider />
										<DropdownMenuItem onSelect={() => openSettings("profile")}>
											<User />
											Profile
											<DropdownMenuShortcut>⇧{mod}P</DropdownMenuShortcut>
										</DropdownMenuItem>
										<DropdownMenuItem onSelect={() => openSettings("appearance")}>
											<Settings />
											Settings
										</DropdownMenuItem>
										<DropdownMenuItem onSelect={toggleDarkMode}>
											<SunMoon />
											Switch theme
											<DropdownMenuShortcut>D</DropdownMenuShortcut>
										</DropdownMenuItem>
										<DropdownMenuDivider />
										<DropdownMenuItem disabled>
											<LogOut />
											Sign Out
										</DropdownMenuItem>
									</DropdownMenuGroup>
								</DropdownMenuContent>
							</DropdownMenu>
						</>
					)
				}
			/>

			<ProfileDialog
				open={profileOpen}
				onOpenChange={setProfileOpen}
				profile={profile}
				onSave={setProfile}
				initialSection={settingsSection}
			/>
		</>
	);
}
