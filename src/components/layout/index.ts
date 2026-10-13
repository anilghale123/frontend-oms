// Tier 2 — screen structure and navigation. Domain-agnostic: data arrives through props,
// nothing here fetches or reads the session. See docs/components.md.
export { AppearanceSync } from "./appearance-sync";
export { MobileShell, type MobileShellProps } from "./mobile-shell";
export { NavTabs, type NavTabsProps } from "./nav-tabs";
export { Page, PageBody, type PageBodyProps, type PageProps } from "./page";
export { PageHeader, type PageHeaderProps } from "./page-header";
export {
	Panel,
	PanelContent,
	PanelHeader,
	PanelHint,
	PanelTitle,
	type PanelContentProps,
	type PanelHeaderProps,
	type PanelHintProps,
	type PanelProps,
	type PanelTitleProps,
} from "./panel";
export { isNavGroup } from "./types";
export type { NavEntry, NavGroupItem, NavLinkItem, NavSection } from "./types";
