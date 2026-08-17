import { readFileSync } from "fs";
import { join } from "path";

/**
 * T-04.1-01 static regression gate.
 *
 * `environment.ts` is the single legitimate source of every Grispi API host
 * (CORE-04). A template literal injected into its code would let a host
 * string be silently interpolated — poisoning both `HttpHandler`'s `fetch`
 * target (leaks the agent's `Authorization: Bearer` header off-host) and
 * `buildAgentTicketUrl`'s `target="_blank"` link (opens a phishing host).
 * Until now this was enforced only by three doc-comment sentences (07a2cb9
 * shows one of those sentences itself broke the rule it was documenting).
 * This test reads the source from disk and enforces it mechanically.
 */

const ENVIRONMENT_SOURCE_PATH = join(
  __dirname,
  "..",
  "environment.ts"
);

function stripComments(source: string): string {
  // Strip block comments first (lazy match, handles the file's doc-comments).
  const withoutBlockComments = source.replace(/\/\*[\s\S]*?\*\//g, "");

  // Then strip only lines whose first non-whitespace characters are `//`.
  // Do NOT strip `//` occurring mid-line — GRISPI_BASE_URLS's values contain
  // `https://` and a naive strip would eat the rest of those lines.
  return withoutBlockComments
    .split("\n")
    .filter((line) => !/^\s*\/\//.test(line))
    .join("\n");
}

describe("T-04.1-01: environment.ts stays free of template literals", () => {
  const rawSource = readFileSync(ENVIRONMENT_SOURCE_PATH, "utf8");
  const strippedSource = stripComments(rawSource);

  it("contains no backtick (template literal start) once comments are stripped", () => {
    expect(strippedSource.includes("`")).toBe(false);
  });

  it("has NOT been vacuumed empty by the comment-stripper (still contains GRISPI_BASE_URLS)", () => {
    expect(strippedSource).toContain("GRISPI_BASE_URLS");
  });

  it("still contains the three environment keys after stripping (line-comment strip did not eat the // in https:// URL values)", () => {
    expect(strippedSource).toContain("preprod");
    expect(strippedSource).toContain("prod_tr");
    // "prod" check comes after "prod_tr" so this substring assertion isn't
    // trivially satisfied by prod_tr alone — both keys are distinct object keys.
    expect(strippedSource).toMatch(/\bprod:/);
  });

  it("passes today even though the file's doc-comments contain backticked prose (proves block-comment stripping actually ran)", () => {
    expect(rawSource).toContain("`");
    expect(strippedSource.includes("`")).toBe(false);
  });
});
