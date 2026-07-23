import {
  DEFAULT_DEV_TENANT_ID,
  DEFAULT_DEV_TICKET_KEY,
  resolveStandaloneDevConfig,
} from "../standalone-dev";

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

  it("activates with dev + token, applying tenant/ticket defaults", () => {
    const config = resolveStandaloneDevConfig(
      { NODE_ENV: "development", REACT_APP_DEV_TOKEN: "tok" },
      ""
    );
    expect(config).toEqual({
      token: "tok",
      tenantId: DEFAULT_DEV_TENANT_ID,
      initialTicketKey: DEFAULT_DEV_TICKET_KEY,
    });
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
});
