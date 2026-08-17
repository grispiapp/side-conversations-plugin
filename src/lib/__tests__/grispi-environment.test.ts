import {
  GRISPI_BASE_URLS,
  buildAgentTicketUrl,
  grispiTld,
  isGrispiEnvironment,
} from "@/grispi/client/environment";

import {
  parseJwt,
  resolveGrispiEnvironment,
} from "../grispi-environment";

/**
 * Builds an unsigned-looking (but structurally valid) 3-part JWT so
 * `parseJwt` can decode the payload — mirrors the reference implementation's
 * `atob`/base64url decode path without ever writing a real token to disk.
 */
function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe("resolveGrispiEnvironment", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns the explicit _grispi_env setting for preprod/prod/prod_tr without reading the token", () => {
    expect(
      resolveGrispiEnvironment({ _grispi_env: "preprod" }, "not-a-real-token")
    ).toBe("preprod");
    expect(
      resolveGrispiEnvironment({ _grispi_env: "prod" }, "not-a-real-token")
    ).toBe("prod");
    expect(
      resolveGrispiEnvironment({ _grispi_env: "prod_tr" }, "not-a-real-token")
    ).toBe("prod_tr");
  });

  it("falls back to the dev claim (preprod) when _grispi_env is absent and the token carries dev: true", () => {
    const token = makeToken({ dev: true });
    expect(resolveGrispiEnvironment({}, token)).toBe("preprod");
  });

  it("falls back to prod when _grispi_env is absent and the token's dev claim is false", () => {
    const token = makeToken({ dev: false });
    expect(resolveGrispiEnvironment({}, token)).toBe("prod");
  });

  it("falls back to prod when _grispi_env is absent and the token has no dev claim at all", () => {
    const token = makeToken({ foo: "bar" });
    expect(resolveGrispiEnvironment({}, token)).toBe("prod");
  });

  it("does not throw when settings is null or undefined, falling through to the token branch", () => {
    const devToken = makeToken({ dev: true });
    const nonDevToken = makeToken({ dev: false });
    expect(resolveGrispiEnvironment(null, devToken)).toBe("preprod");
    expect(resolveGrispiEnvironment(undefined, nonDevToken)).toBe("prod");
  });

  it("rejects the hyphenated 'prod-tr' via strict matching, warns once, and falls back through the chain", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

    const devToken = makeToken({ dev: true });
    expect(resolveGrispiEnvironment({ _grispi_env: "prod-tr" }, devToken)).toBe(
      "preprod"
    );
    expect(warnSpy).toHaveBeenCalledWith(
      "grispi-environment",
      "Unknown _grispi_env setting, falling back",
      "prod-tr"
    );

    warnSpy.mockClear();

    const nonDevToken = makeToken({ dev: false });
    expect(
      resolveGrispiEnvironment({ _grispi_env: "prod-tr" }, nonDevToken)
    ).toBe("prod");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it("treats unrecognized non-hyphen values the same way — warns, falls back, and never leaks the value into the result", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const token = makeToken({ foo: "bar" });

    const emptyResult = resolveGrispiEnvironment({ _grispi_env: "" }, token);
    expect(emptyResult).toBe("prod");
    expect(warnSpy).toHaveBeenLastCalledWith(
      "grispi-environment",
      "Unknown _grispi_env setting, falling back",
      ""
    );

    const evilResult = resolveGrispiEnvironment(
      { _grispi_env: "https://evil.example.com" },
      token
    );
    expect(evilResult).toBe("prod");
    expect(evilResult).not.toContain("evil.example.com");
    expect(warnSpy).toHaveBeenLastCalledWith(
      "grispi-environment",
      "Unknown _grispi_env setting, falling back",
      "https://evil.example.com"
    );
  });

  /**
   * Regression guard for the `in`-operator prototype-chain bypass: `"__proto__"
   * in GRISPI_BASE_URLS` is `true`, so these keys used to clear the allowlist
   * and reach `GRISPI_BASE_URLS[key]` as `Object.prototype` / a native
   * function. The pre-existing "https://evil.example.com" case does NOT cover
   * this — it fails the check for an unrelated reason (T-04.1-01).
   */
  it.each([
    "__proto__",
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
  ])(
    "rejects the inherited prototype key %s — falls through to prod and warns",
    (key) => {
      const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
      const token = makeToken({ foo: "bar" });

      expect(resolveGrispiEnvironment({ _grispi_env: key }, token)).toBe(
        "prod"
      );
      expect(warnSpy).toHaveBeenCalledWith(
        "grispi-environment",
        "Unknown _grispi_env setting, falling back",
        key
      );
    }
  );

  it("still honors the dev-claim fallback for prototype keys rather than treating them as an explicit environment", () => {
    jest.spyOn(console, "warn").mockImplementation(() => {});
    const devToken = makeToken({ dev: true });

    expect(
      resolveGrispiEnvironment({ _grispi_env: "__proto__" }, devToken)
    ).toBe("preprod");
  });

  it("does not warn when the _grispi_env key is simply absent (no explicit setting to complain about)", () => {
    const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
    const token = makeToken({ dev: true });

    resolveGrispiEnvironment({}, token);

    expect(warnSpy).not.toHaveBeenCalled();
  });
});

