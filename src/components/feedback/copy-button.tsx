"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

export interface CopyButtonProps {
	/** Text written to the clipboard. */
	value: string;
	/** What is copied, for the tooltip and accessible name, e.g. "order ID". */
	label: string;
	className?: string;
}

/**
 * Icon button that copies `value` to the clipboard. The icon turns into a check and the tooltip
 * says "Copied" for a moment (there is no toast primitive yet).
 */
export function CopyButton({ value, label, className }: CopyButtonProps) {
	const [copied, setCopied] = useState(false);

	useEffect(() => {
		if (!copied) return;
		const timer = window.setTimeout(() => setCopied(false), 1500);
		return () => window.clearTimeout(timer);
	}, [copied]);

	async function handleCopy() {
		try {
			await navigator.clipboard.writeText(value);
			setCopied(true);
		} catch {
			// Clipboard can be blocked (insecure context, permissions); nothing to recover.
		}
	}

	return (
		<Tooltip open={copied ? true : undefined}>
			<TooltipTrigger asChild>
				<IconButton
					variant="ghost"
					color="neutral"
					size="28"
					aria-label={copied ? "Copied" : `Copy ${label}`}
					onClick={() => void handleCopy()}
					className={className}
				>
					{copied ? <Check aria-hidden /> : <Copy aria-hidden />}
				</IconButton>
			</TooltipTrigger>
			<TooltipContent>{copied ? "Copied" : `Copy ${label}`}</TooltipContent>
		</Tooltip>
	);
}
