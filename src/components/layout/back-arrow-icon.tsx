import type { SVGProps } from "react";

/** The design's back arrow (22×18). Filled with `currentColor`, so a token sets its colour. */
export function BackArrowIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<svg
			width="22"
			height="18"
			viewBox="0 0 22 18"
			fill="none"
			xmlns="http://www.w3.org/2000/svg"
			{...props}
		>
			<path
				d="M22.001 7.577L4.871 7.577L10.435 1.877L8.608 0L0 8.825L8.608 17.65L10.434 15.778L4.87 10.078L22.001 10.078V7.577Z"
				fill="currentColor"
			/>
		</svg>
	);
}
