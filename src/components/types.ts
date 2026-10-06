import type { ComponentType, SVGProps } from "react";

/**
 * Any icon component that accepts SVG props — Lucide icons fit.
 *
 * Lives at the `components/` root rather than inside one purpose folder because all three
 * tier-2 folders take icons as props (`layout/` nav items, `data-display/` stat tiles,
 * `feedback/` empty states).
 */
export type IconComponent = ComponentType<SVGProps<SVGSVGElement>>;
