"use client";

import { useState, type ReactNode } from "react";
import { Check, ChevronDown, Contrast } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
	Command,
	CommandEmpty,
	CommandInput,
	CommandItem,
	CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
	APPEARANCE_FONTS,
	APPEARANCE_MODES,
	APPEARANCE_THEMES,
	RESET_APPEARANCE,
	fontById,
	resolveDark,
	themeById,
	type Appearance,
	type AppearanceFont,
	type AppearanceTheme,
} from "@/lib/appearance";
import { cn } from "@/lib/utils";

export interface AppearancePanelProps {
	value: Appearance;
	onChange: (next: Appearance) => void;
}

/** Theme mode / accent / typeface controls with a live preview (Meat-Management). */
export function AppearancePanel({ value, onChange }: AppearancePanelProps) {
	const theme = themeById(value.theme);
	const font = fontById(value.font);
	const dark = resolveDark(value.mode);

	return (
		<div className="flex flex-col gap-6">
			<section className="flex flex-col">
				<div className="flex items-center justify-between gap-3 pb-2">
					<h3 className="text-xs font-medium tracking-wide text-fg-secondary uppercase">
						Theme & typeface
					</h3>
					<Button
						type="button"
						variant="ghost"
						color="neutral"
						size="28"
						onClick={() => onChange(RESET_APPEARANCE)}
					>
						Reset
					</Button>
				</div>

				<SettingRow label="Mode" description="Light, dark, or match the system.">
					<div
						className="inline-flex rounded-lg border border-border bg-bg p-0.5"
						role="group"
						aria-label="Color mode"
					>
						{APPEARANCE_MODES.map((mode) => {
							const selected = value.mode === mode.id;
							return (
								<button
									key={mode.id}
									type="button"
									aria-pressed={selected}
									onClick={() => onChange({ ...value, mode: mode.id })}
									className={cn(
										"h-8 rounded-md px-3 text-sm font-medium transition-colors",
										selected ? "bg-fill2 text-fg" : "text-fg-secondary hover:text-fg",
									)}
								>
									{mode.label}
								</button>
							);
						})}
					</div>
				</SettingRow>

				<SettingRow label="Theme" description="Color accent for the whole app.">
					<ThemePicker
						value={value.theme}
						onChange={(themeId) => onChange({ ...value, theme: themeId })}
					/>
				</SettingRow>

				<SettingRow label="Font" description="UI typeface used across the workspace.">
					<FontPicker
						value={value.font}
						onChange={(fontId) => onChange({ ...value, font: fontId })}
					/>
				</SettingRow>
			</section>

			<section className="flex flex-col gap-3">
				<h3 className="text-xs font-medium tracking-wide text-fg-secondary uppercase">
					Live preview
				</h3>
				<div className="rounded-xl border border-border bg-fill1 p-4">
					<div className="flex items-center justify-between gap-3 text-sm">
						<span className="flex min-w-0 items-center gap-2 font-medium">
							<ThemeSwatch theme={value.theme} />
							<span className="truncate">
								{theme.label} · {font.label}
							</span>
						</span>
						<span className="shrink-0 text-fg-secondary">{dark ? "Dark mode" : "Light mode"}</span>
					</div>
					<p className="mt-4 text-lg font-semibold tracking-tight">The quick brown fox</p>
					<p className="mt-1 text-sm text-fg-secondary">
						Pack my box with five dozen liquor jugs — 0123456789
					</p>
					<div className="mt-4 flex flex-wrap items-center gap-2">
						<Button type="button" size="32">
							Primary
						</Button>
						<Button type="button" size="32" variant="outline" color="neutral">
							Outline
						</Button>
						<Button type="button" size="32" variant="soft" color="neutral">
							Secondary
						</Button>
						<Badge size="24" variant="strong" color="primary">
							Active
						</Badge>
						<span className="px-1.5 text-sm text-fg-tertiary">Inactive</span>
					</div>
				</div>
			</section>
		</div>
	);
}

