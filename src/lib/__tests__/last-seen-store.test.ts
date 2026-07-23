import { getLastSeenAt } from "../last-seen-store";

describe("getLastSeenAt", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("returns a number when localStorage holds a numeric value", () => {
    jest.spyOn(Storage.prototype, "getItem").mockReturnValue("1700000000000");

    expect(getLastSeenAt("TICKET-1")).toBe(1700000000000);
  });

  it("returns null when no record exists", () => {
    jest.spyOn(Storage.prototype, "getItem").mockReturnValue(null);

    expect(getLastSeenAt("TICKET-1")).toBeNull();
  });

  it("returns null when the stored value is not a finite number", () => {
    jest.spyOn(Storage.prototype, "getItem").mockReturnValue("not-a-number");

    expect(getLastSeenAt("TICKET-1")).toBeNull();
  });

  it("returns null (no throw) when localStorage access throws", () => {
    jest.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("SecurityError: partitioned storage");
    });

    expect(() => getLastSeenAt("TICKET-1")).not.toThrow();
    expect(getLastSeenAt("TICKET-1")).toBeNull();
  });
});
