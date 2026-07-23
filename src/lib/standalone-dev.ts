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

export interface StandaloneDevConfig {
  token: string;
  tenantId: string;
  initialTicketKey: string;
}

export const DEFAULT_DEV_TENANT_ID = "gsocial-test";
/** The seeded UAT parent ticket — see 01-02-probe-findings.md. */
export const DEFAULT_DEV_TICKET_KEY = "TICKET-563";

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

  return { token, tenantId, initialTicketKey };
}

/** Convenience wrapper reading the real environment. */
export function getStandaloneDevConfig(): StandaloneDevConfig | null {
  return resolveStandaloneDevConfig(
    process.env as Record<string, string | undefined>,
    typeof window !== "undefined" ? window.location.search : ""
  );
}
