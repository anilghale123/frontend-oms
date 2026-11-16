"use client";

import "./globals.css";
import { useEffect, useState } from "react";
import { ErrorState } from "@/components/feedback";
import { APPEARANCE_BOOT_SCRIPT } from "@/lib/appearance";

interface GlobalErrorProps {
	error: Error & { digest?: string };
	/** Fetches and renders the app again. */
	retry: () => void;
}

/** The theme and font classes on `<html>` right now, so the error page keeps them. */
function currentLook() {
	if (typeof document === "undefined")
		return { className: undefined, theme: undefined, font: undefined };
	const root = document.documentElement;
	return { className: root.className, theme: root.dataset.theme, font: root.dataset.font };
}

/**
 * The last resort: the root layout itself failed. Next replaces the whole document with this, so it
 * brings its own `<html>`, `<body>` and stylesheet, and no metadata (a `<title>` instead).
 *
 * Replacing the document would also drop the theme the boot script or the portal put on `<html>`,
 * and a merchant in dark mode would get a white page. So the classes are read before this renders
 * and kept, and the boot script runs again for the case where this is rendered on the server.
 */
export default function GlobalError({ error, retry }: GlobalErrorProps) {
	const [look] = useState(currentLook);

	useEffect(() => {
		console.error("[OMS] the app failed to render", error);
	}, [error]);

	return (
		<html
			lang="en"
			className={look.className}
			data-theme={look.theme}
			data-font={look.font}
			suppressHydrationWarning
		>
			<body className="flex min-h-dvh flex-col justify-center bg-fill1 p-4">
				<title>Something went wrong · Fonepoints OMS</title>
				<script dangerouslySetInnerHTML={{ __html: APPEARANCE_BOOT_SCRIPT }} />
				<ErrorState
					title="OMS couldn’t start"
					description="Try again. If it keeps happening, reopen OMS from the Fonepoints portal."
					onRetry={retry}
				/>
			</body>
		</html>
	);
}
