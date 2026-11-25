import type { ReactNode } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";
import { BackArrowIcon } from "./back-arrow-icon";

export interface TopBarProps {
	/** The product or section name, e.g. "Order Management". Not a heading: screens keep their own `h1`. */
	title: ReactNode;
	/** Back link before the title. `label` names the destination, e.g. "Back to Order Management". */
	back?: { href: string; label: string };
	className?: string;
}

/**
 * Full-width bar across the top of a surface: 65px tall, an optional back arrow and the title
 * left-aligned and vertically centred, a 1px bottom line, no shadow or fill of its own.
 */
export function TopBar({ title, back, className }: TopBarProps) {
	return (
		<header
			data-slot="top-bar"
			className={cn(
				"flex h-16.25 shrink-0 items-center gap-2.5 border-b border-line bg-bg px-6",
				className,
			)}
		>
			{back && (
				<Link
					href={back.href}
					aria-label={back.label}
					className="flex h-8 shrink-0 items-center text-field-label focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-field-label"
				>
					<BackArrowIcon className="h-3.75 w-4.5" aria-hidden />
				</Link>
			)}
			<p className="truncate font-heading text-2xl leading-8 font-extrabold text-ink">{title}</p>
		</header>
	);
}
