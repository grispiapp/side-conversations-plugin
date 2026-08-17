import {
  DEFAULT_DEV_ENVIRONMENT,
  DEFAULT_DEV_TENANT_ID,
  DEFAULT_DEV_TICKET_KEY,
  resolveStandaloneDevConfig,
} from "../standalone-dev";

import { GRISPI_BASE_URLS } from "@/grispi/client/environment";

// Test files don't import from each other (repo idiom) — copied locally
// from grispi-environment.test.ts.
function makeToken(payload: Record<string, unknown>): string {
  const header = btoa(JSON.stringify({ alg: "none" }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe("resolveStandaloneDevConfig", () => {
  it("returns null outside development (production build can never activate)", () => {
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "production", REACT_APP_DEV_TOKEN: "tok" },
        ""
      )
    ).toBeNull();
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "test", REACT_APP_DEV_TOKEN: "tok" },
        ""
      )
    ).toBeNull();
  });

  it("returns null in development without a token (plugin mode untouched)", () => {
    expect(resolveStandaloneDevConfig({ NODE_ENV: "development" }, "")).toBeNull();
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "development", REACT_APP_DEV_TOKEN: "   " },
        ""
      )
    ).toBeNull();
  });

  it("activates with dev + unresolvable token, agentEmail/agentName both null (no identity source)", () => {
    const config = resolveStandaloneDevConfig(
      { NODE_ENV: "development", REACT_APP_DEV_TOKEN: "tok" },
      ""
    );
    expect(config).toEqual({
      token: "tok",
      tenantId: DEFAULT_DEV_TENANT_ID,
      initialTicketKey: DEFAULT_DEV_TICKET_KEY,
      agentEmail: null,
      agentName: null,
      environment: DEFAULT_DEV_ENVIRONMENT,
    });
  });

  it("activates with dev + a token whose sub resolves, agentEmail from sub / agentName null", () => {
    const token = makeToken({ sub: "gsocial@api.grispi.com" });
    const config = resolveStandaloneDevConfig(
      { NODE_ENV: "development", REACT_APP_DEV_TOKEN: token },
      ""
    );
    expect(config).toEqual({
      token,
      tenantId: DEFAULT_DEV_TENANT_ID,
      initialTicketKey: DEFAULT_DEV_TICKET_KEY,
      agentEmail: "gsocial@api.grispi.com",
      agentName: null,
      environment: DEFAULT_DEV_ENVIRONMENT,
    });
  });

  it("derives agentEmail from the token's sub claim when no override is set", () => {
    const token = makeToken({ sub: "gsocial@api.grispi.com" });
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "development", REACT_APP_DEV_TOKEN: token },
        ""
      )?.agentEmail
    ).toBe("gsocial@api.grispi.com");
  });

  it("REACT_APP_DEV_AGENT_EMAIL override wins over the token's sub claim", () => {
    const token = makeToken({ sub: "gsocial@api.grispi.com" });
    expect(
      resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: token,
          REACT_APP_DEV_AGENT_EMAIL: "  override@firma.test  ",
        },
        ""
      )?.agentEmail
    ).toBe("override@firma.test");
  });

  it("an empty/whitespace-only REACT_APP_DEV_AGENT_EMAIL falls through to sub, not null", () => {
    const token = makeToken({ sub: "gsocial@api.grispi.com" });
    expect(
      resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: token,
          REACT_APP_DEV_AGENT_EMAIL: "   ",
        },
        ""
      )?.agentEmail
    ).toBe("gsocial@api.grispi.com");
  });

  it("agentEmail is null when the token has no sub claim", () => {
    const token = makeToken({ dev: true });
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "development", REACT_APP_DEV_TOKEN: token },
        ""
      )?.agentEmail
    ).toBeNull();
  });

  it("agentEmail is null when the token cannot be decoded (no exception)", () => {
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "development", REACT_APP_DEV_TOKEN: "tok" },
        ""
      )?.agentEmail
    ).toBeNull();
  });

  it("agentEmail is null when sub is whitespace-only", () => {
    const token = makeToken({ sub: "   " });
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "development", REACT_APP_DEV_TOKEN: token },
        ""
      )?.agentEmail
    ).toBeNull();
  });

  it("agentEmail is null (not throwing) when sub is not a string", () => {
    const token = makeToken({ sub: 12345 });
    expect(() =>
      resolveStandaloneDevConfig(
        { NODE_ENV: "development", REACT_APP_DEV_TOKEN: token },
        ""
      )
    ).not.toThrow();
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "development", REACT_APP_DEV_TOKEN: token },
        ""
      )?.agentEmail
    ).toBeNull();
  });

  it("honors REACT_APP_DEV_AGENT_NAME when set (trimmed), null otherwise (no token source for name)", () => {
    expect(
      resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: "tok",
          REACT_APP_DEV_AGENT_NAME: "  Someone Else  ",
        },
        ""
      )?.agentName
    ).toBe("Someone Else");
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "development", REACT_APP_DEV_TOKEN: "tok" },
        ""
      )?.agentName
    ).toBeNull();
  });

  it("agentName is null for an empty/whitespace-only REACT_APP_DEV_AGENT_NAME", () => {
    expect(
      resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: "tok",
          REACT_APP_DEV_AGENT_NAME: "   ",
        },
        ""
      )?.agentName
    ).toBeNull();
  });

  it("agentName stays null when agentEmail resolves from sub and no name override is set (no cross-contamination)", () => {
    const token = makeToken({ sub: "gsocial@api.grispi.com" });
    const config = resolveStandaloneDevConfig(
      { NODE_ENV: "development", REACT_APP_DEV_TOKEN: token },
      ""
    );
    expect(config?.agentEmail).toBe("gsocial@api.grispi.com");
    expect(config?.agentName).toBeNull();
  });

  it("prefers ?ticket= over REACT_APP_DEV_TICKET_KEY over the default", () => {
    const env = {
      NODE_ENV: "development",
      REACT_APP_DEV_TOKEN: "tok",
      REACT_APP_DEV_TICKET_KEY: "TICKET-999",
    };

    expect(
      resolveStandaloneDevConfig(env, "?ticket=TICKET-111")?.initialTicketKey
    ).toBe("TICKET-111");
    expect(resolveStandaloneDevConfig(env, "")?.initialTicketKey).toBe(
      "TICKET-999"
    );
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "development", REACT_APP_DEV_TOKEN: "tok" },
        ""
      )?.initialTicketKey
    ).toBe(DEFAULT_DEV_TICKET_KEY);
  });

  it("honors REACT_APP_DEV_TENANT_ID when set", () => {
    expect(
      resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: "tok",
          REACT_APP_DEV_TENANT_ID: "another-tenant",
        },
        ""
      )?.tenantId
    ).toBe("another-tenant");
  });

  it("defaults environment to DEFAULT_DEV_ENVIRONMENT (preprod) when REACT_APP_DEV_GRISPI_ENV is unset — preserves the existing gsocial-test flow", () => {
    expect(
      resolveStandaloneDevConfig(
        { NODE_ENV: "development", REACT_APP_DEV_TOKEN: "tok" },
        ""
      )?.environment
    ).toBe(DEFAULT_DEV_ENVIRONMENT);
    expect(DEFAULT_DEV_ENVIRONMENT).toBe("preprod");
  });

  it("honors REACT_APP_DEV_GRISPI_ENV when it is an allowlisted environment key", () => {
    expect(
      resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: "tok",
          REACT_APP_DEV_GRISPI_ENV: "prod",
        },
        ""
      )?.environment
    ).toBe("prod");
    expect(
      resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: "tok",
          REACT_APP_DEV_GRISPI_ENV: "prod_tr",
        },
        ""
      )?.environment
    ).toBe("prod_tr");
  });

  it("trims whitespace around REACT_APP_DEV_GRISPI_ENV like the other override fields", () => {
    expect(
      resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: "tok",
          REACT_APP_DEV_GRISPI_ENV: "  preprod  ",
        },
        ""
      )?.environment
    ).toBe("preprod");
  });

  it("falls back to DEFAULT_DEV_ENVIRONMENT for the hyphenated prod-tr trap — never converts it to prod_tr", () => {
    const resolved = resolveStandaloneDevConfig(
      {
        NODE_ENV: "development",
        REACT_APP_DEV_TOKEN: "tok",
        REACT_APP_DEV_GRISPI_ENV: "prod-tr",
      },
      ""
    )?.environment;
    expect(resolved).toBe(DEFAULT_DEV_ENVIRONMENT);
    expect(resolved).not.toBe("prod_tr");
  });

  it("falls back to DEFAULT_DEV_ENVIRONMENT for unrecognized or empty values", () => {
    expect(
      resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: "tok",
          REACT_APP_DEV_GRISPI_ENV: "staging",
        },
        ""
      )?.environment
    ).toBe(DEFAULT_DEV_ENVIRONMENT);
    expect(
      resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: "tok",
          REACT_APP_DEV_GRISPI_ENV: "",
        },
        ""
      )?.environment
    ).toBe(DEFAULT_DEV_ENVIRONMENT);
  });

  /**
   * Regression guard for the `in`-operator prototype-chain bypass in
   * `isGrispiEnvironment` — these keys used to clear the allowlist here too,
   * so `GRISPI_BASE_URLS[environment]` resolved to `Object.prototype` / a
   * native function instead of a host (T-04.1-01).
   */
  it.each([
    "__proto__",
    "constructor",
    "toString",
    "valueOf",
    "hasOwnProperty",
  ])(
    "falls back to DEFAULT_DEV_ENVIRONMENT for the inherited prototype key %s",
    (key) => {
      const resolved = resolveStandaloneDevConfig(
        {
          NODE_ENV: "development",
          REACT_APP_DEV_TOKEN: "tok",
          REACT_APP_DEV_GRISPI_ENV: key,
        },
        ""
      )?.environment;

      expect(resolved).toBe(DEFAULT_DEV_ENVIRONMENT);
      expect(resolved).toBe("preprod");
      expect(typeof GRISPI_BASE_URLS[resolved!]).toBe("string");
      expect(GRISPI_BASE_URLS[resolved!]).toMatch(/^https:\/\//);
    }
  );
});
