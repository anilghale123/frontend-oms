"use client";

import { Download, FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportFormat } from "@/lib/utils/export";

export interface ExportMenuProps {
	/** Called with the chosen format; the caller builds and downloads the file. */
	onExport: (format: ExportFormat) => void;
	/** Shown in the menu header, e.g. "248 rows". */
	summary?: string;
	disabled?: boolean;
}

/** "Export" button with CSV and Excel options. */
export function ExportMenu({ onExport, summary, disabled }: ExportMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" color="neutral" size="32" disabled={disabled}>
					<Download aria-hidden />
					Export
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="w-52">
				{summary && <DropdownMenuLabel>{summary}</DropdownMenuLabel>}
				<DropdownMenuItem onSelect={() => onExport("csv")}>
					<FileText aria-hidden />
					Export as CSV
				</DropdownMenuItem>
				<DropdownMenuItem onSelect={() => onExport("xlsx")}>
					<FileSpreadsheet aria-hidden />
					Export as Excel
				</DropdownMenuItem>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
