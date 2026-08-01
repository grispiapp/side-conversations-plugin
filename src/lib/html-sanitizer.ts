import DOMPurify, { Config } from "dompurify";

const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "em",
  "h1",
  "h2",
  "h3",
  "i",
  "li",
  "ol",
  "p",
  "strong",
  "ul",
];

/**
 * These elements are removed with their contents. Other unknown elements are
 * unwrapped so harmless provider wrappers do not make message text disappear.
 */
const DROP_WITH_CONTENT = [
  "audio",
  "base",
  "embed",
  "form",
  "iframe",
  "img",
  "link",
  "math",
  "meta",
  "object",
  "script",
  "source",
  "style",
  "svg",
  "table",
  "template",
  "video",
];

const SANITIZE_CONFIG: Config = {
  ALLOWED_TAGS,
  ALLOWED_ATTR: ["href"],
  ALLOW_ARIA_ATTR: false,
  ALLOW_DATA_ATTR: false,
  ALLOW_UNKNOWN_PROTOCOLS: false,
  ALLOWED_URI_REGEXP: /^(?:https?:\/\/|mailto:)/i,
  FORBID_TAGS: DROP_WITH_CONTENT,
  FORBID_CONTENTS: DROP_WITH_CONTENT,
};

// Authored-content policy (D-14/COMP-08): permits `img`+`src`/`alt` for
// content THIS plugin composes and is about to send (composer body, draft
// restore of our own authored value, outgoing envelope). Every other flag —
// the protocol allowlist, `svg` staying forbidden, aria/data attribute
// stripping — is copied verbatim from `SANITIZE_CONFIG`. `img` is the ONLY
// tag removed from the forbid lists; `svg` MUST remain forbidden in both
// policies (D-10 — this plugin never embeds SVG, only shows it as a file
// chip, because an `<object>`/`<iframe>`-embedded SVG can run script).
// `ALLOWED_URI_REGEXP` already restricts `src`/`href` to `https?://`/
// `mailto:` — no `data:` allowance is added or needed (Grispi's returned
// `objectUrl` is always `https://`; opening `data:` here would widen the
// attack surface for zero benefit).
const AUTHORED_ALLOWED_TAGS = [...ALLOWED_TAGS, "img"];
const AUTHORED_FORBID_LIST = DROP_WITH_CONTENT.filter((tag) => tag !== "img");
const AUTHORED_SANITIZE_CONFIG: Config = {
  ...SANITIZE_CONFIG,
  ALLOWED_TAGS: AUTHORED_ALLOWED_TAGS,
  ALLOWED_ATTR: ["href", "src", "alt"],
  FORBID_TAGS: AUTHORED_FORBID_LIST,
  FORBID_CONTENTS: AUTHORED_FORBID_LIST,
};

export interface QuotedHtmlParts {
  bodyHtml: string;
  quotedHtml?: string;
}

export interface QuotedContextPart {
  authoredBodyHtml: string;
  publicVisible: boolean;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function parseBody(html: string): HTMLElement | null {
  if (typeof DOMParser === "undefined") return null;

  try {
    return new DOMParser().parseFromString(html, "text/html").body;
  } catch {
    return null;
  }
}

function canonicalizeUri(rawValue: string): string | undefined {
  // Browsers ignore ASCII whitespace/control characters while resolving a
  // scheme. Remove them for the policy check so `java\nscript:` cannot pass.
  const canonical = Array.from(rawValue.trim())
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 0x20 && codePoint !== 0x7f;
    })
    .join("");

  if (/^https?:\/\//i.test(canonical)) {
    try {
      const url = new URL(canonical);
      return /^(?:http|https):$/.test(url.protocol) && url.hostname
        ? canonical
        : undefined;
    } catch {
      return undefined;
    }
  }

  return /^mailto:[^:]+$/i.test(canonical) ? canonical : undefined;
}

