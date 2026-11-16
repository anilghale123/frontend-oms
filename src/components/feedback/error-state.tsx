import type { ReactNode } from "react";
import { CircleAlert, RotateCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	Empty,
	EmptyAction,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

export interface ErrorStateProps {
	/** What failed, in plain words. */
	title?: ReactNode;
	/** What happened and what to do next. */
	description?: ReactNode;
	/** Shows a "Try again" button. Only pass from client components. */
	onRetry?: () => void;
	/** Disables the retry button while a refetch is running. */
	retrying?: boolean;
	/**
	 * Another way out, after "Try again" (e.g. a link back to a list), or in its place when the
	 * caller needs its own button. Only pass from client components.
	 */
	action?: ReactNode;
	className?: string;
}

/** Shown when a data view fails to load. Built on Radian `Empty` with error tokens. */
export function ErrorState({
	title = "Something went wrong",
	description = "We couldn't load this. Check your connection and try again.",
	onRetry,
	retrying,
	action,
	className,
}: ErrorStateProps) {
	return (
		<Empty role="alert" className={cn("border border-dashed border-error-border", className)}>
			<EmptyHeader>
				<EmptyMedia variant="icon" className="border-error-focus bg-error-accent text-error-text">
					<CircleAlert aria-hidden />
				</EmptyMedia>
				<EmptyTitle>{title}</EmptyTitle>
				<EmptyDescription>{description}</EmptyDescription>
			</EmptyHeader>
			{(onRetry || action) && (
				<EmptyAction>
					{onRetry && (
						<Button
							variant="outline"
							color="neutral"
							size="32"
							onClick={onRetry}
							loading={retrying}
						>
							<RotateCw aria-hidden />
							Try again
						</Button>
					)}
					{action}
				</EmptyAction>
			)}
		</Empty>
	);
}
