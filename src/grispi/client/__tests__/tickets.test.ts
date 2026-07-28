import { Authentication } from "../authentication";
import { HttpHandler } from "../http-handler";
import { Tickets } from "../tickets";

import {
  PatchTicketRequest,
  PatchTicketResponse,
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
  ] as const)(
    "represents the live-proven %s status-only body",
    (_name, value) => {
      const request: StatusTicketPatchRequest = {
        fields: [{ key: "ts.status", value }],
      };

      expect(request).toEqual({
        fields: [{ key: "ts.status", value }],
      });
      expect(request).not.toHaveProperty("comment");
    }
  );

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

describe("Tickets.patchTicket", () => {
  let http: HttpHandler;
  let auth: Authentication;
  let tickets: Tickets;
  let send: jest.SpyInstance;

  const response: PatchTicketResponse = {
    key: "SIDE/1",
    comments: [],
    fieldMap: {
      "ts.status": {
        key: "ts.status",
        value: { id: 2, name: "Open" },
      },
    },
  };

  beforeEach(() => {
    http = new HttpHandler();
    auth = new Authentication(http);
    auth.setToken("test-token");
    auth.setTenantId("test-tenant");
    tickets = new Tickets(http, auth);
    send = jest.spyOn(http, "send").mockResolvedValue(response);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("PATCHes an encoded ticket key with auth, JSON, and no-cache", async () => {
    const body: ReplyTicketPatchRequest = {
      comment: {
        body: "<p>Current reply</p><blockquote><p>Prior reply</p></blockquote>",
        publicVisible: true,
        creator: [{ key: "us.email", value: "agent@example.com" }],
      },
    };

    const result: PatchTicketResponse = await tickets.patchTicket(
      "SIDE/1 ?#",
      body
    );

    expect(result).toBe(response);
    expect(send).toHaveBeenCalledWith("public/v1/tickets/SIDE%2F1%20%3F%23", {
      method: "PATCH",
      cache: "no-cache",
      headers: {
        Authorization: "Bearer test-token",
        tenantId: "test-tenant",
      },
      body: JSON.stringify(body),
    });
  });

  it.each([
    ["SOLVED", "4"],
    ["OPEN", "2"],
  ] as const)(
    "passes the exact %s status-only body through",
    async (_name, value) => {
      const body: StatusTicketPatchRequest = {
        fields: [{ key: "ts.status", value }],
      };

      await tickets.patchTicket("SIDE-1", body);

      expect(send).toHaveBeenCalledWith(
        "public/v1/tickets/SIDE-1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({
            fields: [{ key: "ts.status", value }],
          }),
        })
      );
      expect(JSON.parse(send.mock.calls[0][1].body)).not.toHaveProperty(
        "comment"
      );
    }
  );
});
