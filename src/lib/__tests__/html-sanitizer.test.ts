import {
  buildQuotedReplyHtml,
  sanitizeHtml,
  splitQuotedHtml,
} from "../html-sanitizer";

describe("sanitizeHtml", () => {
  it("preserves only the lightweight formatting allowlist", () => {
    const result = sanitizeHtml(
      "<p>Hello <strong>bold</strong> <b>b</b> <em>em</em> <i>i</i><br>" +
        "<ul><li>one</li></ul><ol><li>two</li></ol><blockquote>old</blockquote></p>"
    );

    expect(result).toBe(
      "<p>Hello <strong>bold</strong> <b>b</b> <em>em</em> <i>i</i><br>" +
        "<ul><li>one</li></ul><ol><li>two</li></ol><blockquote>old</blockquote></p>"
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
});

describe("quote boundary helpers", () => {
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
    const result = buildQuotedReplyHtml("<p>New <em>reply</em></p>", [
      {
        html: '<p>Public 1</p><blockquote><p>already quoted</p></blockquote>',
        publicVisible: true,
      },
      {
        html: '<p onclick="steal()">Internal note</p>',
        publicVisible: false,
      },
      {
        html: '<p>Public 2<script>steal()</script></p>',
        publicVisible: true,
      },
    ]);

    expect(result).toBe(
      "<p>New <em>reply</em></p><blockquote><p>Public 1</p><p>Public 2</p></blockquote>"
    );
    expect(result.match(/<blockquote>/g)).toHaveLength(1);
    expect(result).not.toContain("Internal note");
    expect(result).not.toContain("already quoted");
    expect(result).not.toContain("script");
  });
});
