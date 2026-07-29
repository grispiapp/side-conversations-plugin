import { observer } from "mobx-react-lite";

import { useStore } from "@/contexts/store-context";
import { RichTextComposer } from "@/screens/components/rich-text-composer";

/**
 * Message field (D-10/D-11/D-12). Plain Enter remains untouched —
 * a `<textarea>`'s native newline behavior is already correct (RESEARCH.md
 * Pattern 2) — only `Shift+Enter` is intercepted to submit, the inverted
 * shortcut this phase's UI-SPEC calls for (D-12). The reentrancy guard
 * itself lives in `ComposeStore.submit` (D-17), so both entry points this
 * phase (the Shift+Enter handler and submit button) call the
 * SAME `submit` and get the SAME protection for free — `submitting` here
 * only disables the field as a visible extra cue, not the actual guard.
 */
export interface MessageFieldProps {
  onSubmit: () => void;
  submitDisabled?: boolean;
}

export const MessageField = observer(
  ({ onSubmit, submitDisabled = false }: MessageFieldProps) => {
    const compose = useStore().compose;

    return (
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <RichTextComposer
          value={compose.message}
          editorLabel="Mesaj"
          sectionLabel="Yeni görüşme mesajı"
          placeholder="Mesajınızı yazın…"
          mode="compose"
          submitDisabled={submitDisabled}
          submitting={compose.submitting}
          required
          valueIsTrustedAuthored
          onChange={(html) => compose.setAuthoredMessage(html)}
          onSubmit={(html) => {
            compose.setAuthoredMessage(html);
            onSubmit();
          }}
          disabled={compose.submitting}
        />
      </div>
    );
  }
);
