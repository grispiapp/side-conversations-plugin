import DOMPurify, { Config } from "dompurify";

const ALLOWED_TAGS = [
  "a",
  "b",
  "blockquote",
  "br",
  "em",
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

export interface QuotedHtmlParts {
  bodyHtml: string;
  quotedHtml?: string;
}

export interface QuotedContextPart {
  html: string;
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

function canonicalizeHref(rawHref: string): string | undefined {
  // Browsers ignore ASCII whitespace/control characters while resolving a
  // scheme. Remove them for the policy check so `java\nscript:` cannot pass.
  const canonical = rawHref.trim().replace(/[\u0000-\u0020\u007f]+/g, "");

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
  const safeHref = canonicalizeHref(anchor.getAttribute("href") || "");

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
 * Sanitizes both remote message HTML and locally-created editor HTML with one
 * explicit DOMPurify policy. No caller-specific exception is permitted.
 *
 * If DOM parsing is unavailable, the original value is escaped. That fallback
 * is safe at an HTML sink and displays as plain text instead of attempting to
 * interpret partially-sanitized markup.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return "";

  const body = parseBody(input);
  if (!body) return escapeHtml(input);

  const sanitized = DOMPurify.sanitize(input, SANITIZE_CONFIG);
  const sanitizedBody = parseBody(sanitized);
  if (!sanitizedBody) return escapeHtml(input);

  for (const anchor of Array.from(sanitizedBody.querySelectorAll("a"))) {
    normalizeAnchor(anchor);
  }

  return sanitizedBody.innerHTML;
}

/**
 * The live tenant probe established the first plain blockquote as the only
 * stable quote boundary. Provider class names are intentionally ignored.
 */
export function splitQuotedHtml(input: string): QuotedHtmlParts {
  const sanitized = sanitizeHtml(input);
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
 * Builds the exact probe-confirmed outbound shape: the new reply followed by
 * one blockquote containing sanitized, chronological public context.
 * Existing quoted sections are excluded to prevent recursive quote growth.
 */
export function buildQuotedReplyHtml(
  replyHtml: string,
  context: readonly QuotedContextPart[]
): string {
  const reply = splitQuotedHtml(replyHtml).bodyHtml;
  const publicContext = context
    .filter((part) => part.publicVisible)
    .map((part) => splitQuotedHtml(part.html).bodyHtml)
    .filter(Boolean)
    .join("");

  return publicContext
    ? `${reply}<blockquote>${publicContext}</blockquote>`
    : reply;
}
