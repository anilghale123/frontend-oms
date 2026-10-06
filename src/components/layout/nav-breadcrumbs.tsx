import { Fragment } from "react";
import Link from "next/link";
import {
	Breadcrumb,
	BreadcrumbItem,
	BreadcrumbLink,
	BreadcrumbList,
	BreadcrumbPage,
	BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export interface BreadcrumbEntry {
	label: string;
	/** Omit for the current page (the last entry). */
	href?: string;
}

export interface NavBreadcrumbsProps {
	items: BreadcrumbEntry[];
	className?: string;
}

/** Breadcrumb trail; entries without `href` render as the current page. Radian `Breadcrumb`. */
export function NavBreadcrumbs({ items, className }: NavBreadcrumbsProps) {
	if (items.length === 0) return null;
	return (
		<Breadcrumb className={className}>
			<BreadcrumbList>
				{items.map((item, i) => (
					<Fragment key={`${item.label}-${i}`}>
						{i > 0 && <BreadcrumbSeparator />}
						<BreadcrumbItem>
							{item.href ? (
								<BreadcrumbLink asChild>
									<Link href={item.href}>{item.label}</Link>
								</BreadcrumbLink>
							) : (
								<BreadcrumbPage>{item.label}</BreadcrumbPage>
							)}
						</BreadcrumbItem>
					</Fragment>
				))}
			</BreadcrumbList>
		</Breadcrumb>
	);
}
