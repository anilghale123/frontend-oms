import type { NextConfig } from "next";

/**
 * Origins allowed to embed OMS in an iframe.
 *
 * The Fonepoints Business portal (Angular) hosts OMS at `/embed/*`. A browser refuses to frame a
 * page unless `frame-ancestors` names the host, so this list is what makes the integration work
 * at all. Set `NEXT_PUBLIC_EMBED_HOST_ORIGINS` to a comma-separated list per environment; the
 * default covers the local Angular dev server.
 *
 * `'self'` stays in the list so OMS can still frame its own pages.
 */
const EMBED_HOST_ORIGINS = (
	process.env.NEXT_PUBLIC_EMBED_HOST_ORIGINS || "http://localhost:4200"
)
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

const frameAncestors = ["'self'", ...EMBED_HOST_ORIGINS].join(" ");

const nextConfig: NextConfig = {
	// The dev indicator defaults to bottom-left, where it sits on top of the host portal's sidebar
	// when OMS is embedded. Moved rather than disabled, so compile and runtime errors stay visible.
	devIndicators: { position: "bottom-right" },

	async headers() {
		return [
			{
				// Only the embedded surface is framable. Everything else stays same-origin only,
				// so the standalone dashboard and the rider portal cannot be clickjacked.
				source: "/embed/:path*",
				headers: [
					{ key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors};` },
				],
			},
			{
				source: "/((?!embed).*)",
				headers: [{ key: "Content-Security-Policy", value: "frame-ancestors 'self';" }],
			},
		];
	},
};

export default nextConfig;
