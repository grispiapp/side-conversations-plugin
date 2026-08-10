import {
  DEFAULT_ENVIRONMENT,
  GrispiEnvironment,
  isGrispiEnvironment,
} from "@/grispi/client/environment";
import { Settings } from "@/types/grispi.type";

interface DecodedJwt {
  dev?: boolean;
  [key: string]: unknown;
}

/**
 * Base64url JWT payload decode — signature is NOT verified (RESEARCH.md
 * Security Domain V6: this claim is a routing hint, never an authorization
 * decision; real authorization happens server-side via the `Authorization`
 * header). Deliberately deviates from the reference implementation by
 * wrapping the whole body in try/catch — a malformed/non-JWT token (e.g. a
 * test fixture like `"token-abc"`) must degrade to `null`, not crash the
 * plugin (Pitfall 2 / T-04.1-04).
 */
export function parseJwt(token: string): DecodedJwt | null {
  try {
    const base64Url = token.split(".")[1];
    if (!base64Url) return null;
    const base64 = base64Url.replace(/-/g, "+").replace(/_/g, "/");
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join("")
    );
    return JSON.parse(jsonPayload) as DecodedJwt;
  } catch {
    return null;
  }
}

/**
 * CORE-04: `_grispi_env` (tenant setting) is the primary source; if
 * missing/unrecognized, the token's `dev` claim is the secondary source
 * (`dev: true` → preprod); if neither resolves, the safe-side default is
 * `prod`. The setting value is NEVER interpolated into a URL or used to
 * build a host by string concatenation — it is only ever checked against
 * the allowlist (`isGrispiEnvironment`) and, if valid, used as a lookup key
 * into `GRISPI_BASE_URLS` (T-04.1-01).
 *
 * `prod_tr` is underscored (the plugin setting's contract) — the backend's
 * own internal enum uses a hyphen (`prod-tr`). This is intentionally NOT
 * normalized; see 04.1-PATTERNS.md Anti-Patterns / RESEARCH.md Assumptions
 * Log A4.
 */
export function resolveGrispiEnvironment(
  settings: Settings | null | undefined,
  token: string
): GrispiEnvironment {
  const setting = settings?.["_grispi_env"];

  if (isGrispiEnvironment(setting)) {
    return setting;
  }

  if (setting !== undefined) {
    console.warn(
      "grispi-environment",
      "Unknown _grispi_env setting, falling back",
      setting
    );
  }

  return parseJwt(token)?.dev === true ? "preprod" : DEFAULT_ENVIRONMENT;
}
