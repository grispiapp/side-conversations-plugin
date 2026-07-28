const ALLOWED_TAGS = new Set([
  "A",
  "B",
  "BLOCKQUOTE",
  "BR",
  "EM",
  "I",
  "LI",
  "OL",
  "P",
  "STRONG",
  "UL",
]);

/**
 * These elements are removed with their contents. Other unknown elements are
 * unwrapped so harmless provider wrappers do not make message text disappear.
 */
const DROP_WITH_CONTENT = new Set([
  "AUDIO",
  "BASE",
  "EMBED",
  "FORM",
  "IFRAME",
  "IMG",
  "LINK",
  "MATH",
  "META",
  "OBJECT",
  "SCRIPT",
  "SOURCE",
  "STYLE",
  "SVG",
  "TABLE",
  "TEMPLATE",
  "VIDEO",
]);

const SAFE_HREF = /^(?:https?:|mailto:)/i;

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

function isSafeHref(rawHref: string): boolean {
  // Browsers ignore ASCII whitespace/control characters while resolving a
  // scheme. Remove them for the policy check so `java\nscript:` cannot pass.
  const canonical = rawHref.replace(/[\u0000-\u0020\u007f]+/g, "");
  return SAFE_HREF.test(canonical);
}

function normalizeAnchor(anchor: HTMLAnchorElement): void {
  const rawHref = anchor.getAttribute("href")?.trim();

  for (const attribute of Array.from(anchor.attributes)) {
    anchor.removeAttribute(attribute.name);
  }

  if (!rawHref || !isSafeHref(rawHref)) return;

  anchor.setAttribute("href", rawHref);
  if (/^https?:/i.test(rawHref)) {
    anchor.setAttribute("target", "_blank");
  }
  anchor.setAttribute("rel", "noopener noreferrer");
}

/**
 * Sanitizes both remote message HTML and locally-created editor HTML with one
 * deterministic DOM policy. No caller-specific exception is permitted.
 *
 * If DOM parsing is unavailable, the original value is escaped. That fallback
 * is safe at an HTML sink and displays as plain text instead of attempting to
 * interpret partially-sanitized markup.
 */
export function sanitizeHtml(input: string): string {
  if (!input) return "";

  const body = parseBody(input);
  if (!body) return escapeHtml(input);

  const walker = body.ownerDocument.createTreeWalker(
    body,
    NodeFilter.SHOW_ELEMENT
  );
  const elements: Element[] = [];
  let current = walker.nextNode();

  while (current) {
    elements.push(current as Element);
    current = walker.nextNode();
  }

  // Work inside-out so unwrapping an unknown provider element retains its
  // already-sanitized descendants.
  for (const element of elements.reverse()) {
    if (!element.parentNode) continue;
    const tagName = element.tagName.toUpperCase();

    if (DROP_WITH_CONTENT.has(tagName)) {
      element.remove();
      continue;
    }

    if (!ALLOWED_TAGS.has(tagName)) {
      const fragment = body.ownerDocument.createDocumentFragment();
      while (element.firstChild) fragment.appendChild(element.firstChild);
      element.replaceWith(fragment);
      continue;
    }

    if (tagName === "A") {
      normalizeAnchor(element as HTMLAnchorElement);
      continue;
    }

    for (const attribute of Array.from(element.attributes)) {
      element.removeAttribute(attribute.name);
    }
  }

  return body.innerHTML;
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

  const quoteStart = sanitized.indexOf("<blockquote>");
  if (quoteStart < 0) return { bodyHtml: sanitized };

  return {
    bodyHtml: sanitized.slice(0, quoteStart),
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
