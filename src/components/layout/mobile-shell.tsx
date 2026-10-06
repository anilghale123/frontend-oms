import type { ReactNode } from "react";

export interface MobileShellProps {
	/** App or task name shown in the top bar. */
	title: ReactNode;
	/** Small element on the left of the title, e.g. a logo tile. */
	leading?: ReactNode;
	/** Right side of the top bar, e.g. a help link. */
	actions?: ReactNode;
	children: ReactNode;
}

/**
 * Mobile-first frame for single-task flows: a compact top bar and one centered column,
 * designed at 360px and capped at `max-w-md` on larger screens. No sidebar.
 */
export function MobileShell({ title, leading, actions, children }: MobileShellProps) {
	return (
		<div data-slot="mobile-shell" className="flex min-h-svh flex-1 flex-col bg-fill1">
			<header className="sticky top-0 z-10 border-b border-border bg-bg">
				<div className="mx-auto flex h-14 w-full max-w-md items-center justify-between gap-3 px-4">
					<div className="flex min-w-0 items-center gap-2.5">
						{leading}
						<span className="truncate font-heading text-base font-semibold">{title}</span>
					</div>
					{actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
				</div>
			</header>
			<main className="mx-auto flex w-full max-w-md flex-1 flex-col px-4 py-4">{children}</main>
		</div>
	);
}
