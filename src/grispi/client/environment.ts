/**
 * CORE-04 — the single legitimate home for every environment-dependent
 * Grispi API host. No other file under `src/` may hardcode one of these
 * literals (see 04.1-01-PLAN.md threat T-04.1-01/T-04.1-02).
 */
export const GRISPI_BASE_URLS = {
  preprod: "https://api.grispi.net",
  prod: "https://api.grispi.com",
  prod_tr: "https://api.grispi.com.tr",
} as const;

export type GrispiEnvironment = keyof typeof GRISPI_BASE_URLS;

/** Safe-side default when no environment can be resolved — prod, not preprod. */
export const DEFAULT_ENVIRONMENT: GrispiEnvironment = "prod";

/**
 * Strict allowlist guard for untrusted environment values (`_grispi_env`
 * tenant setting, `REACT_APP_DEV_GRISPI_ENV`) — T-04.1-01.
 *
 * Deliberately uses `Object.prototype.hasOwnProperty.call` and NOT the `in`
 * operator: `in` walks the prototype chain, so `__proto__`, `constructor`,
 * `toString`, `valueOf` and `hasOwnProperty` would all pass the allowlist and
 * then be used as lookup keys into `GRISPI_BASE_URLS`. That yields
 * `Object.prototype` / a native function instead of a host string, which
 * `fetch()` resolves relative to the plugin's own origin — leaking the
 * agent's `Authorization: Bearer` header off-host.
 */
export const isGrispiEnvironment = (
  value: unknown
): value is GrispiEnvironment => {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(GRISPI_BASE_URLS, value)
  );
};

/**
 * D-07 agent-UI deep-link helpers. NOT for API calls — `grispiAPI`'s own
 * `HttpHandler` already owns the request host via `setEnvironment`; these
 * two functions exist solely to build a link INTO the Grispi agent UI (a
 * new browser tab), never to construct a fetch target.
 */

/**
 * Derives the agent-UI TLD from `GRISPI_BASE_URLS` — the only legitimate
 * host source (CORE-04). No second `{env: tld}` map is kept anywhere.
 */
export function grispiTld(env: GrispiEnvironment): string {
  return GRISPI_BASE_URLS[env].replace(/^https:\/\/api\.grispi\./, "");
}

/**
 * Builds a full agent-UI ticket URL for `target="_blank"` navigation
 * (D-07). All three inputs MUST come from a trusted context
 * (`useGrispi()`/the SDK bundle) — the browser's own current-location APIs
 * and the iframe hash are never read here or by any caller (D-08). Preprod
 * host live-verified, 04.2-RESEARCH.md P4.
 *
 * Deliberately built with string concatenation, not a template literal —
 * T-04.1-01 requires this file to stay free of template interpolation so a
 * future accidental host interpolation cannot be introduced silently.
 */
export function buildAgentTicketUrl(
  tenantId: string,
  env: GrispiEnvironment,
  ticketKey: string
): string {
  return (
    "https://" +
    tenantId +
    ".grispi." +
    grispiTld(env) +
    "/tickets/" +
    encodeURIComponent(ticketKey)
  );
}
