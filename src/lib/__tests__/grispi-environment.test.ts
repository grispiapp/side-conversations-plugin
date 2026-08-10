import { isGrispiEnvironment } from "@/grispi/client/environment";

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
});
