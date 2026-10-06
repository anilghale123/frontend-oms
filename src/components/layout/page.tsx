import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { PageHeader, type PageHeaderProps } from "./page-header";

export interface PageProps extends Omit<PageHeaderProps, "className"> {
	/** Usually a single `<PageBody>`. */
	children: ReactNode;
	className?: string;
}

/**
 * Outer frame of every screen: PageHeader then body.
 * Padding lives on AppShell so pages don't double-pad against the Meat layout.
 * Take `title` from the route in the nav config, never a string typed into the page.
 */
export function Page({ children, className, ...header }: PageProps) {
	return (
		<div data-slot="page" className={cn("flex flex-1 flex-col gap-3", className)}>
			<PageHeader {...header} />
			{children}
		</div>
	);
}

export interface PageBodyProps {
	children: ReactNode;
	className?: string;
}

/** Content area under the PageHeader: a vertical stack that fills the remaining height. */
export function PageBody({ children, className }: PageBodyProps) {
	return (
		<div data-slot="page-body" className={cn("flex flex-1 flex-col gap-4", className)}>
			{children}
		</div>
	);
}
