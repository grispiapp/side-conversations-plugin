import {
  sanitizeAuthoredHtml,
  sanitizeHtml,
  sanitizeUntrustedDraftHtml,
  splitGeneratedReplyHtml,
  splitQuotedHtml,
} from "../html-sanitizer";
import DOMPurify from "dompurify";

describe("incoming/strict policy (sanitizeHtml) — D-21, never loosened", () => {
  it("preserves only the lightweight formatting allowlist", () => {
    const result = sanitizeHtml(
      "<p>Hello <strong>bold</strong> <b>b</b> <em>em</em> <i>i</i><br></p>" +
        "<h1>One</h1><h2>Two</h2><h3>Three</h3>" +
        "<ul><li>one</li></ul><ol><li>two</li></ol><blockquote>old</blockquote>"
    );

    expect(result).toBe(
      "<p>Hello <strong>bold</strong> <b>b</b> <em>em</em> <i>i</i><br></p>" +
        "<h1>One</h1><h2>Two</h2><h3>Three</h3>" +
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

  it("drops active and data-bearing families with their payloads, including img (D-21)", () => {
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

  it("never widens the allowed attribute set beyond href (regression guard)", () => {
    // Locks the incoming policy's ALLOWED_ATTR surface — this must never
    // silently grow to include src/alt/anything else (D-21).
    const result = sanitizeHtml(
      '<img src="https://example.test/pic.png" alt="leaked">' +
        '<a href="https://example.test" src="https://example.test" alt="leaked">link</a>'
    );
    expect(result).not.toMatch(/src=|alt=/i);
  });
});

describe("quote boundary helpers default to the strict policy", () => {
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
      bodyHtml: "<blockquote><p>Agent quote</p></blockquote><p>After quote</p>",
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

  it("splitQuotedHtml/sanitizeUntrustedDraftHtml default to the strict policy even if an img is present", () => {
    // No sanitizer argument passed — must fall back to the SAFE side, never
    // the permissive one (D-21's default-safe guarantee).
    expect(
      splitQuotedHtml('<p>Body</p><img src="https://example.test/pic.png">')
    ).toEqual({ bodyHtml: "<p>Body</p>" });
    expect(
      sanitizeUntrustedDraftHtml(
        '<p>Body</p><img src="https://example.test/pic.png">'
      )
    ).toBe("<p>Body</p>");
  });
});

describe("authored-content policy (sanitizeAuthoredHtml) — D-14/COMP-08", () => {
  it("keeps an https-sourced image tag and its alt text alive", () => {
    const result = sanitizeAuthoredHtml(
      '<p>Look</p><img src="https://usercontent.grispi.net/abc123" alt="ekran görüntüsü">'
    );
    expect(result).toBe(
      '<p>Look</p><img src="https://usercontent.grispi.net/abc123" alt="ekran görüntüsü">'
    );
  });

  it("strips an event-handler attribute from an image tag but keeps the tag itself", () => {
    const result = sanitizeAuthoredHtml(
      '<img src="https://example.test/pic.png" onerror="steal()" onload="steal()">'
    );
    expect(result).toBe('<img src="https://example.test/pic.png">');
    expect(result).not.toMatch(/onerror|onload/i);
  });

  it("strips a script-protocol image src, leaving no src at all", () => {
    const result = sanitizeAuthoredHtml(
      '<img src="javascript:alert(1)" alt="bad">'
    );
    expect(result).not.toMatch(/src=/i);
    expect(result).not.toMatch(/javascript:/i);
  });

  it("strips a data-protocol image src — this policy does NOT open data: URIs", () => {
    const result = sanitizeAuthoredHtml(
      '<img src="data:image/png;base64,AAAA" alt="bad">'
    );
    expect(result).not.toMatch(/src=/i);
    expect(result).not.toMatch(/data:/i);
  });

  it("locks the plain-http image src outcome to the existing protocol regexp result", () => {
    // ALLOWED_URI_REGEXP already accepts http:// (unchanged from the
    // incoming policy) — assert that directly since img/src is newly
    // security-load-bearing here.
    const result = sanitizeAuthoredHtml(
      '<img src="http://example.test/pic.png" alt="plain http">'
    );
    expect(result).toBe(
      '<img src="http://example.test/pic.png" alt="plain http">'
    );
  });

  it("still removes a vector-graphic tag with its content (D-10)", () => {
    const result = sanitizeAuthoredHtml(
      "<p>Before</p><svg><text>svg payload</text></svg><p>After</p>"
    );
    expect(result).toBe("<p>Before</p><p>After</p>");
    expect(result).not.toMatch(/svg/i);
  });

  it("still removes script, iframe, object, style and form tags with their content", () => {
    const result = sanitizeAuthoredHtml(
      "<script><p>script payload</p></script>" +
        "<iframe><p>frame payload</p></iframe>" +
        "<object><p>object payload</p></object>" +
        "<style><p>style payload</p></style>" +
        "<form><p>form payload</p></form>"
    );
    expect(result).toBe("");
  });

  it("hardens links exactly like the incoming policy (new tab + safe rel)", () => {
    const result = sanitizeAuthoredHtml(
      '<a href="https://example.test" class="x">web</a>' +
        '<a href="javascript:alert(1)">js</a>'
    );
    expect(result).toContain(
      '<a href="https://example.test" target="_blank" rel="noopener noreferrer">web</a>'
    );
    expect(result).toContain("<a>js</a>");
  });

  it("escapes input it cannot parse, same fallback as sanitizeHtml", () => {
    const originalDOMParser = global.DOMParser;
    // @ts-expect-error deliberately breaking DOM parsing for the fallback path
    delete global.DOMParser;

    expect(sanitizeAuthoredHtml("<p>a & b</p>")).toBe("&lt;p&gt;a &amp; b&lt;/p&gt;");

    global.DOMParser = originalDOMParser;
  });
});

describe("quote boundary helpers with the authored sanitizer explicitly passed", () => {
  it("splitQuotedHtml keeps an inline image alive when passed sanitizeAuthoredHtml", () => {
    expect(
      splitQuotedHtml(
        '<p>Body</p><img src="https://example.test/pic.png" alt="shot">' +
          "<blockquote><p>Quoted</p></blockquote>",
        sanitizeAuthoredHtml
      )
    ).toEqual({
      bodyHtml: '<p>Body</p><img src="https://example.test/pic.png" alt="shot">',
      quotedHtml: "<p>Quoted</p>",
    });
  });

  it("splitGeneratedReplyHtml matches an image-bearing quoted history when both sides use the same sanitizer", () => {
    const context = [
      {
        authoredBodyHtml:
          '<p>Earlier</p><img src="https://example.test/pic.png" alt="shot">',
        publicVisible: true,
      },
    ];
    expect(
      splitGeneratedReplyHtml(
        '<p>New reply</p><img src="https://example.test/new.png" alt="new">' +
          '<blockquote><p>Earlier</p><img src="https://example.test/pic.png" alt="shot"></blockquote>',
        context,
        sanitizeAuthoredHtml
      )
    ).toEqual({
      bodyHtml:
        '<p>New reply</p><img src="https://example.test/new.png" alt="new">',
      quotedHtml: '<p>Earlier</p><img src="https://example.test/pic.png" alt="shot">',
    });
  });
});
