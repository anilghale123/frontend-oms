/**
 * Typed environment configuration for code that runs in the browser.
 *
 * Follows the eSewa MiniApp convention of reading every environment value in one module and
 * exporting composed constants, so nothing else in the codebase touches `process.env` or
 * hard-codes a URL (see `.claude/rules/api-client.md`). Server-only values live in
 * `@/config/server-env`.
 *
 * Next inlines `NEXT_PUBLIC_*` at build time, so these must be read as static property
 * accesses — `process.env[name]` would not be replaced.
 */

/**
 * Origins allowed to frame OMS and to send it host messages (the theme and the authentication
 * handoff — see `docs/auth-handoff.md`).
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
