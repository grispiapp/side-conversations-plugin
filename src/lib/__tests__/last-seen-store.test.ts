import { getLastSeenAt, setLastSeenAt } from "../last-seen-store";

describe("getLastSeenAt", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a number when localStorage holds a numeric value", () => {
    jest.spyOn(Storage.prototype, "getItem").mockReturnValue("1700000000000");

    expect(getLastSeenAt("tenant-1", "TICKET-1")).toBe(1700000000000);
  });

  it("returns null when no record exists", () => {
    jest.spyOn(Storage.prototype, "getItem").mockReturnValue(null);

    expect(getLastSeenAt("tenant-1", "TICKET-1")).toBeNull();
  });

  it("returns null when the stored value is not a finite number", () => {
    jest.spyOn(Storage.prototype, "getItem").mockReturnValue("not-a-number");

    expect(getLastSeenAt("tenant-1", "TICKET-1")).toBeNull();
  });

  it("returns null (no throw) when localStorage access throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: partitioned storage");
    });

    expect(() => getLastSeenAt("tenant-1", "TICKET-1")).not.toThrow();
    expect(getLastSeenAt("tenant-1", "TICKET-1")).toBeNull();
  });
});

describe("setLastSeenAt", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("writes a finite timestamp under the ticket-scoped key", () => {
    const setItem = jest
      .spyOn(Storage.prototype, "setItem")
      .mockImplementation(() => undefined);

    expect(setLastSeenAt("tenant-1", "TICKET-1", 1700000000000)).toBe(
      true
    );
    expect(setItem).toHaveBeenCalledWith(
      "sc:lastSeenAt:tenant-1:TICKET-1",
      "1700000000000"
    );
  });

  it("returns false without throwing when localStorage denies the write", () => {
    jest.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });

    expect(() =>
      setLastSeenAt("tenant-1", "TICKET-1", 1700000000000)
    ).not.toThrow();
    expect(
      setLastSeenAt("tenant-1", "TICKET-1", 1700000000000)
    ).toBe(false);
  });

  it.each([
    ["tenant-1", "", 1700000000000],
    ["tenant-1", "   ", 1700000000000],
    ["", "TICKET-1", 1700000000000],
    ["tenant-1", "TICKET-1", Number.NaN],
    ["tenant-1", "TICKET-1", Number.POSITIVE_INFINITY],
    ["tenant-1", "TICKET-1", Number.NEGATIVE_INFINITY],
  ])(
    "rejects invalid input without writing (%p, %p, %p)",
    (tenantId, ticketKey, timestamp) => {
      const setItem = jest.spyOn(Storage.prototype, "setItem");

      expect(setLastSeenAt(tenantId, ticketKey, timestamp)).toBe(false);
      expect(setItem).not.toHaveBeenCalled();
    }
  );

  it("keeps identical side-ticket keys isolated by tenant and ignores legacy unscoped records", () => {
    window.localStorage.setItem("sc:lastSeenAt:SIDE-1", "9999");
    setLastSeenAt("tenant-a", "SIDE-1", 1000);

    expect(getLastSeenAt("tenant-a", "SIDE-1")).toBe(1000);
    expect(getLastSeenAt("tenant-b", "SIDE-1")).toBeNull();
  });
});
