/**
 * Standalone dev mode (Plan 01-03 deviation — UAT enabler).
 *
 * The Grispi SDK bridge (`window.GrispiClient`) only exists when the app
 * runs inside the Grispi panel iframe. Opening http://localhost:3000
 * directly used to hard-crash the tree at module scope
 * (`window.GrispiClient.instance()` → TypeError). Standalone mode bypasses
 * the bridge for local UAT using the manual test token.
 *
 * ACTIVATION RULE (zero production risk): standalone mode activates ONLY
 * when BOTH hold:
 *   1. `NODE_ENV === "development"` (never in a production build), AND
 *   2. `REACT_APP_DEV_TOKEN` is non-empty (comes from the uncommitted
 *      `.env.development.local`, see `.gitignore`).
 * In every other case the SDK path runs exactly as before.
 *
 * IDENTITY (CR-02 fix): standalone mode has no bundle, so the agent's
 * email comes from the token's own `sub` claim (or an explicit operator
 * override) — never a hardcoded default. There is no name claim in the
 * token, so `agentName` has a single source, the explicit override, and is
 * `null` otherwise; a `null` email closes the send gates on purpose.
 */

import { GrispiEnvironment, isGrispiEnvironment } from "@/grispi/client/environment";
import { parseJwt } from "@/lib/grispi-environment";

export interface StandaloneDevConfig {
  token: string;
  tenantId: string;
  initialTicketKey: string;
  agentEmail: string | null;
  agentName: string | null;
  environment: GrispiEnvironment;
}

export const DEFAULT_DEV_TENANT_ID = "gsocial-test";
/** The seeded UAT parent ticket — see 01-02-probe-findings.md. */
export const DEFAULT_DEV_TICKET_KEY = "TICKET-563";
/**
 * Standalone dev mode bypasses the bundle/SDK entirely, so it never enters
 * the `_grispi_env` → JWT `dev` claim → prod resolution chain
 * (`resolveGrispiEnvironment`, Plan 04.1-01). It needs its own override.
 * Unlike `DEFAULT_ENVIRONMENT` (prod, the safe-side default for the real
 * chain), this default is `preprod` — `DEFAULT_DEV_TENANT_ID`
 * (`gsocial-test`) lives on preprod, and this is the tenant every existing
 * local UAT flow already targets.
 */
export const DEFAULT_DEV_ENVIRONMENT: GrispiEnvironment = "preprod";

/**
 * Pure resolver — takes `env`/`search` as inputs so the activation rule and
 * ticket-key precedence (?ticket= → REACT_APP_DEV_TICKET_KEY → default) are
 * unit-testable without touching `process.env`/`window`.
 */
export function resolveStandaloneDevConfig(
  env: Record<string, string | undefined>,
  locationSearch: string
): StandaloneDevConfig | null {
  if (env.NODE_ENV !== "development") return null;

  const token = env.REACT_APP_DEV_TOKEN?.trim();
  if (!token) return null;

  const tenantId = env.REACT_APP_DEV_TENANT_ID?.trim() || DEFAULT_DEV_TENANT_ID;

  const queryTicket = new URLSearchParams(locationSearch).get("ticket")?.trim();
  const initialTicketKey =
    queryTicket ||
    env.REACT_APP_DEV_TICKET_KEY?.trim() ||
    DEFAULT_DEV_TICKET_KEY;

  // Order: explicit override → token's own `sub` claim → null. The `sub`
  // read is guarded by `typeof` because a JWT payload is untrusted input —
  // a non-string `sub` (e.g. a number) would throw on `.trim()` otherwise,
  // and this module runs at load time so that throw would take down the
  // whole tree (T-Q-tn1-02).
  const rawSub = parseJwt(token)?.sub;
  const subEmail = typeof rawSub === "string" ? rawSub.trim() : "";
  const agentEmail = env.REACT_APP_DEV_AGENT_EMAIL?.trim() || subEmail || null;

  // No token claim carries a name — the only source is the explicit
  // override. Never derive `agentName` from `sub`.
  const agentName = env.REACT_APP_DEV_AGENT_NAME?.trim() || null;

  // Not a plain `?.trim() || DEFAULT` fallback: an unrecognized value (the
  // backend's hyphenated internal spelling, "staging", etc.) must never pass
  // through untouched — it has to clear the isGrispiEnvironment allowlist
  // first (T-04.1-01).
  const rawEnvironment = env.REACT_APP_DEV_GRISPI_ENV?.trim();
  const environment = isGrispiEnvironment(rawEnvironment)
    ? rawEnvironment
    : DEFAULT_DEV_ENVIRONMENT;

  return { token, tenantId, initialTicketKey, agentEmail, agentName, environment };
}

/** Convenience wrapper reading the real environment. */
export function getStandaloneDevConfig(): StandaloneDevConfig | null {
  return resolveStandaloneDevConfig(
    process.env as Record<string, string | undefined>,
    typeof window !== "undefined" ? window.location.search : ""
  );
}
