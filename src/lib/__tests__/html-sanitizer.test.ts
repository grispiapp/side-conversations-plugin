import {
  buildQuotedReplyParts,
  sanitizeHtml,
  sanitizeUntrustedDraftHtml,
  splitGeneratedReplyHtml,
  splitQuotedHtml,
} from "../html-sanitizer";
import DOMPurify from "dompurify";

describe("sanitizeHtml", () => {
  it("preserves only the lightweight formatting allowlist", () => {
    const result = sanitizeHtml(
      "<p>Hello <strong>bold</strong> <b>b</b> <em>em</em> <i>i</i><br></p>" +
        "<ul><li>one</li></ul><ol><li>two</li></ol><blockquote>old</blockquote>"
    );

    expect(result).toBe(
      "<p>Hello <strong>bold</strong> <b>b</b> <em>em</em> <i>i</i><br></p>" +
        "<ul><li>one</li></ul><ol><li>two</li></ol><blockquote>old</blockquote>"
    );
  });

  it("removes hostile elements, handlers, inline styles, images and tables", () => {
    const result = sanitizeHtml(
      '<p style="background:url(//tracker)" onclick="steal()">Safe</p>' +
        "<script>alert(1)</script><style>body{display:none}</style>" +
        '<img src="https://tracker.test/pixel">' +
        "<table><tr><td>secret layout</td></tr></table>" +
        "<iframe srcdoc='<script>steal()</script>'></iframe>" +
        "<svg><a href='javascript:steal()'>bad</a></svg>"
    );

    expect(result).toBe("<p>Safe</p>");
    expect(result).not.toMatch(/script|style=|onclick|img|table|iframe|svg/i);
  });

  it("normalizes safe anchors and strips unsafe protocols and extra attributes", () => {
    const result = sanitizeHtml(
      '<a href="https://example.test" class="x">web</a>' +
        '<a href="http://example.test" target="_self">http</a>' +
        '<a href="mailto:a@example.test">mail</a>' +
        '<a href="javascript:alert(1)" target="_blank">js</a>' +
        '<a href="data:text/html,boom">data</a>' +
        '<a href="vbscript:boom">vb</a>' +
        '<a href=" //example.test/path">scheme-relative</a>'
    );

    expect(result).toContain(
      '<a href="https://example.test" target="_blank" rel="noopener noreferrer">web</a>'
    );
    expect(result).toContain(
      '<a href="http://example.test" target="_blank" rel="noopener noreferrer">http</a>'
    );
    expect(result).toContain(
      '<a href="mailto:a@example.test" rel="noopener noreferrer">mail</a>'
    );
    expect(result).toContain("<a>js</a>");
    expect(result).toContain("<a>data</a>");
    expect(result).toContain("<a>vb</a>");
    expect(result).toContain("<a>scheme-relative</a>");
    expect(result).not.toContain('class="x"');
  });

  it("unwraps unknown benign markup so its sanitized content is not lost", () => {
    expect(
      sanitizeHtml(
        '<div class="gmail_quote"><p>Current</p><section><strong>kept</strong></section></div>'
      )
    ).toBe("<p>Current</p><strong>kept</strong>");
  });

  it("delegates the shared HTML boundary to DOMPurify", () => {
    const sanitize = jest.spyOn(DOMPurify, "sanitize");

    expect(sanitizeHtml("<p>Safe</p>")).toBe("<p>Safe</p>");
    expect(sanitize).toHaveBeenCalledTimes(1);

    sanitize.mockRestore();
  });

  it("drops active and data-bearing families with their payloads", () => {
    const result = sanitizeHtml(
      "<script><p>script payload</p></script>" +
        "<style><p>style payload</p></style>" +
        "<svg><text>svg payload</text></svg>" +
        "<math><mtext>math payload</mtext></math>" +
        "<iframe><p>frame payload</p></iframe>" +
        '<img src="https://tracker.test/pixel" alt="image payload">' +
        "<table><tbody><tr><td>table payload</td></tr></tbody></table>" +
        "<template><p>template payload</p></template>"
    );

    expect(result).toBe("");
  });

  it("strips event, style, data and aria attributes from pasted provider HTML", () => {
    expect(
      sanitizeHtml(
        '<p class="MsoNormal" style="margin:0" data-provider="word" aria-label="hidden" onmouseover="steal()">' +
          '<span style="font-family:Arial">Word</span><o:p>&nbsp;</o:p></p>' +
          '<div dir="ltr" class="gmail_default"><strong>Gmail</strong></div>'
      )
    ).toBe("<p>Word&nbsp;</p><strong>Gmail</strong>");
  });

  it("accepts only canonical web and mail links after URI obfuscation checks", () => {
    const result = sanitizeHtml(
      '<a href="https:\n//example.test/path">web</a>' +
        '<a href="mailto:ada@example.test">mail</a>' +
        '<a href="/relative">relative</a>' +
        '<a href="data:text/html,boom">data</a>' +
        '<a href="java&#x0A;script:alert(1)">encoded-js</a>' +
        '<a href="jav&#x61;script:alert(1)">entity-js</a>'
    );

    expect(result).toContain(
      '<a href="https://example.test/path" target="_blank" rel="noopener noreferrer">web</a>'
    );
    expect(result).toContain(
      '<a href="mailto:ada@example.test" rel="noopener noreferrer">mail</a>'
    );
    expect(result).toContain("<a>relative</a>");
    expect(result).toContain("<a>data</a>");
    expect(result).toContain("<a>encoded-js</a>");
    expect(result).toContain("<a>entity-js</a>");
  });
});

