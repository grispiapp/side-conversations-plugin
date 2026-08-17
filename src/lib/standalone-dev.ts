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
 */

import { GrispiEnvironment, isGrispiEnvironment } from "@/grispi/client/environment";

export interface StandaloneDevConfig {
  token: string;
  tenantId: string;
  initialTicketKey: string;
  agentEmail: string;
  agentName: string;
  environment: GrispiEnvironment;
}

export const DEFAULT_DEV_TENANT_ID = "gsocial-test";
/** The seeded UAT parent ticket — see 01-02-probe-findings.md. */
export const DEFAULT_DEV_TICKET_KEY = "TICKET-563";
/**
 * Standalone dev mode has no SDK bridge, so `bundle.context.agent.email`
 * (createTicket's `creator` source, RESEARCH.md Pitfall #3) never arrives.
 * Falls back to Davut's live-verified Grispi agent identity for this
 * tenant (02-01-SUMMARY.md probe: davutkmbr@gmail.com → team user
 * "Davut Kember", id 15, ROLE_ADMIN).
 */
export const DEFAULT_DEV_AGENT_EMAIL = "davutkmbr@gmail.com";
/**
 * D-13's `agentName` counterpart to `DEFAULT_DEV_AGENT_EMAIL` — same
 * live-verified identity (02-01-SUMMARY.md probe: davutkmbr@gmail.com →
 * team user "Davut Kember", id 15, ROLE_ADMIN).
 */
export const DEFAULT_DEV_AGENT_NAME = "Davut Kember";
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

  const agentEmail =
    env.REACT_APP_DEV_AGENT_EMAIL?.trim() || DEFAULT_DEV_AGENT_EMAIL;
  const agentName =
    env.REACT_APP_DEV_AGENT_NAME?.trim() || DEFAULT_DEV_AGENT_NAME;

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
