// Tier 2 — screen structure and navigation. Domain-agnostic: data arrives through props,
// nothing here fetches or reads the session. See docs/components.md.
export { AppHeader, type AppHeaderProps } from "./app-header";
export { AppShell, type AppShellProps } from "./app-shell";
export { AppSidebar, type AppSidebarProps, type SidebarBrand } from "./app-sidebar";
export { AppearancePanel, type AppearancePanelProps } from "./appearance-panel";
export { AppearanceSync } from "./appearance-sync";
export { MobileShell, type MobileShellProps } from "./mobile-shell";
export { NavBreadcrumbs, type BreadcrumbEntry, type NavBreadcrumbsProps } from "./nav-breadcrumbs";
export { NavMain, type NavMainProps } from "./nav-main";
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
export {
	ProfileDialog,
	type CurrentProfile,
	type ProfileDialogProps,
	type SettingsSection,
} from "./profile-dialog";
export { SidebarProfile, type SidebarProfileProps } from "./sidebar-profile";
export { WorkspaceHeader, type WorkspaceHeaderProps } from "./workspace-header";
export { isNavGroup } from "./types";
export type { NavEntry, NavGroupItem, NavLinkItem, NavSection } from "./types";
