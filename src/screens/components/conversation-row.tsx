import { observer } from "mobx-react-lite";
import { FC, forwardRef } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import {
  ConversationActionBadge,
  ConversationRowVM,
} from "@/store/side-conversations-store";

const BADGE_LABEL: Record<ConversationActionBadge, string> = {
  "yeni-yanit": "Yeni yanıt",
  "yanit-bekleniyor": "Yanıt bekleniyor",
};

export const ConversationRow = observer(
  forwardRef<
    HTMLButtonElement,
    {
      row: ConversationRowVM;
      onSelect: () => void;
    }
  >(({ row, onSelect }, ref) => {
    return (
      <div role="listitem" className="border-b border-border last:border-b-0">
        <button
          ref={ref}
          type="button"
          onClick={onSelect}
          className={cn(
            "relative flex min-h-[72px] w-full min-w-0 flex-col justify-center bg-card px-[var(--panel-inset)] py-2 text-left focus-visible:z-[1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            row.hydrationFailed && "opacity-60"
          )}
        >
          {row.hasUnseen && (
            <span
              aria-hidden="true"
              className="absolute inset-y-0 left-0 w-[3px] bg-primary"
            />
          )}
          <div className="flex min-w-0 items-center gap-1 text-xs leading-4">
            <span className="min-w-0 truncate font-mono">
              {row.recipientEmail}
            </span>
            <span className="shrink-0 text-muted-foreground">·</span>
            <time className="shrink-0 text-muted-foreground">
              {row.lastPublicCommentAt !== null
                ? formatRelativeTime(row.lastPublicCommentAt)
                : ""}
            </time>
          </div>
          <p className="min-w-0 truncate text-sm font-normal leading-5">
            {row.subject}
          </p>
          <div className="flex min-w-0 items-center gap-2 text-xs leading-4">
            <p className="min-w-0 flex-1 truncate text-muted-foreground">
              {row.hydrationFailed ? "" : row.summary}
            </p>
            {!row.hydrationFailed && (
              <span
                className={cn(
                  "shrink-0 font-semibold",
                  row.lifecycle !== "open"
                    ? "text-slate-600"
                    : row.actionBadge === "yeni-yanit"
                      ? "text-amber-800"
                      : "text-emerald-800"
                )}
              >
                {row.hasUnseen && "Görülmemiş · "}
                {row.lifecycle !== "open"
                  ? row.lifecycle === "closed"
                    ? "Kapalı"
                    : "Çözüldü"
                  : row.actionBadge !== null
                    ? BADGE_LABEL[row.actionBadge]
                    : "Açık"}
              </span>
            )}
          </div>
        </button>
      </div>
    );
  })
);
ConversationRow.displayName = "ConversationRow";

export const SkeletonRow: FC = () => {
  return (
    <div
      aria-hidden="true"
      className="flex min-h-[72px] flex-col justify-center gap-1 bg-card px-[var(--panel-inset)] py-2"
    >
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-3 w-1/2" />
    </div>
  );
};
