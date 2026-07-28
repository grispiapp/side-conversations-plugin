import {
  PatchTicketRequest,
  ReplyTicketPatchRequest,
  StatusTicketPatchRequest,
} from "@/types/grispi.type";

describe("ticket PATCH request contracts", () => {
  it("represents the live-proven public reply body exactly", () => {
    const request: ReplyTicketPatchRequest = {
      comment: {
        body: "<p>Current reply</p><blockquote><p>Prior reply</p></blockquote>",
        publicVisible: true,
        creator: [{ key: "us.email", value: "agent@example.com" }],
      },
    };

    expect(request).toEqual({
      comment: {
        body: "<p>Current reply</p><blockquote><p>Prior reply</p></blockquote>",
        publicVisible: true,
        creator: [{ key: "us.email", value: "agent@example.com" }],
      },
    });
  });

  it.each([
    ["SOLVED", "4"],
    ["OPEN", "2"],
  ] as const)("represents the live-proven %s status-only body", (_name, value) => {
    const request: StatusTicketPatchRequest = {
      fields: [{ key: "ts.status", value }],
    };

    expect(request).toEqual({
      fields: [{ key: "ts.status", value }],
    });
    expect(request).not.toHaveProperty("comment");
  });

  it("keeps reply, lifecycle, and create-only fields disjoint", () => {
    const reply: PatchTicketRequest = {
      comment: {
        body: "<p>Reply</p>",
        publicVisible: true,
        creator: [{ key: "us.email", value: "agent@example.com" }],
      },
    };
    const lifecycle: StatusTicketPatchRequest = {
      fields: [{ key: "ts.status", value: "4" }],
      // @ts-expect-error D-14/D-15/D-17: lifecycle PATCHes cannot send comments.
      comment: reply.comment,
    };
    const createOnlyField: StatusTicketPatchRequest = {
      fields: [
        {
          // @ts-expect-error PATCH status fields cannot resend create-only fields.
          key: "ts.subject",
          value: "4",
        },
      ],
    };

    expect(reply).toHaveProperty("comment");
    expect(lifecycle).toHaveProperty("fields");
    expect(createOnlyField.fields[0].key).toBe("ts.subject");
  });
});
