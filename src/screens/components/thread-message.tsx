import { ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons";
import { FC, useState } from "react";

import { sanitizeHtml, splitQuotedHtml } from "@/lib/html-sanitizer";
import { cn } from "@/lib/utils";

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
}

export interface ThreadMessageProps {
  message: ThreadMessageData;
  showFullSender?: boolean;
  onRetry: (id: string) => void;
}

function senderLabel(
  message: ThreadMessageData,
  showFullSender: boolean
): string {
  if (message.internal) return "İç not · Salt okunur";
  if (message.direction === "own") return "Siz";

  const name = message.senderName || message.senderEmail || "Gönderen";
  return showFullSender && message.senderName && message.senderEmail
    ? `${message.senderName} <${message.senderEmail}>`
    : name;
}

function formatTime(timestamp: number): string {
  return new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(timestamp);
}

/**
 * A full-width chronological email block. Every HTML sink receives only the
 * output of the shared sanitizer/quote splitter.
 */
export const ThreadMessage: FC<ThreadMessageProps> = ({
  message,
  showFullSender = false,
  onRetry,
}) => {
  const [quoteOpen, setQuoteOpen] = useState(false);
  const legacyParts =
    message.authoredBodyHtml === undefined
      ? splitQuotedHtml(message.body)
      : undefined;
  const bodyHtml = sanitizeHtml(
    message.authoredBodyHtml ?? legacyParts?.bodyHtml ?? message.body
  );
  const quotedHtml =
    message.quotedHtml !== undefined
      ? sanitizeHtml(message.quotedHtml)
      : legacyParts?.quotedHtml;

  return (
    <article
      data-testid={`thread-message-${message.id}`}
      className={cn(
        "w-full min-w-0 overflow-hidden border-b border-border px-[var(--panel-inset)] py-4 text-sm",
        message.internal && "border-l-[3px] border-l-amber-500 bg-amber-50/60"
      )}
    >
      <header className="mb-2 flex items-baseline justify-between gap-3 text-xs">
        <span
          className={cn(
            "min-w-0 break-words font-medium text-foreground",
            message.direction === "own" && !message.internal && "text-primary",
            message.internal && "text-amber-800"
          )}
        >
          {senderLabel(message, showFullSender)}
        </span>
        <time
          className="shrink-0 text-muted-foreground"
          dateTime={new Date(message.createdAt).toISOString()}
        >
          {formatTime(message.createdAt)}
        </time>
      </header>

      <div
        className="break-words leading-5 text-foreground [overflow-wrap:anywhere] [&_a]:text-primary [&_a]:underline [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3 [&_li]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:list-disc"
        dangerouslySetInnerHTML={{ __html: bodyHtml }}
      />

      {quotedHtml !== undefined && (
        <div className="mt-3">
          <button
            type="button"
            aria-label="Önceki e-postayı göster"
            aria-expanded={quoteOpen}
            className="inline-flex min-h-11 items-center rounded-md text-xs font-semibold text-muted-foreground underline-offset-2 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
            onClick={() => setQuoteOpen((current) => !current)}
          >
            Önceki e-postayı göster
          </button>
          {quoteOpen && (
            <blockquote
              className="mt-2 border-l-2 border-border pl-3 text-muted-foreground [&_a]:underline [&_li]:ml-5 [&_ol]:list-decimal [&_p+p]:mt-2 [&_ul]:list-disc"
              dangerouslySetInnerHTML={{ __html: quotedHtml }}
            />
          )}
        </div>
      )}

      {message.status === "pending" && (
        <div
          role="status"
          aria-live="polite"
          aria-label="Gönderiliyor"
          className="mt-2 flex min-h-11 items-center gap-1 text-xs text-muted-foreground"
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
            className="mt-2 flex min-h-11 items-center gap-1 rounded-md text-xs text-destructive hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
