/**
 * Route prefix of the embedded surface, where the Fonepoints Business portal supplies the chrome.
 *
 * It decides more than routing: on this surface the host owns the appearance, so
 * `hostOwnsAppearance()` in `@/lib/appearance` keys off it (see `auth.md` section 9).
 */
export const EMBED_BASE_PATH = "/embed";

/**
 * Where screens send merchant-portal requests: this app's own proxy, not the Sales service. The
 * proxy holds the access token in an httpOnly cookie and attaches it server-side
 * (`src/app/api/oms/[...path]/route.ts`), which keeps the credential out of page JavaScript and
 * means screens make only same-origin requests.
 */
export const OMS_API_BASE = "/api/oms";

/**
 * Where the rider portal sends its voucher check: a separate route, because a rider has no
 * account and so no session cookie (`src/app/api/rider/deliver/route.ts`).
 */
export const RIDER_API_BASE = "/api/rider";