describe("quote boundary helpers", () => {
  it("drops pasted/restored history and any spoofed provenance marker", () => {
    expect(
      sanitizeUntrustedDraftHtml(
        '<p>Current</p><blockquote data-sc-authored-quote="true"><p>Inherited</p></blockquote><p>Leaked trailing history</p>'
      )
    ).toBe("<p>Current</p>");
  });

  it("splits only at the first sanitized plain blockquote", () => {
    expect(
      splitQuotedHtml(
        '<div class="provider"><p>Current</p></div>' +
          "<blockquote><p>Prior</p><blockquote>Older</blockquote></blockquote>"
      )
    ).toEqual({
      bodyHtml: "<p>Current</p>",
      quotedHtml: "<p>Prior</p><blockquote>Older</blockquote>",
    });
  });

  it("keeps unknown quote-like markup in the body", () => {
    expect(
      splitQuotedHtml('<div class="gmail_quote"><p>Do not guess</p></div>')
    ).toEqual({ bodyHtml: "<p>Do not guess</p>" });
  });

  it("builds one sanitized non-nested quote from chronological public context", () => {
    const result = buildQuotedReplyParts("<p>New <em>reply</em></p>", [
      {
        authoredBodyHtml: "<p>Public 1</p>",
        publicVisible: true,
      },
      {
        authoredBodyHtml: '<p onclick="steal()">Internal note</p>',
        publicVisible: false,
      },
      {
        authoredBodyHtml: "<p>Public 2<script>steal()</script></p>",
        publicVisible: true,
      },
    ]);

    expect(result.outboundHtml).toBe(
      "<p>New <em>reply</em></p><blockquote><p>Public 1</p><p>Public 2</p></blockquote>"
    );
    expect(result.authoredBodyHtml).toBe("<p>New <em>reply</em></p>");
    expect(result.historyHtml).toBe("<p>Public 1</p><p>Public 2</p>");
    expect(result.outboundHtml.match(/<blockquote>/g)).toHaveLength(1);
    expect(result.outboundHtml).not.toContain("Internal note");
    expect(result.outboundHtml).not.toContain("script");
  });

  it("preserves authored reply blockquotes and trailing authored content as explicit parts", () => {
    const result = buildQuotedReplyParts(
      "<blockquote><p>Agent quote</p></blockquote><p>After quote</p>",
      [
        {
          authoredBodyHtml: "<p>Canonical body</p>",
          publicVisible: true,
        },
      ]
    );

    expect(result).toEqual({
      authoredBodyHtml:
        "<blockquote><p>Agent quote</p></blockquote><p>After quote</p>",
      historyHtml: "<p>Canonical body</p>",
      outboundHtml:
      "<blockquote><p>Agent quote</p></blockquote><p>After quote</p><blockquote><p>Canonical body</p></blockquote>"
    });
  });

  it("recognizes generated history only when the final quote exactly matches structured public context", () => {
    const context = [
      {
        authoredBodyHtml: "<p>Earlier</p>",
        publicVisible: true,
      },
    ];
    expect(
      splitGeneratedReplyHtml(
        "<blockquote><p>Agent quote</p></blockquote><p>After quote</p><blockquote><p>Earlier</p></blockquote>",
        context
      )
    ).toEqual({
      bodyHtml:
        "<blockquote><p>Agent quote</p></blockquote><p>After quote</p>",
      quotedHtml: "<p>Earlier</p>",
    });
    expect(
      splitGeneratedReplyHtml(
        "<p>Authored</p><blockquote><p>Different authored quote</p></blockquote>",
        context
      )
    ).toEqual({
      bodyHtml:
        "<p>Authored</p><blockquote><p>Different authored quote</p></blockquote>",
    });
  });
});
