import { getInfoBoxSeen, setInfoBoxSeen } from "../info-box-store";

describe("getInfoBoxSeen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("returns false when no record exists", () => {
    jest.spyOn(Storage.prototype, "getItem").mockReturnValue(null);

    expect(getInfoBoxSeen("tenant-1")).toBe(false);
  });

  it("returns true after setInfoBoxSeen was called for the same tenant", () => {
    setInfoBoxSeen("tenant-1");

    expect(getInfoBoxSeen("tenant-1")).toBe(true);
  });

  it("returns false for a different tenant (tenant isolation)", () => {
    setInfoBoxSeen("tenant-1");

    expect(getInfoBoxSeen("tenant-2")).toBe(false);
  });

  it.each(["", "   "])(
    "returns false for an empty/whitespace tenantId (%p) without touching localStorage",
    (tenantId) => {
      const getItem = jest.spyOn(Storage.prototype, "getItem");

      expect(getInfoBoxSeen(tenantId)).toBe(false);
      expect(getItem).not.toHaveBeenCalled();
    }
  );

  it("returns false (no throw) when localStorage.getItem throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: partitioned storage");
    });

    expect(() => getInfoBoxSeen("tenant-1")).not.toThrow();
    expect(getInfoBoxSeen("tenant-1")).toBe(false);
  });

  it("encodes special characters in tenantId and keeps records isolated", () => {
    setInfoBoxSeen("a:b");

    expect(getInfoBoxSeen("a:b")).toBe(true);
    expect(getInfoBoxSeen("a")).toBe(false);
  });
});

describe("setInfoBoxSeen", () => {
  afterEach(() => {
    jest.restoreAllMocks();
    window.localStorage.clear();
  });

  it("returns true on successful write", () => {
    expect(setInfoBoxSeen("tenant-1")).toBe(true);
  });

  it.each(["", "   "])(
    "returns false for an empty/whitespace tenantId (%p) without touching localStorage",
    (tenantId) => {
      const setItem = jest.spyOn(Storage.prototype, "setItem");

      expect(setInfoBoxSeen(tenantId)).toBe(false);
      expect(setItem).not.toHaveBeenCalled();
    }
  );

  it("returns false (no throw) when localStorage.setItem throws", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() => setInfoBoxSeen("tenant-1")).not.toThrow();
    expect(setInfoBoxSeen("tenant-1")).toBe(false);
  });
});
