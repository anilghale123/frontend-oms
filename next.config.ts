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
	process.env.NEXT_PUBLIC_EMBED_HOST_ORIGINS ||
	"http://localhost:4200,https://fonepoints-business.vercel.app"
)
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);

const frameAncestors = ["'self'", ...EMBED_HOST_ORIGINS].join(" ");

/**
 * Sent on every response. None of them changes what a page can do today; each closes a door:
 *
 * - `nosniff` — a response is only ever read as the type it says it is.
 * - `Referrer-Policy` — an order URL (`/embed/orders/{referenceId}`) is not sent in full to another
 *   site, e.g. Cloudflare when the rider page loads Turnstile.
 * - `Strict-Transport-Security` — once seen over HTTPS, the browser never tries HTTP again. Browsers
 *   ignore it on plain-HTTP responses, so `next dev` on localhost is unaffected.
 * - `Permissions-Policy` — no screen uses the camera, microphone or location, so nothing loaded into
 *   OMS can ask for them.
 *
 * A `script-src` policy is not here yet: React streams inline scripts on every page, so it needs a
 * per-request nonce and a report-only trial before it is enforced.
 */
const SECURITY_HEADERS = [
	{ key: "X-Content-Type-Options", value: "nosniff" },
	{ key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
	{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

/**
 * `Permissions-Policy`: nothing loaded into OMS can use the camera, microphone or location, except
 * the rider's voucher scan, which opens the camera on `/deliver`. A browser that is told
 * `camera=()` refuses the camera before it ever asks the rider, which looks like "camera access is
 * blocked", so that one page allows its own origin (`self`) and nothing else does.
 */
const NO_DEVICE_ACCESS = "camera=(), microphone=(), geolocation=()";
const RIDER_DEVICE_ACCESS = "camera=(self), microphone=(), geolocation=()";

const nextConfig: NextConfig = {
	// A self-contained server folder (`.next/standalone`) for the Docker image. Vercel ignores it.
	output: "standalone",

	// The dev indicator defaults to bottom-left, where it sits on top of the host portal's sidebar
	// when OMS is embedded. Moved rather than disabled, so compile and runtime errors stay visible.
	devIndicators: { position: "bottom-right" },

	// No `X-Powered-By: Next.js`: there is no reason to tell every caller what the server runs.
	poweredByHeader: false,

	async headers() {
		return [
			{ source: "/:path*", headers: SECURITY_HEADERS },
			{
				source: "/deliver",
				headers: [{ key: "Permissions-Policy", value: RIDER_DEVICE_ACCESS }],
			},
			{
				source: "/((?!deliver).*)",
				headers: [{ key: "Permissions-Policy", value: NO_DEVICE_ACCESS }],
			},
			{
				// Only the embedded surface is framable. Everything else stays same-origin only,
				// so the rider portal and the landing page cannot be clickjacked.
				source: "/embed/:path*",
				headers: [
					{ key: "Content-Security-Policy", value: `frame-ancestors ${frameAncestors};` },
				],
			},
			{
				// The portal loads this in a hidden iframe at sign-out to delete OMS's cookies, so
				// it is framable by the same origins as `/embed/*`.
				source: "/embed-signout",
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
