import { observer } from "mobx-react-lite";
import { KeyboardEvent } from "react";

import { Textarea } from "@/components/ui/textarea";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";

/**
 * Mesaj alanı (D-10/D-11/D-12). Plain Enter is left COMPLETELY untouched —
 * a `<textarea>`'s native newline behavior is already correct (RESEARCH.md
 * Pattern 2) — only `Shift+Enter` is intercepted to submit, the inverted
 * shortcut this phase's UI-SPEC calls for (D-12). The reentrancy guard
 * itself lives in `ComposeStore.submit` (D-17), so both entry points this
 * phase (this Shift+Enter handler, and Plan 05's "Gönder" button) call the
 * SAME `submit` and get the SAME protection for free — `submitting` here
 * only disables the field as a visible extra cue, not the actual guard.
 */
export const MessageField = observer(() => {
  const { agentEmail, ticket } = useGrispi();
  const compose = useStore().compose;

  function handleKeyDown(event: KeyboardEvent<HTMLTextAreaElement>): void {
    if (event.key === "Enter" && event.shiftKey) {
      event.preventDefault();
      void compose.submit(agentEmail, ticket?.key ?? "");
    }
  }

  return (
    <div className="flex flex-col gap-1">
      <Textarea
        value={compose.message}
        onChange={(event) => compose.setMessage(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Mesajınızı yazın…"
        disabled={compose.submitting}
      />
      <span className="text-xs text-muted-foreground">
        Enter: yeni satır · Shift+Enter: gönder
      </span>
    </div>
  );
});
