import {
  ConversationBadge,
  deriveBadge,
  sortConversations,
} from "../conversation-status";

describe("deriveBadge", () => {
  it("returns 'kapali' when statusId is SOLVED, regardless of comments", () => {
    const result = deriveBadge({
      statusId: 4,
      publicComments: [{ createdAt: 1000, authorIsAgent: false }],
    });
    expect(result.badge).toBe("kapali");
  });

  it("returns 'kapali' when statusId is CLOSED, regardless of comments", () => {
    const result = deriveBadge({
      statusId: 5,
      publicComments: [{ createdAt: 1000, authorIsAgent: true }],
    });
    expect(result.badge).toBe("kapali");
  });

  it("returns 'yanit-bekleniyor' when the last public comment is agent-authored", () => {
    const result = deriveBadge({
      statusId: null,
      publicComments: [
        { createdAt: 1000, authorIsAgent: false },
        { createdAt: 2000, authorIsAgent: true },
      ],
    });
    expect(result.badge).toBe("yanit-bekleniyor");
    expect(result.lastPublicCommentAt).toBe(2000);
  });

  it("returns 'yeni-yanit' when the last public comment is external-authored", () => {
    const result = deriveBadge({
      statusId: null,
      publicComments: [
        { createdAt: 1000, authorIsAgent: true },
        { createdAt: 2000, authorIsAgent: false },
      ],
    });
    expect(result.badge).toBe("yeni-yanit");
    expect(result.lastPublicCommentAt).toBe(2000);
  });

  it("returns 'yeni-yanit' when there are no public comments yet (D-07 safe default)", () => {
    const result = deriveBadge({ statusId: null, publicComments: [] });
    expect(result.badge).toBe("yeni-yanit");
    expect(result.lastPublicCommentAt).toBeNull();
  });

  it("ignores internal comments entirely — the caller must pre-filter (D-06)", () => {
    // Simulates the caller (store) having already dropped an internal note
    // that would otherwise flip the outcome (an agent-authored internal note
    // is never passed in here) — deriveBadge only ever sees publicComments.
    const result = deriveBadge({
      statusId: null,
      publicComments: [{ createdAt: 1000, authorIsAgent: false }],
    });
    expect(result.badge).toBe("yeni-yanit");
    expect(result.lastPublicCommentAt).toBe(1000);
  });
});

describe("sortConversations", () => {
  it("groups yeni-yanit -> yanit-bekleniyor -> kapali, desc activity within group, nulls last", () => {
    const rows: Array<{
      id: string;
      badge: ConversationBadge;
      lastPublicCommentAt: number | null;
    }> = [
      { id: "closed-old", badge: "kapali", lastPublicCommentAt: 100 },
      { id: "waiting-new", badge: "yanit-bekleniyor", lastPublicCommentAt: 5000 },
      { id: "new-null", badge: "yeni-yanit", lastPublicCommentAt: null },
      { id: "new-recent", badge: "yeni-yanit", lastPublicCommentAt: 9000 },
      { id: "waiting-old", badge: "yanit-bekleniyor", lastPublicCommentAt: 3000 },
      { id: "closed-new", badge: "kapali", lastPublicCommentAt: 200 },
    ];

    const sorted = sortConversations(rows).map((row) => row.id);

    expect(sorted).toEqual([
      "new-recent",
      "new-null",
      "waiting-new",
      "waiting-old",
      "closed-new",
      "closed-old",
    ]);
  });
});
