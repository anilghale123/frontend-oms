"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import Script from "next/script";
import { Alert, AlertContent, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { TURNSTILE_SCRIPT_URL } from "@/config/constants";
import { TURNSTILE_SITE_KEY } from "@/config/env";

/** The part of Cloudflare's `window.turnstile` this widget uses. */
interface TurnstileApi {
	render(container: HTMLElement, options: Record<string, unknown>): string | undefined;
	reset(widgetId: string): void;
	remove(widgetId: string): void;
}

type CheckStatus = "checking" | "passed" | "failed";

interface TurnstileWidgetProps {
	/**
	 * A token once the check succeeds, `null` whenever there is no usable one: it expired, the
	 * check failed, or the rider asked for a new check. The form enables Confirm delivery only on a
	 * token.
	 */
	onToken: (token: string | null) => void;
}

/**
 * Cloudflare Turnstile, the rider's bot check. Without it the Order ID + voucher pair could be
 * guessed by a script; with it every attempt needs a token that Cloudflare only hands to a
 * browser that passed its check, and `/api/rider/deliver` verifies that token before Sales is
 * asked.
 *
 * The widget is always shown, so the rider sees the check and its result before Confirm delivery
 * enables. It runs in Managed mode (set on the site key in the Cloudflare dashboard): Cloudflare
 * decides whether the rider has to tick its checkbox or passes without one. Tokens are single-use
 * and last five minutes; Cloudflare refreshes an expired one by itself, and the form remounts this
 * widget (a new `key`) after every submission that spent one.
 */
export function TurnstileWidget({ onToken }: TurnstileWidgetProps) {
	const containerRef = useRef<HTMLDivElement>(null);
	const widgetIdRef = useRef<string | null>(null);
	const [scriptReady, setScriptReady] = useState(false);
	const [status, setStatus] = useState<CheckStatus>("checking");

	const emitToken = useEffectEvent((token: string | null) => onToken(token));

	useEffect(() => {
		const turnstile = turnstileApi();
		const container = containerRef.current;
		if (!scriptReady || !turnstile || !container || !TURNSTILE_SITE_KEY) return;

		const widgetId = turnstile.render(container, {
			sitekey: TURNSTILE_SITE_KEY,
			size: "flexible",
			theme: document.documentElement.classList.contains("dark") ? "dark" : "light",
			// The token goes through the form's own state; no hidden input inside the form.
			"response-field": false,
			callback: (token: string) => {
				setStatus("passed");
				emitToken(token);
			},
			// Cloudflare refreshes an expired token by itself (`refresh-expired: auto`).
			"expired-callback": () => {
				setStatus("checking");
				emitToken(null);
			},
			// An unsolved checkbox times out and Cloudflare shows it again (`refresh-timeout: auto`).
			"timeout-callback": () => {
				setStatus("checking");
				emitToken(null);
			},
			// Setting this stops Turnstile throwing; it keeps retrying on its own (`retry: auto`).
			"error-callback": () => {
				setStatus("failed");
				emitToken(null);
			},
		});
		widgetIdRef.current = widgetId ?? null;

		return () => {
			if (widgetId) turnstile.remove(widgetId);
			widgetIdRef.current = null;
		};
	}, [scriptReady]);

	function retry() {
		const widgetId = widgetIdRef.current;
		setStatus("checking");
		onToken(null);
		if (widgetId) turnstileApi()?.reset(widgetId);
	}

	if (!TURNSTILE_SITE_KEY) {
		return (
			<Alert color="error" variant="soft">
				<AlertContent>
					<AlertTitle>Delivery confirmation isn&apos;t set up</AlertTitle>
					<AlertDescription>
						NEXT_PUBLIC_TURNSTILE_SITE_KEY is not set. Set the Turnstile site key for this site and
						rebuild.
					</AlertDescription>
				</AlertContent>
			</Alert>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{/* onReady also runs when the script was already loaded by an earlier mount. */}
			<Script src={TURNSTILE_SCRIPT_URL} onReady={() => setScriptReady(true)} />
			<div ref={containerRef} />
			{status === "checking" && (
				<p className="text-xs text-fg-tertiary" role="status">
					Complete the security check to confirm delivery.
				</p>
			)}
			{status === "failed" && (
				<div className="flex items-center justify-between gap-3" role="alert">
					<p className="text-xs text-error-text">
						The security check didn&apos;t finish. Check your connection.
					</p>
					<Button type="button" variant="outline" color="neutral" size="44" onClick={retry}>
						Try again
					</Button>
				</div>
			)}
		</div>
	);
}

function turnstileApi(): TurnstileApi | undefined {
	return (window as unknown as { turnstile?: TurnstileApi }).turnstile;
}