function normalizeAnchor(anchor: HTMLAnchorElement): void {
  const safeHref = canonicalizeUri(anchor.getAttribute("href") || "");

  for (const attribute of Array.from(anchor.attributes)) {
    anchor.removeAttribute(attribute.name);
  }

  if (!safeHref) return;

  anchor.setAttribute("href", safeHref);
  if (/^https?:/i.test(safeHref)) {
    anchor.setAttribute("target", "_blank");
  }
  anchor.setAttribute("rel", "noopener noreferrer");
}

/**
 * DOMPurify has a built-in exception (its `DATA_URI_TAGS` default set, which
 * always includes `img`) that lets a `data:` URI through on `<img src>`
 * REGARDLESS of `ALLOWED_URI_REGEXP` — and that default cannot be narrowed
 * via config (`ADD_DATA_URI_TAGS` only ever adds to it, never removes from
 * it). Since `img` is only unforbidden in the authored policy, this
 * DOMPurify-internal bypass is otherwise silently reachable there. This
 * post-pass re-applies the SAME protocol canonicalization already used for
 * anchors to every `<img src>`, closing that gap without touching
 * `ALLOWED_URI_REGEXP` itself (no caller relies on this loop finding an
 * `<img>` under the incoming policy, since `img` stays forbidden there).
 */
function stripUnsafeImageSrc(root: HTMLElement): void {
  for (const image of Array.from(root.querySelectorAll("img"))) {
    const safeSrc = canonicalizeUri(image.getAttribute("src") || "");
    if (safeSrc) {
      image.setAttribute("src", safeSrc);
    } else {
      image.removeAttribute("src");
    }
  }
}

function sanitizeWithConfig(input: string, config: Config): string {
  if (!input) return "";

  const body = parseBody(input);
  if (!body) return escapeHtml(input);

  const sanitized = DOMPurify.sanitize(input, config);
  const sanitizedBody = parseBody(sanitized);
  if (!sanitizedBody) return escapeHtml(input);

  for (const anchor of Array.from(sanitizedBody.querySelectorAll("a"))) {
    normalizeAnchor(anchor);
  }
  stripUnsafeImageSrc(sanitizedBody);

  return sanitizedBody.innerHTML;
}

/**
 * Sanitizes remote/untrusted message HTML with one explicit DOMPurify
 * policy. Used for EVERY incoming/remote HTML boundary: fetched message
 * bodies, quoted history, pasted clipboard HTML, and restored drafts
 * (`sanitizeUntrustedDraftHtml`). No caller-specific exception is permitted
 * — `img` stays forbidden here so a remote sender can never smuggle a
 * tracking-pixel `<img>` into the panel (D-21).
 *
 * If DOM parsing is unavailable, the original value is escaped. That fallback
 * is safe at an HTML sink and displays as plain text instead of attempting to
 * interpret partially-sanitized markup.
 */
export function sanitizeHtml(input: string): string {
  return sanitizeWithConfig(input, SANITIZE_CONFIG);
}

/**
 * Sanitizes content THIS plugin authored and is about to send or has already
 * sent: composer body, draft restore of our own authored value, and the
 * outgoing envelope. This is the ONLY sanitizer that permits `<img src>` —
 * required so a pasted screenshot (uploaded to Grispi, referenced by its
 * `https://` `objectUrl`, D-14/COMP-08) survives sanitization and is still
 * visible when our own sent message round-trips back into the thread.
 *
 * Does NOT apply to: incoming/remote message HTML, quoted/forwarded history,
 * pasted clipboard HTML, or any restored-from-storage untrusted draft — all
 * of those stay on `sanitizeHtml`/`sanitizeUntrustedDraftHtml` (D-21). Never
 * route content whose author/origin is not "this agent, this session" here.
 *
 * `svg` stays forbidden in both policies (D-10) — SVG is never embedded
 * inline anywhere in this plugin (shown only as a file chip that opens in a
 * new tab), because an `<img>`-referenced or `<object>`/`<iframe>`-embedded
 * SVG can execute script.
 */
export function sanitizeAuthoredHtml(input: string): string {
  return sanitizeWithConfig(input, AUTHORED_SANITIZE_CONFIG);
}

