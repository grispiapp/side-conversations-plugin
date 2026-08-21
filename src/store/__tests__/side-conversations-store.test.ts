import {
  ConversationRowVM,
  dedupeAndSortConversationRows,
  patchConversationRowFromDetail,
  projectConversationRow,
  refreshConversationRowUnseen,
} from "../side-conversations-store";

import { SideTicketSummary, Ticket } from "@/types/grispi.type";

function makeTicket(overrides: Partial<Ticket> = {}): Ticket {
  return {
    key: "SIDE-1",
    callMergeStatus: null,
    channel: "EMAIL",
    form: {} as Ticket["form"],
    createdAt: 0,
    updatedAt: 0,
    solvedAt: null,
    comments: [],
    fieldMap: {},
    relation: [],
    resolution: null,
    ...overrides,
  };
}

function makeComment(
  createdAt: number,
  authority: "ROLE_ADMIN" | "ROLE_END_USER",
  email: string,
  body = "<p>Merhaba</p>"
): Ticket["comments"][number] {
  return {
    attachments: [],
    id: createdAt,
    body,
    publicVisible: true,
    ticketKey: "SIDE-1",
    createdAt,
    creator: {
      id: authority === "ROLE_END_USER" ? 7 : 9,
      email,
      role: {
        authority,
        impliedAuthorities: [],
        teamUser: authority !== "ROLE_END_USER",
      },
    } as unknown as Ticket["comments"][number]["creator"],
    call: null,
    toId: null,
    toEmail: null,
    commentCCs: [],
    mentionedUsers: [],
    channel: "EMAIL",
    externalId: "",
  };
}

function summary(
  key: string,
  statusId = 1,
  subject = `Subject ${key}`
): SideTicketSummary {
  return {
    key,
    subject,
    status: { id: statusId, name: "status" },
  };
}

describe("side-conversation row projection", () => {
  beforeEach(() => window.localStorage.clear());

  it("projects recipient, plain-text summary and action state; hasUnseen is always false from the fetch-time projection (B2: render-time owns it)", () => {
    const row = projectConversationRow(
      summary("SIDE-1"),
      makeTicket({
        fieldMap: {
          "ts.requester": { key: "ts.requester", value: "7" },
        },
        comments: [
          makeComment(
            4000,
            "ROLE_END_USER",
            "vendor@example.test",
            "<p>Yeni <strong>yanıt</strong></p>"
          ),
        ],
      })
    );

    expect(row).toMatchObject({
      key: "SIDE-1",
      recipientEmail: "vendor@example.test",
      requesterId: 7,
      subject: "Subject SIDE-1",
      summary: "Yeni yanıt",
      lifecycle: "open",
      actionBadge: "new-reply",
      hasUnseen: false,
      hydrationFailed: false,
    });

    // The unread-dot invariant this test used to assert at fetch time now
    // lives at render time (refreshConversationRowUnseen): no lastSeenAt
    // recorded yet, so a fresh reply reads as unseen the moment it's
    // derived.
    expect(refreshConversationRowUnseen("tenant-1", row)).toMatchObject({
      actionBadge: "new-reply",
      hasUnseen: true,
    });
  });

  it("returns a neutral visible row for failed hydration and never exposes the key as recipient", () => {
    expect(projectConversationRow(summary("SIDE-SECRET"), null)).toEqual({
      key: "SIDE-SECRET",
      recipientEmail: "—",
      requesterId: null,
      subject: "Subject SIDE-SECRET",
      summary: "",
      lifecycle: "open",
      actionBadge: null,
      hasUnseen: false,
      lastPublicCommentAt: null,
      hydrationFailed: true,
      // Raw status survives even a failed hydration: it comes from the
      // advanced-search summary, not from the ticket fetch that failed.
      statusName: "status",
    });
  });

  it("preserves CLOSED independently from SOLVED in projected rows", () => {
    const row = projectConversationRow(
      summary("SIDE-CLOSED", 5),
      makeTicket({
        key: "SIDE-CLOSED",
        comments: [makeComment(4_000, "ROLE_END_USER", "vendor@example.test")],
      })
    );

    expect(row).toMatchObject({
      key: "SIDE-CLOSED",
      lifecycle: "closed",
      actionBadge: null,
      hasUnseen: false,
    });
  });

  it("deduplicates by ticket key and globally sorts new, waiting, then solved", () => {
    const base = {
      recipientEmail: "x@example.test",
      requesterId: 1,
      subject: "s",
      summary: "",
      hasUnseen: false,
      hydrationFailed: false,
      statusName: null,
    };
    const rows: ConversationRowVM[] = [
      {
        ...base,
        key: "SOLVED",
        lifecycle: "solved",
        actionBadge: null,
        lastPublicCommentAt: 9000,
      },
      {
        ...base,
        key: "WAITING",
        lifecycle: "open",
        actionBadge: "awaiting-reply",
        lastPublicCommentAt: 8000,
      },
      {
        ...base,
        key: "NEW",
        lifecycle: "open",
        actionBadge: "new-reply",
        lastPublicCommentAt: 1000,
      },
      {
        ...base,
        key: "NEW",
        subject: "duplicate",
        lifecycle: "open",
        actionBadge: "new-reply",
        lastPublicCommentAt: 500,
      },
    ];

    expect(
      dedupeAndSortConversationRows("tenant-1", rows).map((row) => row.key)
    ).toEqual(["NEW", "WAITING", "SOLVED"]);
  });

  it("derives unseen state at render time from the read watermark (B2: refreshConversationRowUnseen is the sole owner)", () => {
    const row = projectConversationRow(
      summary("SIDE-1"),
      makeTicket({
        comments: [makeComment(4000, "ROLE_END_USER", "vendor@example.test")],
      })
    );
    // Projection itself never computes it anymore.
    expect(row.hasUnseen).toBe(false);

    expect(refreshConversationRowUnseen("tenant-1", row)).toMatchObject({
      actionBadge: "new-reply",
      hasUnseen: true,
    });

    window.localStorage.setItem("sc:lastSeenAt:tenant-1:SIDE-1", "4000");

    expect(refreshConversationRowUnseen("tenant-1", row)).toMatchObject({
      actionBadge: "new-reply",
      hasUnseen: false,
    });
  });

  it("does not reuse a same-side-key read watermark across tenants (render-time derivation)", () => {
    window.localStorage.setItem("sc:lastSeenAt:tenant-a:SIDE-1", "4000");
    const ticket = makeTicket({
      comments: [makeComment(4000, "ROLE_END_USER", "vendor@example.test")],
    });
    const row = projectConversationRow(summary("SIDE-1"), ticket);

    const tenantA = refreshConversationRowUnseen("tenant-a", row);
    const tenantB = refreshConversationRowUnseen("tenant-b", row);

    expect(tenantA.hasUnseen).toBe(false);
    expect(tenantB.hasUnseen).toBe(true);
  });
});

