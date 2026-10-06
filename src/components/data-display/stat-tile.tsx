import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { IconComponent } from "@/components/types";

export interface StatTileProps {
	/** What is being counted, e.g. "Failed syncs". */
	label: string;
	/** The number or short value, already formatted. */
	value: ReactNode;
	icon?: IconComponent;
	/** Short change note, e.g. "+3 today". */
	delta?: string;
	/** Colors the delta badge. `neutral` when the change is neither good nor bad. */
	tone?: "success" | "warning" | "error" | "info" | "neutral";
	className?: string;
}

/** One key number with a label, optional icon and delta. Built on Radian `Card` + `Badge`. */
export function StatTile({
	label,
	value,
	icon: Icon,
	delta,
	tone = "neutral",
	className,
}: StatTileProps) {
	return (
		<Card className={cn("gap-2 p-4", className)}>
			<div className="flex items-center justify-between gap-2">
				<span className="truncate text-sm text-fg-secondary">{label}</span>
				{Icon && <Icon className="size-4 shrink-0 text-fg-tertiary" aria-hidden />}
			</div>
			<div className="flex flex-wrap items-baseline gap-2">
				<span className="heading-6 tabular-nums">{value}</span>
				{delta && (
					<Badge variant="soft" size="20" color={tone}>
						{delta}
					</Badge>
				)}
			</div>
		</Card>
	);
}

export interface StatTileGridProps {
	children: ReactNode;
	className?: string;
}

/** Responsive grid for StatTiles: 1 column on phones, 2 on tablets, 4 on desktop. */
export function StatTileGrid({ children, className }: StatTileGridProps) {
	return (
		<div className={cn("grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4", className)}>
			{children}
		</div>
	);
}