/**
 * The live tenant probe established the first plain blockquote as the only
 * stable quote boundary. Provider class names are intentionally ignored.
 *
 * `sanitizer` defaults to the strict incoming policy — every pre-existing
 * caller (and its tests) keeps today's exact behavior unchanged. The
 * authored-content call site (`normalizeComment`, own-direction messages)
 * passes `sanitizeAuthoredHtml` explicitly so an inline image survives the
 * split; a call site that forgets to pass anything automatically falls back
 * to the SAFE (strict) side, never the permissive one (D-21).
 */
export function splitQuotedHtml(
  input: string,
  sanitizer: (html: string) => string = sanitizeHtml
): QuotedHtmlParts {
  const sanitized = sanitizer(input);
  const body = parseBody(sanitized);
  if (!body) return { bodyHtml: sanitized };

  const quote = body.querySelector("blockquote");
  if (!quote) return { bodyHtml: sanitized };

  const range = body.ownerDocument.createRange();
  range.setStart(body, 0);
  range.setEndBefore(quote);
  const beforeQuote = body.ownerDocument.createElement("div");
  beforeQuote.appendChild(range.cloneContents());

  return {
    bodyHtml: beforeQuote.innerHTML,
    quotedHtml: quote.innerHTML,
  };
}

/**
 * Treats externally supplied editor content as untrusted draft restoration.
 * A plain blockquote is the probed provider-history boundary, so the quote
 * and everything after it are discarded before the value enters draft state.
 * DOMPurify strips any spoofed marker attributes before boundary detection.
 */
export function sanitizeUntrustedDraftHtml(input: string): string {
  return splitQuotedHtml(input).bodyHtml;
}

function buildPublicHistoryHtml(
  context: readonly QuotedContextPart[],
  sanitizer: (html: string) => string
): string {
  return context
    .filter((part) => part.publicVisible)
    .map((part) => sanitizer(part.authoredBodyHtml))
    .filter(Boolean)
    .join("");
}

/**
 * Recognizes only the history shape generated by this plugin: the final
 * top-level blockquote must exactly equal the structured public context.
 * Authored blockquotes elsewhere remain part of the visible authored body.
 *
 * `sanitizer` defaults to the strict incoming policy, same rationale as
 * `splitQuotedHtml`. The SAME sanitizer instance is used for both the
 * `input`/`historyHtml` sides of the comparison below — comparing under two
 * different policies would make a blockquote whose body carries a
 * (permitted-under-authored-only) `<img>` fail to match, corrupting the
 * quote boundary for a message that has an inline image.
 */
export function splitGeneratedReplyHtml(
  input: string,
  context: readonly QuotedContextPart[],
  sanitizer: (html: string) => string = sanitizeHtml
): QuotedHtmlParts {
  const sanitized = sanitizer(input);
  const historyHtml = buildPublicHistoryHtml(context, sanitizer);
  const body = parseBody(sanitized);
  if (!body || !historyHtml) return { bodyHtml: sanitized };

  const nodes = Array.from(body.childNodes);
  let quoteIndex = nodes.length - 1;
  while (
    quoteIndex >= 0 &&
    nodes[quoteIndex].nodeType === 3 &&
    !(nodes[quoteIndex].textContent ?? "").trim()
  ) {
    quoteIndex -= 1;
  }
  const candidate = nodes[quoteIndex];
  const candidateElement = candidate as HTMLElement | undefined;
  if (
    candidateElement?.nodeType !== 1 ||
    candidateElement.tagName.toLowerCase() !== "blockquote" ||
    sanitizer(candidateElement.innerHTML) !== historyHtml
  ) {
    return { bodyHtml: sanitized };
  }

  const authored = body.ownerDocument.createElement("div");
  nodes
    .slice(0, quoteIndex)
    .forEach((node) => authored.appendChild(node.cloneNode(true)));
  return {
    bodyHtml: authored.innerHTML,
    quotedHtml: historyHtml,
  };
}
