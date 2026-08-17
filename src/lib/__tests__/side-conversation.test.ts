import {
  SIDE_CONVERSATION_PARENT_FIELD_KEY,
  formatInternalNoteBody,
  formatPrefillSubject,
  formatRequesterField,
  isHydratedTicket,
  isSideConversationTicket,
  isValidEmail,
  parentKeyOfTicket,
} from "../side-conversation";
import { Ticket } from "@/types/grispi.type";

describe("SIDE_CONVERSATION_PARENT_FIELD_KEY", () => {
  it("is exactly tu.side_conversation_parent (CORE-01 / D-01 / D-02 guard)", () => {
    expect(SIDE_CONVERSATION_PARENT_FIELD_KEY).toBe(
      "tu.side_conversation_parent"
    );
  });
});

describe("formatRequesterField", () => {
  it("colon-prefixes the email (D-07)", () => {
    expect(formatRequesterField("a@b.com")).toBe(":a@b.com");
  });
});

describe("formatPrefillSubject", () => {
  it("wraps the ticket key in brackets and appends the title (D-08)", () => {
    expect(formatPrefillSubject("DESTEK-1042", "Kargo sorunu")).toBe(
      "[DESTEK-1042] Kargo sorunu"
    );
  });

  it("trims trailing whitespace when the title is empty (edge case)", () => {
    expect(formatPrefillSubject("X-1", "")).toBe("[X-1]");
  });
});

describe("formatInternalNoteBody", () => {
  it("interpolates only the parent ticket key into the D-02 locked text", () => {
    expect(formatInternalNoteBody("TICKET-563")).toBe(
      "Bu talep, TICKET-563 talebinin yan konuşmasıdır. Talep sahibi bu yazışmayı görmez."
    );
  });

  it("is pure — same input yields the same output every time", () => {
    const first = formatInternalNoteBody("DESTEK-9");
    const second = formatInternalNoteBody("DESTEK-9");
    expect(first).toBe(second);
  });

  it("never emits HTML tags (plain text only)", () => {
    expect(formatInternalNoteBody("X-1")).not.toMatch(/<[^>]+>/);
  });
});

describe("isValidEmail", () => {
  it("accepts a well-formed email (D-06)", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
  });

  it("trims surrounding whitespace before validating", () => {
    expect(isValidEmail("  a@b.com  ")).toBe(true);
  });

  it("rejects an empty string", () => {
    expect(isValidEmail("")).toBe(false);
  });

  it("rejects a string with no @ (bos)", () => {
    expect(isValidEmail("bos")).toBe(false);
  });

  it("rejects an address missing a domain suffix", () => {
    expect(isValidEmail("a@b")).toBe(false);
  });

  it("rejects an address containing a space", () => {
    expect(isValidEmail("a @b.com")).toBe(false);
  });
});

function hydratedTicket(fieldValue: unknown): Ticket {
  return {
    key: "TICKET-1",
    fieldMap:
      fieldValue === undefined
        ? {}
        : {
            [SIDE_CONVERSATION_PARENT_FIELD_KEY]: {
              key: SIDE_CONVERSATION_PARENT_FIELD_KEY,
              value: fieldValue,
            },
          },
  } as unknown as Ticket;
}

const provisionalTicket = { key: "TICKET-1" } as Ticket;

describe("isHydratedTicket", () => {
  it("returns false for null (RESEARCH Pitfall #2 — never the sole guard)", () => {
    expect(isHydratedTicket(null)).toBe(false);
  });

  it("returns false for the provisional switchTicket ticket (no field map yet)", () => {
    expect(isHydratedTicket(provisionalTicket)).toBe(false);
  });

  it("returns true once a field map exists, even if it's empty", () => {
    expect(isHydratedTicket(hydratedTicket(undefined))).toBe(true);
  });
});

describe("isSideConversationTicket", () => {
  it("returns true when the parent field carries a non-empty value", () => {
    expect(isSideConversationTicket(hydratedTicket("PARENT-1"))).toBe(true);
  });

  it("returns false when the field value is null", () => {
    expect(isSideConversationTicket(hydratedTicket(null))).toBe(false);
  });

  it("returns false when the field value is an empty string", () => {
    expect(isSideConversationTicket(hydratedTicket(""))).toBe(false);
  });

  it("returns false when the field is absent entirely", () => {
    expect(isSideConversationTicket(hydratedTicket(undefined))).toBe(false);
  });

  it("returns false and does not throw for the provisional (field-map-less) ticket", () => {
    expect(() => isSideConversationTicket(provisionalTicket)).not.toThrow();
    expect(isSideConversationTicket(provisionalTicket)).toBe(false);
  });

  it("returns false for null", () => {
    expect(isSideConversationTicket(null)).toBe(false);
  });
});

describe("parentKeyOfTicket", () => {
  it("returns the parent ticket key for a side conversation ticket", () => {
    expect(parentKeyOfTicket(hydratedTicket("PARENT-1"))).toBe("PARENT-1");
  });

  it("returns null for a hydrated, non-side-conversation ticket", () => {
    expect(parentKeyOfTicket(hydratedTicket(undefined))).toBeNull();
  });

  it("returns null for the provisional (field-map-less) ticket", () => {
    expect(parentKeyOfTicket(provisionalTicket)).toBeNull();
  });

  it("returns null for null", () => {
    expect(parentKeyOfTicket(null)).toBeNull();
  });
});
