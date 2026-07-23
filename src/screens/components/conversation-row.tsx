import { FC } from "react";

import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { formatRelativeTime } from "@/lib/relative-time";
import { ConversationRowVM } from "@/store/side-conversations-store";

export const ConversationRow: FC<{ row: ConversationRowVM }> = ({ row }) => {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-md bg-card px-4 py-3",
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
        {/* Plan 02 slot: status Badge + unread rail render here. */}
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
