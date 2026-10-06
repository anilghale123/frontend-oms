import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { AppearanceSync } from "@/components/layout";
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/appearance";
import { QueryProvider } from "@/providers/QueryProvider";
import "./globals.css";

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
});

export const metadata: Metadata = {
	title: "Fonepoints OMS",
	description: "Order management for Fonepoints fulfillment.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
	return (
		<html
			lang="en"
			className={`${geistSans.variable} ${geistMono.variable} ${geistSans.className} h-full antialiased`}
			suppressHydrationWarning
		>
			<body className="flex min-h-full flex-col bg-fill1">
				<script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
				<AppearanceSync />
				{/*
				 * The session is per surface, not global: it is established by `AuthProvider` in
				 * the `(merchant)` and `embed` layouts. The rider portal deliberately has none —
				 * a rider holds a link, not an account — so mounting it here would make `/deliver`
				 * wait on a sign-in it must never need.
				 */}
				<QueryProvider>{children}</QueryProvider>
				{/*
				 * Success and failure feedback for mutations. The design repo had no toast at all —
				 * it shipped `sonner` as a dependency but never imported it, and `CopyButton` used a
				 * tooltip as a stand-in. Styling is driven by the same semantic tokens as the rest of
				 * the app, so it follows light/dark and the selected accent theme.
				 */}
				<Toaster
					position="bottom-right"
					toastOptions={{
						classNames: {
							toast: "bg-bg text-fg border-border rounded-lg",
							description: "text-fg-secondary",
							actionButton: "bg-primary text-primary-fg",
							cancelButton: "bg-fill2 text-fg",
							error: "border-error-border",
							success: "border-success-border",
							warning: "border-warning-border",
							info: "border-info-border",
						},
					}}
				/>
			</body>
		</html>
	);
}
