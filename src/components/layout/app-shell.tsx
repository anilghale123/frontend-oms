import type { ReactNode } from "react";
import { SidebarProvider } from "@/components/ui/sidebar";

export interface AppShellProps {
	/** Usually an `AppSidebar`. */
	sidebar: ReactNode;
	/** Usually an `AppHeader`. */
	header: ReactNode;
	children: ReactNode;
	/** Whether the sidebar starts expanded on desktop. */
	defaultOpen?: boolean;
	/** Initial sidebar width. Default `15rem`, a little narrower than Radian's `16.25rem`. */
	defaultWidth?: string;
}

/**
 * Desktop app frame following Radian block sidebar-04: inset sidebar, borderless top bar,
 * and page content in a rounded card that scrolls on its own.
 */
export function AppShell({
	sidebar,
	header,
	children,
	defaultOpen = true,
	defaultWidth = "14rem",
}: AppShellProps) {
	return (
		<SidebarProvider
			defaultOpen={defaultOpen}
			defaultWidth={defaultWidth}
			className="h-svh overflow-hidden bg-bg"
		>
			{sidebar}
			<div data-slot="app-shell" className="flex h-svh min-w-0 flex-1 flex-col">
				{header}
				<div className="flex min-h-0 flex-1 px-2 pb-2 md:pl-0">
					<main className="flex flex-1 flex-col gap-3 overflow-y-auto rounded-2xl border border-soft bg-fill1 px-3 py-3 md:px-4 md:py-4">
						{children}
					</main>
				</div>
			</div>
		</SidebarProvider>
	);
}
