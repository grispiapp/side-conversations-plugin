import { ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons";
import { cva } from "class-variance-authority";
import { FC } from "react";

import { cn } from "@/lib/utils";
import { MessageVM } from "@/store/active-conversation-store";

/**
 * Uses the same cva and cn convention as badge.tsx. `own` represents the
 * agent's message; `incoming` is the extension point for two-way threads.
 */
const bubbleVariants = cva("max-w-[85%] rounded-lg px-3 py-2 text-sm", {
  variants: {
    direction: {
      own: "ml-auto rounded-br-sm bg-primary text-primary-foreground",
      incoming: "mr-auto bg-card",
    },
  },
  defaultVariants: { direction: "own" },
});

/**
 * Optimistic message bubble (COMP-04, D-14/D-15). The body is rendered only
 * through React text interpolation; untrusted content is never interpreted
 * as HTML. Pending messages show a spinner, sent messages remove it, and
 * failed messages retain their body with a retry action. Only a localized
 * error category is rendered; raw HTTP response details never reach the UI.
 */
export const MessageBubble: FC<{
  message: MessageVM;
  onRetry: (id: string) => void;
}> = ({ message, onRetry }) => {
  return (
    <div className={cn(bubbleVariants({ direction: message.direction }))}>
      <p className="whitespace-pre-wrap break-words">{message.body}</p>

      {message.status === "pending" && (
        <div className="mt-1 flex justify-end">
          <ReloadIcon className="size-3 animate-spin text-primary-foreground/70" />
        </div>
      )}

      {message.status === "failed" && (
        <button
          type="button"
          className="mt-1 flex items-center gap-1 text-xs text-red-200 hover:underline"
          onClick={() => onRetry(message.id)}
        >
          <ExclamationTriangleIcon className="size-3 shrink-0" />
          <span>
            {message.errorKind === "network"
              ? "Bağlantı sorunu · Gönderilemedi. Tekrar dene"
              : "Gönderilemedi · Tekrar dene"}
          </span>
        </button>
      )}
    </div>
  );
};

export { bubbleVariants };