describe("patchConversationRowFromDetail (Task 2 B3)", () => {
  function baseRow(overrides: Partial<ConversationRowVM> = {}): ConversationRowVM {
    return {
      key: "SIDE-1",
      recipientEmail: "vendor@example.test",
      requesterId: 7,
      subject: "Konu",
      summary: "Eski özet",
      lifecycle: "open",
      actionBadge: "awaiting-reply",
      hasUnseen: true,
      lastPublicCommentAt: 1_000,
      hydrationFailed: false,
      statusName: "Open",
      ...overrides,
    };
  }

  it("solve: writes the canonical Solved status name, clears actionBadge and hasUnseen, patches summary from the latest public message", () => {
    const patched = patchConversationRowFromDetail(baseRow(), {
      lifecycle: "solved",
      messages: [
        {
          createdAt: 1_000,
          direction: "incoming",
          internal: false,
          body: "<p>Eski</p>",
        },
        {
          createdAt: 2_000,
          direction: "own",
          internal: false,
          body: "<p>Çözüldü olarak işaretlendi</p>",
        },
      ],
    });

    expect(patched).toMatchObject({
      lifecycle: "solved",
      actionBadge: null,
      hasUnseen: false,
      summary: "Çözüldü olarak işaretlendi",
      lastPublicCommentAt: 2_000,
      statusName: "Solved",
    });
    // Untouched fields survive the patch unchanged.
    expect(patched.key).toBe("SIDE-1");
    expect(patched.hydrationFailed).toBe(false);
  });

  it("reopen: writes the canonical Open status name only because the row's PREVIOUS lifecycle was not open", () => {
    const solvedRow = baseRow({ lifecycle: "solved", statusName: "Solved" });
    const patched = patchConversationRowFromDetail(solvedRow, {
      lifecycle: "open",
      messages: [
        {
          createdAt: 3_000,
          direction: "own",
          internal: false,
          body: "<p>Tekrar açıldı</p>",
        },
      ],
    });

    expect(patched.lifecycle).toBe("open");
    expect(patched.statusName).toBe("Open");
    expect(patched.actionBadge).toBe("awaiting-reply");
  });

  it("reply: patches summary/lastPublicCommentAt to the latest public message and leaves statusName alone when lifecycle stays open", () => {
    const openRow = baseRow({ lifecycle: "open", statusName: "Açık" });
    const patched = patchConversationRowFromDetail(openRow, {
      lifecycle: "open",
      messages: [
        {
          createdAt: 1_000,
          direction: "incoming",
          internal: false,
          body: "<p>İlk</p>",
        },
        {
          createdAt: 5_000,
          direction: "own",
          internal: false,
          body: "<p>Yeni yanıt gönderildi</p>",
        },
      ],
    });

    expect(patched.summary).toBe("Yeni yanıt gönderildi");
    expect(patched.lastPublicCommentAt).toBe(5_000);
    expect(patched.actionBadge).toBe("awaiting-reply");
    // "Açık" is not provable from an unchanged "open" lifecycle
    // (Yeni/Açık/Beklemede stay indistinguishable) — statusName is left as-is.
    expect(patched.statusName).toBe("Açık");
  });

  it("never proves a status name for a row that was already open and stays open (Yeni/Açık/Beklemede stay ambiguous)", () => {
    const openRow = baseRow({ lifecycle: "open", statusName: "Yeni" });
    const patched = patchConversationRowFromDetail(openRow, {
      lifecycle: "open",
      messages: [],
    });

    expect(patched.statusName).toBe("Yeni");
  });

  it("ignores internal notes when deriving the badge and summary — only public messages count", () => {
    const patched = patchConversationRowFromDetail(baseRow(), {
      lifecycle: "open",
      messages: [
        {
          createdAt: 9_000,
          direction: "own",
          internal: true,
          body: "<p>İç not, görünmemeli</p>",
        },
        {
          createdAt: 2_000,
          direction: "incoming",
          internal: false,
          body: "<p>Genel yorum</p>",
        },
      ],
    });

    expect(patched.summary).toBe("Genel yorum");
    expect(patched.lastPublicCommentAt).toBe(2_000);
  });
});
