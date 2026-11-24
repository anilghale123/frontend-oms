import type { Metadata } from "next";
import { Geist, Geist_Mono, Nunito, Source_Sans_3 } from "next/font/google";
import { Toaster } from "sonner";
import { AppearanceSync } from "@/components/layout";
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/appearance";
import { QueryProvider } from "@/providers/QueryProvider";
import "./globals.css";

/**
 * The Fonepoints brand typeface (Nunito, not Nunito Sans), and the default. Only the weights the
 * design uses are loaded, so every weight on screen is a real face and never browser-synthesized.
 */
const nunito = Nunito({
	variable: "--font-nunito",
	subsets: ["latin"],
	weight: ["400", "500", "600", "700", "800"],
});

/** Still loaded for the "Geist" font the portal or a stored appearance may choose. */
const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
});

/**
 * Primary and Secondary buttons only. Source Sans Pro was renamed Source Sans 3; it is the same
 * family and is what Google Fonts serves.
 */
const sourceSans = Source_Sans_3({
	variable: "--font-source-sans",
	subsets: ["latin"],
	weight: ["700"],
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
			className={`${nunito.variable} ${sourceSans.variable} ${geistSans.variable} ${geistMono.variable} ${nunito.className} h-full antialiased`}
			suppressHydrationWarning
		>
			<body className="flex min-h-full flex-col bg-fill1">
				<script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
				<AppearanceSync />
				{/*
				 * The session is per surface, not global: it is established by `AuthProvider` in
				 * the `embed` layout. The rider portal deliberately has none —
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
