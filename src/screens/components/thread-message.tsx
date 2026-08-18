import { ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons";
import { FC, useState } from "react";

import { attachmentKind } from "@/lib/attachment-format";
import {
  sanitizeAuthoredHtml,
  sanitizeHtml,
  splitQuotedHtml,
} from "@/lib/html-sanitizer";
import { cn } from "@/lib/utils";
import { AttachmentChip } from "@/screens/components/attachment-chip";
import { AttachmentChipVM } from "@/store/attachment-upload-store";
import { Attachment } from "@/types/grispi.type";

export interface ThreadMessageData {
  id: string;
  direction: "own" | "incoming";
  body: string;
  status: "pending" | "sent" | "failed";
  createdAt: number;
  errorKind?: "network" | "server";
  senderName?: string;
  senderEmail?: string;
  internal?: boolean;
  authoredBodyHtml?: string;
  quotedHtml?: string;
  attachments?: Attachment[];
}

export interface ThreadMessageProps {
  message: ThreadMessageData;
  showFullSender?: boolean;
  agentEmail?: string | null;
  agentName?: string | null;
  onRetry: (id: string) => void;
}

/**
 * Gerçek gönderen adını üretir — sabit "Siz" metni kalktı çünkü aynı yan
 * konuşmaya birden fazla temsilci yazabilir (D-13). `isCurrentAgent` yalnızca
 * bir bayraktır; rozeti adın YERİNE değil YANINA render etmek çağıranın işi
 * (D-14).
 */
/**
 * D-15 (revised 2026-08-17 by live UAT): the label is "Dahili not", and the
 * note now names its author instead of replacing them. Rendered as a
 * separate `shrink-0` element rather than folded into the name string, so a
 * narrow panel truncates the AUTHOR and never the message TYPE — losing
 * "which kind of message is this" is worse than losing a surname.
 */
const INTERNAL_NOTE_LABEL = "Dahili not";

function senderLabel(
  message: ThreadMessageData,
  showFullSender: boolean,
  agentEmail: string | null | undefined,
  agentName: string | null | undefined
): { text: string; isCurrentAgent: boolean; typeLabel?: string } {
  if (message.internal) {
    // Same API-sourced identity as any other message (comment.creator).
    const author = message.senderName || message.senderEmail || null;
    return {
      // With no resolvable author the label stands alone — never an orphan
      // separator, never "Dahili not · Dahili not".
      text: author ?? INTERNAL_NOTE_LABEL,
      isCurrentAgent: false,
      typeLabel: author ? INTERNAL_NOTE_LABEL : undefined,
    };
  }

  const pendingOwnFallback =
    message.direction === "own" && !message.senderName
      ? agentName
      : undefined;
  const name =
    message.senderName ||
    pendingOwnFallback ||
    message.senderEmail ||
    "Gönderen";
  const text =
    showFullSender && message.senderName && message.senderEmail
      ? `${message.senderName} <${message.senderEmail}>`
      : name;
  const isCurrentAgent =
    message.direction === "own" &&
    Boolean(agentEmail) &&
    message.senderEmail === agentEmail;

  return { text, isCurrentAgent };
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(timestamp);
}

function toAttachmentChipVM(attachment: Attachment): AttachmentChipVM {
  return {
    id: `attachment-${attachment.id}`,
    filename: attachment.filename,
    size: attachment.size,
    mimeType: attachment.mimeType,
    status: "done",
    attachmentId: attachment.id,
  };
}

/**
 * UI-SPEC §9 — two zones, only the zones with content render: an image
 * thumbnail row first (any `image/*` attachment except SVG, D-10 — SVG is
 * NEVER thumbnailed anywhere in this plugin), then a file chip row for
 * everything else (pdf/video/generic/svg), reusing the same read-only
 * `AttachmentChip` shell the composer uses (Plan 03). `inline: true`
 * attachments are NOT filtered here (D-22, deliberate divergence from
 * grispi-ui) — this plugin never renders incoming body images (D-21), so
 * this list is the only place a third party's screenshot is ever visible.
 * `objectUrl` needs no auth header (Plan 01 live probe) and is rendered/
 * linked directly; every link opens in a new tab via plain anchor semantics
 * (D-20) — no imperative popup-window API is used anywhere in this file.
 */
function ThreadAttachments({
  attachments,
}: {
  attachments: Attachment[];
}): JSX.Element {
  const images = attachments.filter(
    (attachment) => attachmentKind(attachment.mimeType) === "image"
  );
  const files = attachments.filter(
    (attachment) => attachmentKind(attachment.mimeType) !== "image"
  );

  return (
    <div className="mt-1.5">
      {images.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {images.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.objectUrl}
              target="_blank"
              rel="noopener noreferrer"
              title={attachment.filename}
              className="block size-16 shrink-0 overflow-hidden rounded-md border border-border bg-muted/30 transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            >
              <img
                src={attachment.objectUrl}
                alt={attachment.filename}
                className="size-full object-cover"
              />
            </a>
          ))}
        </div>
      )}
      {files.length > 0 && (
        <div
          className={cn(
            "flex flex-wrap items-center gap-1",
            images.length > 0 && "mt-1"
          )}
        >
          {files.map((attachment) => (
            <AttachmentChip
              key={attachment.id}
              chip={toAttachmentChipVM(attachment)}
              href={attachment.objectUrl}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * One row in the continuous chronological email feed. Identity and message
 * type are carried by compact metadata and subtle color, rather than a card
 * shell around every item. Every HTML sink receives only the output of the
 * shared sanitizer/quote splitter.
 */
export const ThreadMessage: FC<ThreadMessageProps> = ({
  message,
  showFullSender = false,
  agentEmail,
  agentName,
  onRetry,
}) => {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const {
    text: senderText,
    isCurrentAgent,
    typeLabel,
  } = senderLabel(message, showFullSender, agentEmail, agentName);
  // This component re-sanitizes `MessageVM`'s already-sanitized HTML as a
  // defense-in-depth second pass (doc-comment below). The second pass MUST
  // follow the same direction rule as the first (normalizeComment) or an
  // inline image that survived there gets stripped here (own direction) —
  // or, worse, an incoming body image would render if this ever picked the
  // permissive policy for the wrong direction (D-21).
  const sanitizer =
    message.direction === "own" ? sanitizeAuthoredHtml : sanitizeHtml;
  const legacyParts =
    message.authoredBodyHtml === undefined
      ? splitQuotedHtml(message.body, sanitizer)
      : undefined;
  const bodyHtml = sanitizer(
    message.authoredBodyHtml ?? legacyParts?.bodyHtml ?? message.body
  );
  const quotedHtml =
    message.quotedHtml !== undefined
      ? sanitizer(message.quotedHtml)
      : legacyParts?.quotedHtml;

  return (
    <article
      data-testid={`thread-message-${message.id}`}
      className={cn(
        "w-full min-w-0 overflow-hidden px-4 py-2.5 text-sm",
        message.direction === "own" &&
          !message.internal &&
          "bg-primary/[0.025]",
        message.internal &&
          "border-l-2 border-l-amber-500 bg-amber-50/70 pl-[14px]"
      )}
    >
      <header className="mb-1 flex items-center justify-between gap-3 text-xs">
        <span className="flex min-w-0 items-center gap-1.5">
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 shrink-0 rounded-full bg-slate-400",
              message.direction === "own" &&
                !message.internal &&
                "bg-primary/80",
              message.internal && "bg-amber-500"
            )}
          />
          <span
            data-testid="sender-name"
            className={cn(
              "min-w-0 truncate font-semibold text-foreground",
              message.direction === "own" &&
                !message.internal &&
                "text-primary",
              message.internal && "text-amber-800"
            )}
          >
            {senderText}
          </span>
          {typeLabel && (
            <span
              data-testid="sender-type"
              className="shrink-0 font-medium text-amber-800/80"
            >
              · {typeLabel}
            </span>
          )}
          {isCurrentAgent && (
            <span
              data-testid="sender-badge"
              className="inline-flex shrink-0 items-center rounded-full bg-primary/10 px-1.5 py-0 text-[10px] font-semibold text-primary"
            >
              Siz
            </span>
          )}
        </span>
        <time
          className="shrink-0 text-[11px] tabular-nums text-muted-foreground"
          dateTime={new Date(message.createdAt).toISOString()}
        >
          {formatTime(message.createdAt)}
        </time>
      </header>

      <div
        className="rich-text-content break-words pl-3 leading-5 text-foreground [overflow-wrap:anywhere]"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {quotedHtml !== undefined && (
        <div className="mt-2 pl-3">
          <button
            type="button"
            aria-label="Önceki e-postayı göster"
            aria-expanded={quoteOpen}
            className="inline-flex min-h-9 items-center rounded-md text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setQuoteOpen((current) => !current)}
          >
            Önceki e-postayı göster
          </button>
          {quoteOpen && (
            <blockquote
              className="rich-text-content mt-2 border-l-2 border-border pl-3 text-muted-foreground"
              dangerouslySetInnerHTML={{ __html: quotedHtml }}
            />
          )}
        </div>
      )}

      {message.attachments && message.attachments.length > 0 && (
        <div className="pl-3">
          <ThreadAttachments attachments={message.attachments} />
        </div>
      )}

      {message.status === "pending" && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Gönderiliyor"
          className="mt-1.5 flex min-h-8 items-center gap-1 pl-3 text-xs text-muted-foreground"
        >
          <ReloadIcon className="size-3 animate-spin" />
          <span>Gönderiliyor</span>
        </div>
      )}

      {message.status === "failed" && (
        <div role="alert">
          <button
            type="button"
            aria-label="Gönderilemedi. Tekrar dene"
            className="mt-1.5 flex min-h-9 items-center gap-1 rounded-md pl-3 text-xs text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => onRetry(message.id)}
          >
            <ExclamationTriangleIcon className="size-3 shrink-0" />
            <span>
              {message.errorKind === "network"
                ? "Bağlantı sorunu · Gönderilemedi. Tekrar dene"
                : "Gönderilemedi · Tekrar dene"}
            </span>
          </button>
        </div>
      )}
    </article>
  );
};
