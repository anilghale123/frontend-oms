import type { ReactNode } from "react";
import {
	Empty,
	EmptyAction,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";
import type { IconComponent } from "@/components/types";

export interface EmptyStateProps {
	/** Icon shown in a tinted tile above the title. */
	icon?: IconComponent;
	title: ReactNode;
	/** What would be here, and how to get it there. */
	description?: ReactNode;
	/** Optional call to action, e.g. a Button. */
	action?: ReactNode;
	/** `bordered` draws a dashed outline, for empty areas inside a page. */
	variant?: "plain" | "bordered";
	className?: string;
}

/** Placeholder for a view with nothing to show yet. Built on Radian `Empty`. */
export function EmptyState({
	icon: Icon,
	title,
	description,
	action,
	variant = "bordered",
	className,
}: EmptyStateProps) {
	return (
		<Empty
			className={cn(variant === "bordered" && "border border-dashed border-border", className)}
		>
			<EmptyHeader>
				{Icon && (
					<EmptyMedia variant="icon">
						<Icon aria-hidden />
					</EmptyMedia>
				)}
				<EmptyTitle>{title}</EmptyTitle>
				{description && <EmptyDescription>{description}</EmptyDescription>}
			</EmptyHeader>
			{action && <EmptyAction>{action}</EmptyAction>}
		</Empty>
	);
}
