"use client";

import { Check, Rows3 } from "lucide-react";
import { IconButton } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { DATA_TABLE_ROW_SIZES, type DataTableRowSize } from "./data-table-styles";

export interface DataTableRowSizeMenuProps {
	value: DataTableRowSize;
	onValueChange: (size: DataTableRowSize) => void;
}

/** "Row size" icon button with five densities (Meat-Management pattern). */
export function DataTableRowSizeMenu({ value, onValueChange }: DataTableRowSizeMenuProps) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<IconButton
					variant="outline"
					color="neutral"
					size="32"
					aria-label="Row size"
					title="Row size"
				>
					<Rows3 />
				</IconButton>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end" className="min-w-40">
				<DropdownMenuGroup>
					<DropdownMenuLabel>Row size</DropdownMenuLabel>
					{DATA_TABLE_ROW_SIZES.map((size) => (
						<DropdownMenuItem key={size.value} onSelect={() => onValueChange(size.value)}>
							<span>{size.label}</span>
							{value === size.value ? (
								<Check className="ml-auto size-4" aria-hidden />
							) : (
								<span className="ml-auto size-4" aria-hidden />
							)}
						</DropdownMenuItem>
					))}
				</DropdownMenuGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
