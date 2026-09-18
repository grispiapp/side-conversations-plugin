import {
  CcEntry,
  dedupeCcEntries,
  parseEmailCcsFieldValue,
  serializeEmailCcs,
} from "../email-ccs";

describe("parseEmailCcsFieldValue", () => {
  it("parses a bare comma-separated id list (read format)", () => {
    expect(parseEmailCcsFieldValue("41,57")).toEqual([
      { id: 41, email: null },
      { id: 57, email: null },
    ]);
  });

  it("parses id:email:phone triples", () => {
    expect(parseEmailCcsFieldValue("123:null:null,null:a@b.com:null")).toEqual([
      { id: 123, email: null },
      { id: null, email: "a@b.com" },
    ]);
  });

  it("treats case-insensitive 'null' and empty parts as absent", () => {
    expect(parseEmailCcsFieldValue("NULL:a@b.com:null")).toEqual([
      { id: null, email: "a@b.com" },
    ]);
    expect(parseEmailCcsFieldValue(":a@b.com:")).toEqual([
      { id: null, email: "a@b.com" },
    ]);
  });

  it("returns [] for empty, null, or non-string input", () => {
    expect(parseEmailCcsFieldValue("")).toEqual([]);
    expect(parseEmailCcsFieldValue(null)).toEqual([]);
    expect(parseEmailCcsFieldValue(undefined)).toEqual([]);
    expect(parseEmailCcsFieldValue(42)).toEqual([]);
  });

  it("silently drops a malformed non-numeric bare id, never throws", () => {
    expect(() => parseEmailCcsFieldValue("abc,41")).not.toThrow();
    expect(parseEmailCcsFieldValue("abc,41")).toEqual([
      { id: 41, email: null },
    ]);
  });

  it("dedupes case-insensitively while parsing", () => {
    expect(
      parseEmailCcsFieldValue("null:A@b.com:null,null:a@B.COM:null")
    ).toEqual([{ id: null, email: "A@b.com" }]);
  });
});

describe("serializeEmailCcs", () => {
  it("serializes an id-based entry as `<id>:null:null`", () => {
    expect(serializeEmailCcs([{ id: 41, email: null }])).toBe("41:null:null");
  });

  it("serializes an email-only entry as `null:<email>:null`", () => {
    expect(serializeEmailCcs([{ id: null, email: "a@b.com" }])).toBe(
      "null:a@b.com:null"
    );
  });

  it("returns '' for an empty list (D-CC-3 real 'clear all' value)", () => {
    expect(serializeEmailCcs([])).toBe("");
  });

  it("joins multiple entries with a comma", () => {
    const entries: CcEntry[] = [
      { id: 41, email: null },
      { id: null, email: "a@b.com" },
    ];
    expect(serializeEmailCcs(entries)).toBe("41:null:null,null:a@b.com:null");
  });
});

describe("dedupeCcEntries", () => {
  it("keeps the first occurrence and drops a case-insensitive email duplicate", () => {
    const entries: CcEntry[] = [
      { id: null, email: "a@b.com" },
      { id: null, email: "A@B.COM" },
    ];
    expect(dedupeCcEntries(entries)).toEqual([{ id: null, email: "a@b.com" }]);
  });

  it("dedupes numeric ids by identity, not by email", () => {
    const entries: CcEntry[] = [
      { id: 41, email: "old@b.com" },
      { id: 41, email: "new@b.com" },
    ];
    expect(dedupeCcEntries(entries)).toEqual([{ id: 41, email: "old@b.com" }]);
  });

  it("drops a typed address that duplicates an id-based entry's email", () => {
    const entries: CcEntry[] = [
      { id: 41, email: "ali@b.com" },
      { id: null, email: "ALI@b.com" },
    ];
    expect(dedupeCcEntries(entries)).toEqual([{ id: 41, email: "ali@b.com" }]);
  });
});
