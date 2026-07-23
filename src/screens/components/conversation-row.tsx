import { FC } from "react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ConversationBadge } from "@/lib/conversation-status";
import { formatRelativeTime } from "@/lib/relative-time";
import { cn } from "@/lib/utils";
import { ConversationRowVM } from "@/store/side-conversations-store";

const BADGE_VARIANT: Record<
  ConversationBadge,
  "new-reply" | "awaiting-reply" | "closed"
> = {
  "yeni-yanit": "new-reply",
  "yanit-bekleniyor": "awaiting-reply",
  kapali: "closed",
};

const BADGE_LABEL: Record<ConversationBadge, string> = {
  "yeni-yanit": "Yeni yanıt",
  "yanit-bekleniyor": "Yanıt bekleniyor",
  kapali: "Kapalı",
};

export const ConversationRow: FC<{ row: ConversationRowVM }> = ({ row }) => {
  const isNewReply = row.badge === "yeni-yanit";

  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md bg-card px-4 py-3",
        // LIST-03's only highlight mechanism: 3px primary left rail.
        isNewReply && "border-l-[3px] border-l-primary",
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
        <Badge variant={BADGE_VARIANT[row.badge]}>{BADGE_LABEL[row.badge]}</Badge>
      </div>
      <p className="truncate text-sm font-normal">{row.subject}</p>
      {!row.hydrationFailed && (
        <p className="truncate text-sm text-muted-foreground">{row.summary}</p>
      )}
    </div>
  );
};

export const SkeletonRow: FC = () => {
  return (
    <div className="flex flex-col gap-2 rounded-md bg-card px-4 py-3">
      <Skeleton className="h-3 w-2/3" />
      <Skeleton className="h-4 w-4/5" />
      <Skeleton className="h-4 w-1/2" />
    </div>
  );
};
