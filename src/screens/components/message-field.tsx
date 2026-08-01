import { observer } from "mobx-react-lite";
import { toast } from "sonner";

import { useStore } from "@/contexts/store-context";
import { rejectionToastLines } from "@/lib/attachment-format";
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
    const store = useStore();
    const compose = store.compose;
    const attachmentUpload = store.attachmentUpload;

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
          attachments={attachmentUpload.chips("compose")}
          attachmentsUploading={attachmentUpload.isUploading("compose")}
          onAttachFiles={(files) => {
            const rejections = attachmentUpload.addFiles("compose", files);
            if (rejections.length === 0) return;
            // D-11/UI-SPEC §3 — one summary toast per batch, never one per
            // rejected file (avoids pile-up when many files are dropped).
            toast.error("Bazı dosyalar eklenmedi", {
              description: (
                <div className="whitespace-pre-line">
                  {rejectionToastLines(rejections).join("\n")}
                </div>
              ),
              duration: 5000,
            });
          }}
          onRemoveAttachment={(chipId) =>
            attachmentUpload.removeChip("compose", chipId)
          }
          onRetryAttachment={(chipId) =>
            attachmentUpload.retryChip("compose", chipId)
          }
          onInlineImagePaste={async (file) => {
            try {
              const image = await attachmentUpload.uploadInlineImage(
                "compose",
                file
              );
              return image.objectUrl;
            } catch {
              // UI-SPEC §7/§8.4 — inline paste failure is a TOAST, never
              // inline (no retry affordance exists for this path, D-14).
              // The composer already removed its placeholder before this
              // promise settled (rich-text-composer.tsx's
              // `startInlineImageUpload` catch branch).
              toast.error("Görsel yüklenemedi, editöre eklenemedi.", {
                duration: 4000,
              });
              return undefined;
            }
          }}
        />
      </div>
    );
  }
);
