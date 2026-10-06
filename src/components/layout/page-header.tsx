import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface PageHeaderProps {
	/** Page title, rendered as the page's only `h1`. No subtext line: the title stands alone. */
	title: ReactNode;
	/** Back link before the title, for detail pages. `label` names the destination, e.g. "Back to Order Queue". */
	back?: { href: string; label: string };
	/** Small count chip after the title, e.g. the number of rows in a list. */
	count?: number | string;
	/** Extra element after the title, e.g. a status badge. */
	badge?: ReactNode;
	/** Primary and secondary actions, right-aligned on wide screens. */
	actions?: ReactNode;
	className?: string;
}

/** Title row matching Meat-Management: compact base title, not a large heading. */
export function PageHeader({ title, back, count, badge, actions, className }: PageHeaderProps) {
	return (
		<div
			data-slot="page-header"
			className={cn(
				"flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between",
				className,
			)}
		>
			<div className="flex min-w-0 flex-wrap items-center gap-2">
				{back && (
					<IconButton variant="ghost" color="neutral" size="28" aria-label={back.label} asChild>
						<Link href={back.href}>
							<ArrowLeft aria-hidden />
						</Link>
					</IconButton>
				)}
				<h1 className="truncate text-base font-semibold tracking-tight">{title}</h1>
				{count !== undefined && (
					<span className="rounded-md bg-fill1 px-1.5 py-0.5 text-xs font-medium text-fg-secondary tabular-nums">
						{count}
					</span>
				)}
				{badge}
			</div>
			{actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
		</div>
	);
}
