"use client";

import type { ReactNode } from "react";
import { FonepointsLogo } from "@/components/icons/fonepoints-logo";
import { MobileShell } from "@/components/layout";
import { surfaces } from "@/config/nav";

/**
 * Rider portal chrome: mobile-first, single column, no sidebar. The rider has no login (the
 * Order ID + voucher pair is the credential), so there is no role badge and nothing here reads
 * the mock session; the portal can sit in a tab beside the merchant dashboard.
 */
export function RiderShell({ children }: { children: ReactNode }) {
	const { name, product } = surfaces.rider;
	return (
		<MobileShell
			title={
				<span className="flex items-center gap-2">
					<FonepointsLogo className="h-5 w-auto shrink-0 text-fg" />
					<span className="text-sm text-fg-secondary" aria-hidden>
						{product}
					</span>
					<span className="sr-only">{name}</span>
				</span>
			}
		>
			{children}
		</MobileShell>
	);
}
