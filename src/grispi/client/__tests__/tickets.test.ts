import { Authentication } from "../authentication";
import { HttpHandler } from "../http-handler";
import { Tickets } from "../tickets";

import {
  CreateTicketRequest,
  InternalNotePatchRequest,
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

describe("Tickets.createTicket", () => {
  let http: HttpHandler;
  let auth: Authentication;
  let tickets: Tickets;
  let send: jest.SpyInstance;

  beforeEach(() => {
    http = new HttpHandler();
    auth = new Authentication(http);
    auth.setToken("test-token");
    auth.setTenantId("test-tenant");
    tickets = new Tickets(http, auth);
    send = jest.spyOn(http, "send").mockResolvedValue({ key: "SIDE-1" });
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("POSTs to /v2/tickets, never public/v1/tickets (Phase 04 Plan 01 A2/N2 write-path split)", async () => {
    const body: CreateTicketRequest = {
      comment: {
        body: "<p>Merhaba</p>",
        publicVisible: true,
        creator: [{ key: "us.email", value: "agent@example.com" }],
        channel: "WEB",
        attachmentIds: [630],
      },
      fields: [{ key: "ts.subject", value: "Konu" }],
    };

    await tickets.createTicket(body);

    expect(send).toHaveBeenCalledWith("v2/tickets", {
      method: "POST",
      cache: "no-cache",
      headers: {
        Authorization: "Bearer test-token",
        tenantId: "test-tenant",
      },
      body: JSON.stringify(body),
    });
  });
});

describe("Tickets.replyTicket", () => {
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

  it("PATCHes an encoded ticket key on /v2/tickets, never public/v1/tickets (Phase 04 Plan 01 A2/N2 write-path split)", async () => {
    const body: ReplyTicketPatchRequest = {
      comment: {
        body: "<p>Current reply</p><blockquote><p>Prior reply</p></blockquote>",
        publicVisible: true,
        creator: [{ key: "us.email", value: "agent@example.com" }],
        channel: "WEB",
      },
    };

    const result: PatchTicketResponse = await tickets.replyTicket(
      "SIDE/1 ?#",
      body
    );

    expect(result).toBe(response);
    expect(send).toHaveBeenCalledWith("v2/tickets/SIDE%2F1%20%3F%23", {
      method: "PATCH",
      cache: "no-cache",
      headers: {
        Authorization: "Bearer test-token",
        tenantId: "test-tenant",
      },
      body: JSON.stringify(body),
    });
  });
});

describe("Tickets.addInternalNote", () => {
  let http: HttpHandler;
  let auth: Authentication;
  let tickets: Tickets;
  let send: jest.SpyInstance;

  const response: PatchTicketResponse = {
    key: "SIDE-601",
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

  it("PATCHes v2/tickets/{key}, never public/v1 (D-01)", async () => {
    const body: InternalNotePatchRequest = {
      comment: {
        body: "Bu talep, TICKET-563 talebinin yan konuşmasıdır. Talep sahibi bu yazışmayı görmez.",
        publicVisible: false,
        creator: [{ key: "us.email", value: "agent@example.com" }],
        channel: "WEB",
      },
      fields: [{ key: "tu.side_conversation_parent", value: "TICKET-563" }],
    };

    await tickets.addInternalNote("TICKET-601", body);

    expect(send).toHaveBeenCalledWith("v2/tickets/TICKET-601", {
      method: "PATCH",
      cache: "no-cache",
      headers: {
        Authorization: "Bearer test-token",
        tenantId: "test-tenant",
      },
      body: JSON.stringify(body),
    });
  });

  it("encodes the ticket key in the URL", async () => {
    const body: InternalNotePatchRequest = {
      comment: {
        body: "Bu talep, A/B talebinin yan konuşmasıdır. Talep sahibi bu yazışmayı görmez.",
        publicVisible: false,
        creator: [{ key: "us.email", value: "agent@example.com" }],
        channel: "WEB",
      },
      fields: [{ key: "tu.side_conversation_parent", value: "A/B" }],
    };

    await tickets.addInternalNote("A/B", body);

    expect(send.mock.calls[0][0]).toBe("v2/tickets/A%2FB");
  });

  it("sends comment.publicVisible false and comment.channel WEB", async () => {
    const body: InternalNotePatchRequest = {
      comment: {
        body: "Bu talep, TICKET-1 talebinin yan konuşmasıdır. Talep sahibi bu yazışmayı görmez.",
        publicVisible: false,
        creator: [{ key: "us.email", value: "agent@example.com" }],
        channel: "WEB",
      },
      fields: [{ key: "tu.side_conversation_parent", value: "TICKET-1" }],
    };

    await tickets.addInternalNote("TICKET-1", body);

    const sentBody = JSON.parse(send.mock.calls[0][1].body);
    expect(sentBody.comment.publicVisible).toBe(false);
    expect(sentBody.comment.channel).toBe("WEB");
  });

  it("carries the parent ticket key in fields[0] under the side-conversation field key", async () => {
    const body: InternalNotePatchRequest = {
      comment: {
        body: "Bu talep, TICKET-9 talebinin yan konuşmasıdır. Talep sahibi bu yazışmayı görmez.",
        publicVisible: false,
        creator: [{ key: "us.email", value: "agent@example.com" }],
        channel: "WEB",
      },
      fields: [{ key: "tu.side_conversation_parent", value: "TICKET-9" }],
    };

    await tickets.addInternalNote("TICKET-9", body);

    const sentBody = JSON.parse(send.mock.calls[0][1].body);
    expect(sentBody.fields).toEqual([
      { key: "tu.side_conversation_parent", value: "TICKET-9" },
    ]);
  });

  it("sends the auth headers, same as replyTicket", async () => {
    const body: InternalNotePatchRequest = {
      comment: {
        body: "Bu talep, TICKET-2 talebinin yan konuşmasıdır. Talep sahibi bu yazışmayı görmez.",
        publicVisible: false,
        creator: [{ key: "us.email", value: "agent@example.com" }],
        channel: "WEB",
      },
      fields: [{ key: "tu.side_conversation_parent", value: "TICKET-2" }],
    };

    await tickets.addInternalNote("TICKET-2", body);

    expect(send.mock.calls[0][1].headers).toEqual({
      Authorization: "Bearer test-token",
      tenantId: "test-tenant",
    });
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

  it.each([
    ["SOLVED", "4"],
    ["OPEN", "2"],
  ] as const)(
    "passes the exact %s status-only body through to public/v1/tickets, never /v2/tickets (D-15)",
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
