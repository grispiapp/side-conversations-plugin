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

export const isGrispiEnvironment = (
  value: unknown
): value is GrispiEnvironment => {
  return typeof value === "string" && value in GRISPI_BASE_URLS;
};
