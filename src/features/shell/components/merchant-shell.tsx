"use client";

import type { ReactNode } from "react";
import { AppShell, AppSidebar, SidebarProfile } from "@/components/layout";
import { merchantNav, surfaces } from "@/config/nav";
import { useMerchant } from "@/providers/AuthProvider";
import { ShellHeader } from "./shell-header";

export interface MerchantShellProps {
	children: ReactNode;
}

/**
 * Merchant surface chrome: sidebar (with the merchant company in the footer) + header.
 *
 * The company in the footer comes from the access token's merchant, not from a local role: the
 * sidebar now shows who the session actually belongs to. It is never null in practice, because
 * `SessionGate` renders this only once the session is authenticated.
 */
export function MerchantShell({ children }: MerchantShellProps) {
	const { name, product, home } = surfaces.merchant;
	const merchant = useMerchant();

	return (
		<AppShell
			sidebar={
				<AppSidebar
					brand={{ name, product, href: home }}
					sections={merchantNav}
					footer={
						merchant ? (
							<SidebarProfile
								name={merchant.companyName}
								detail={merchant.location}
								logoUrl={merchant.logoUrl}
							/>
						) : null
					}
				/>
			}
			header={<ShellHeader />}
		>
			{children}
		</AppShell>
	);
}
