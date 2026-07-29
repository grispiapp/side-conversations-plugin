import { observer } from "mobx-react-lite";
import { FC, forwardRef } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import {
  ConversationActionBadge,
  ConversationRowVM,
} from "@/store/side-conversations-store";

const BADGE_VARIANT: Record<
  ConversationActionBadge,
  "new-reply" | "awaiting-reply"
> = {
  "yeni-yanit": "new-reply",
  "yanit-bekleniyor": "awaiting-reply",
};

const BADGE_LABEL: Record<ConversationActionBadge, string> = {
  "yeni-yanit": "Yeni yanıt",
  "yanit-bekleniyor": "Yanıt bekleniyor",
};

// `observer` so silent store-side row upgrades (hydration retry, recipient
// enrichment — Plan 01-03 UAT Defect 2) always re-render this card even if a
// future change mutates a row field in place instead of replacing the array.
export const ConversationRow = observer(
  forwardRef<
    HTMLButtonElement,
    {
      row: ConversationRowVM;
      onSelect: () => void;
    }
  >(({ row, onSelect }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onSelect}
        className={cn(
          "flex w-full flex-col gap-2 rounded-md bg-card px-4 py-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          // LIST-03's only highlight mechanism: 3px primary left rail.
          row.hasUnseen && "border-l-[3px] border-l-primary",
          row.hydrationFailed && "opacity-60"
        )}
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1 text-xs">
            <span className="truncate font-mono">{row.recipientEmail}</span>
            <span className="text-muted-foreground">·</span>
            <span className="shrink-0 text-muted-foreground">
              {row.lastPublicCommentAt !== null
                ? formatRelativeTime(row.lastPublicCommentAt)
                : ""}
            </span>
          </div>
          {row.lifecycle === "solved" && (
            <Badge variant="closed">Çözüldü</Badge>
          )}
          {row.actionBadge !== null && (
            <Badge variant={BADGE_VARIANT[row.actionBadge]}>
              {BADGE_LABEL[row.actionBadge]}
            </Badge>
          )}
        </div>
        <p className="truncate text-sm font-normal">{row.subject}</p>
        {!row.hydrationFailed && (
          <p className="truncate text-sm text-muted-foreground">
            {row.summary}
          </p>
        )}
      </button>
    );
  })
);
ConversationRow.displayName = "ConversationRow";

export const SkeletonRow: FC = () => {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-card px-4 py-3">
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
};
