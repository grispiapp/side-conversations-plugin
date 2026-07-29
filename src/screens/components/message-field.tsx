import { observer } from "mobx-react-lite";

import { useStore } from "@/contexts/store-context";
import { RichTextComposer } from "@/screens/components/rich-text-composer";

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
export interface MessageFieldProps {
  onSubmit: () => void;
}

export const MessageField = observer(({ onSubmit }: MessageFieldProps) => {
  const compose = useStore().compose;

  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-foreground">
          Mesaj <span aria-hidden="true">*</span>
        </span>
        <span className="text-xs text-muted-foreground">Zorunlu</span>
      </div>
      <RichTextComposer
        value={compose.message}
        recipientLabel={compose.recipientLabel || "Henüz alıcı seçilmedi"}
        recipientPrefix="E-posta şu kişiye gidecek:"
        editorLabel="Mesaj"
        sectionLabel="Yeni görüşme mesajı"
        required
        onChange={(html) => compose.setMessage(html)}
        onSubmit={(html) => {
          compose.setMessage(html);
          onSubmit();
        }}
        disabled={compose.submitting}
      />
      <span className="text-xs text-muted-foreground">
        Enter: yeni satır · Shift+Enter: gönder
      </span>
    </div>
  );
});