describe("parseJwt", () => {
  it("returns null (never throws) for a non-JWT string with no dots", () => {
    expect(parseJwt("token-abc")).toBeNull();
  });

  it("returns null for an empty string", () => {
    expect(parseJwt("")).toBeNull();
  });

  it("returns null (never throws) when the second segment is not valid base64", () => {
    expect(parseJwt("a.b")).toBeNull();
  });

  it("decodes the payload of a well-formed 3-part base64url token", () => {
    const token = makeToken({ dev: true });
    expect(parseJwt(token)).toEqual({ dev: true });
  });
});

describe("isGrispiEnvironment", () => {
  it("returns true for the three known environment keys", () => {
    expect(isGrispiEnvironment("preprod")).toBe(true);
    expect(isGrispiEnvironment("prod")).toBe(true);
    expect(isGrispiEnvironment("prod_tr")).toBe(true);
  });

  it("returns false for the hyphenated variant, empty/missing values, and non-string types", () => {
    expect(isGrispiEnvironment("prod-tr")).toBe(false);
    expect(isGrispiEnvironment("")).toBe(false);
    expect(isGrispiEnvironment(undefined)).toBe(false);
    expect(isGrispiEnvironment(null)).toBe(false);
    expect(isGrispiEnvironment(42)).toBe(false);
    expect(isGrispiEnvironment({})).toBe(false);
  });

  /**
   * Own-property check, not `in` — these keys are inherited from
   * `Object.prototype` and must never clear the allowlist (T-04.1-01).
   */
  it.each([
    "__proto__",
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
  ])("returns false for the inherited prototype key %s", (key) => {
    expect(isGrispiEnvironment(key)).toBe(false);
  });

  it("never yields a non-string host for any inherited prototype key", () => {
    for (const key of ["__proto__", "constructor", "toString"]) {
      if (isGrispiEnvironment(key)) {
        throw new Error(`allowlist accepted inherited key ${key}`);
      }
    }
  });
});

describe("grispiTld", () => {
  it.each(Object.keys(GRISPI_BASE_URLS) as (keyof typeof GRISPI_BASE_URLS)[])(
    "derives the TLD for %s from GRISPI_BASE_URLS (single source of truth)",
    (env) => {
      const expectedTld = GRISPI_BASE_URLS[env].replace(
        /^https:\/\/api\.grispi\./,
        ""
      );
      expect(grispiTld(env)).toBe(expectedTld);
    }
  );

  it("never returns a value starting with https:// or a leading dot", () => {
    for (const env of Object.keys(
      GRISPI_BASE_URLS
    ) as (keyof typeof GRISPI_BASE_URLS)[]) {
      const tld = grispiTld(env);
      expect(tld.startsWith("https://")).toBe(false);
      expect(tld.startsWith(".")).toBe(false);
    }
  });
});

describe("buildAgentTicketUrl", () => {
  it.each(Object.keys(GRISPI_BASE_URLS) as (keyof typeof GRISPI_BASE_URLS)[])(
    "builds a URL derivable from GRISPI_BASE_URLS for %s (single source of truth)",
    (env) => {
      const expectedHostSuffix = `.grispi.${grispiTld(env)}`;
      const url = buildAgentTicketUrl("gsocial-test", env, "TICKET-1");
      expect(url).toContain(expectedHostSuffix);
    }
  );

  it("keeps the full ticket key in the result, not just a numeric fragment", () => {
    const url = buildAgentTicketUrl("gsocial-test", "preprod", "TICKET-597");
    expect(url).toContain("TICKET-597");
  });

  it("URL-encodes the ticket key", () => {
    const url = buildAgentTicketUrl("t", "prod", "A/B");
    expect(url).toContain("A%2FB");
  });

  it("places tenantId as the first subdomain", () => {
    const url = buildAgentTicketUrl("gsocial-test", "preprod", "TICKET-1");
    expect(url.startsWith("https://gsocial-test.grispi.")).toBe(true);
  });

  it("includes the /tickets/ path segment", () => {
    const url = buildAgentTicketUrl("gsocial-test", "prod", "TICKET-1");
    expect(url).toContain("/tickets/");
  });
});