function SettingRow({
	label,
	description,
	children,
}: {
	label: string;
	description: string;
	children: ReactNode;
}) {
	return (
		<div className="grid gap-3 border-b border-border py-4 sm:grid-cols-2 sm:items-center">
			<div className="space-y-0.5">
				<p className="text-sm font-semibold">{label}</p>
				<p className="text-xs text-fg-secondary">{description}</p>
			</div>
			<div className="justify-self-start sm:justify-self-end">{children}</div>
		</div>
	);
}

function ThemeSwatch({ theme }: { theme: AppearanceTheme }) {
	if (theme === "gray") {
		return (
			<span className="flex size-4 shrink-0 items-center justify-center rounded-full border border-border bg-bg text-fg">
				<Contrast className="size-3" />
			</span>
		);
	}

	const token = themeById(theme).token;
	return (
		<span
			className="size-4 shrink-0 rounded-full border border-border"
			style={{ backgroundColor: `var(--color-${token})` }}
		/>
	);
}

function ThemePicker({
	value,
	onChange,
}: {
	value: AppearanceTheme;
	onChange: (theme: AppearanceTheme) => void;
}) {
	const [open, setOpen] = useState(false);
	const selected = themeById(value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label="Theme"
					className="inline-flex h-9 min-w-44 items-center gap-2 rounded-lg border border-border bg-bg px-2.5 text-sm shadow-xs"
				>
					<ThemeSwatch theme={value} />
					<span className="flex-1 text-left">{selected.label}</span>
					<ChevronDown className="size-4 text-fg-tertiary" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="z-50 w-64 p-0">
				<Command className="border-0 shadow-none">
					<CommandInput placeholder="Search themes..." />
					<CommandList>
						<CommandEmpty>No theme found.</CommandEmpty>
						{APPEARANCE_THEMES.map((theme) => (
							<CommandItem
								key={theme.id}
								value={theme.label}
								onSelect={() => {
									onChange(theme.id);
									setOpen(false);
								}}
							>
								<ThemeSwatch theme={theme.id} />
								<span className="flex-1">{theme.label}</span>
								{theme.id === value ? <Check className="size-4 text-fg-secondary" /> : null}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}

function FontPicker({
	value,
	onChange,
}: {
	value: AppearanceFont;
	onChange: (font: AppearanceFont) => void;
}) {
	const [open, setOpen] = useState(false);
	const selected = fontById(value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger asChild>
				<button
					type="button"
					aria-label="Font"
					className="inline-flex h-9 min-w-44 items-center gap-2 rounded-lg border border-border bg-bg px-2.5 text-sm shadow-xs"
				>
					<span className="flex size-5 items-center justify-center rounded-md border border-border text-xs font-semibold">
						Aa
					</span>
					<span className="flex-1 text-left">{selected.label}</span>
					<ChevronDown className="size-4 text-fg-tertiary" />
				</button>
			</PopoverTrigger>
			<PopoverContent align="end" className="z-50 w-80 p-0">
				<Command className="border-0 shadow-none">
					<CommandInput placeholder="Search fonts..." />
					<CommandList>
						<CommandEmpty>No font found.</CommandEmpty>
						{APPEARANCE_FONTS.map((font) => (
							<CommandItem
								key={font.id}
								value={`${font.label} ${font.description}`}
								onSelect={() => {
									onChange(font.id);
									setOpen(false);
								}}
							>
								<span className="flex size-5 items-center justify-center rounded-md border border-border text-xs font-semibold">
									Aa
								</span>
								<span className="flex min-w-0 flex-1 flex-col">
									<span>{font.label}</span>
									<span className="truncate text-xs text-fg-secondary">{font.description}</span>
								</span>
								{font.id === value ? <Check className="size-4 text-fg-secondary" /> : null}
							</CommandItem>
						))}
					</CommandList>
				</Command>
			</PopoverContent>
		</Popover>
	);
}
