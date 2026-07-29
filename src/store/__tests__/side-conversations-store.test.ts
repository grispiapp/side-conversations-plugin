import {
  ConversationRowVM,
  dedupeAndSortConversationRows,
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

  it("projects recipient, plain-text summary and independent unseen/action state", () => {
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
      actionBadge: "yeni-yanit",
      hasUnseen: true,
      hydrationFailed: false,
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
      actionBadge: "yeni-yanit",
      hasUnseen: false,
      lastPublicCommentAt: null,
      hydrationFailed: true,
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
        actionBadge: "yanit-bekleniyor",
        lastPublicCommentAt: 8000,
      },
      {
        ...base,
        key: "NEW",
        lifecycle: "open",
        actionBadge: "yeni-yanit",
        lastPublicCommentAt: 1000,
      },
      {
        ...base,
        key: "NEW",
        subject: "duplicate",
        lifecycle: "open",
        actionBadge: "yeni-yanit",
        lastPublicCommentAt: 500,
      },
    ];

    expect(dedupeAndSortConversationRows(rows).map((row) => row.key)).toEqual([
      "NEW",
      "WAITING",
      "SOLVED",
    ]);
  });

  it("recomputes only local unseen state when the read watermark changes", () => {
    const row = projectConversationRow(
      summary("SIDE-1"),
      makeTicket({
        comments: [makeComment(4000, "ROLE_END_USER", "vendor@example.test")],
      })
    );
    expect(row.hasUnseen).toBe(true);

    window.localStorage.setItem("sc:lastSeenAt:SIDE-1", "4000");

    expect(refreshConversationRowUnseen(row)).toMatchObject({
      actionBadge: "yeni-yanit",
      hasUnseen: false,
    });
  });
});
