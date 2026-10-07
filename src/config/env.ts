/**
 * Typed environment configuration.
 *
 * Follows the eSewa MiniApp convention of reading every environment value in one module and
 * exporting composed constants, so nothing else in the codebase touches `process.env` or
 * hard-codes a URL (see `.claude/rules/api-client.md`).
 *
 * Next inlines `NEXT_PUBLIC_*` at build time, so these must be read as static property
 * accesses — `process.env[name]` would not be replaced.
 */

/**
 * Base URL of the OMS API.
 *
 * The default is this app's own proxy at `/api/oms`, not the OMS backend's origin. The proxy holds
 * the access token in an httpOnly cookie and attaches it server-side (see
 * `src/app/api/oms/[...path]/route.ts`), which is what keeps the credential out of page
 * JavaScript and means screens make only same-origin requests.
 *
 * Set it to `/api/mock` to run the whole app against the in-repo mock with no backend at all —
 * still useful for UI work, and the reason the mock was kept.
 *
 * Note that `OMS_BACKEND_URL`, where the proxy forwards, is deliberately **not** here: it is
 * server-only and lives in `@/config/server-env`.
 */
export const OMS_API_BASE = process.env.NEXT_PUBLIC_OMS_API_BASE || "/api/oms";

/** True while OMS is served by the in-repo mock rather than the OMS backend. */
export const IS_MOCK_API = OMS_API_BASE.startsWith("/api/mock");

/**
 * Origins allowed to frame OMS and to send it host messages (theme today, the authentication
 * handoff token later — see `auth.md`).
 *
 * `next.config.ts` parses the same variable for the `frame-ancestors` CSP and keeps its own
 * copy: it is loaded before the tsconfig path aliases are applied, so it cannot import this
 * module. Keep the two in sync — they are two halves of one trust decision, and a list that
 * allows framing but not messaging (or the reverse) fails in a way that looks like a bug in the
 * host.
 */
export const EMBED_HOST_ORIGINS = (
	process.env.NEXT_PUBLIC_EMBED_HOST_ORIGINS ||
	"http://localhost:4200,https://fonepoints-business.vercel.app"
)
	.split(",")
	.map((origin) => origin.trim())
	.filter(Boolean);
