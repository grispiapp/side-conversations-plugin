import { ExclamationTriangleIcon, ReloadIcon } from "@radix-ui/react-icons";
import { cva } from "class-variance-authority";
import { FC } from "react";

import { cn } from "@/lib/utils";
import { MessageVM } from "@/store/active-conversation-store";

/**
 * `badge.tsx`'in cva+cn kalıbı (02-PATTERNS.md — bubble için doğrudan analog
 * yok, en yakın yapısal örnek). `own` = temsilcinin kendi mesajı (bu fazın
 * tek ürettiği yön); `incoming` Faz 3'ün iki yönlü thread'i için ayrılmış
 * bir seam — bu fazda render edilmiyor (02-UI-SPEC.md "MessageBubble").
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
 * Optimistic mesaj balonu (COMP-04, D-14/D-15). Mesaj gövdesi YALNIZCA React
 * text interpolation ile basılır — ham-HTML enjeksiyon prop'u KULLANILMAZ
 * (Faz 1 T-01, bu fazda T-02-02 olarak yeniden doğrulanır): harici/güvenilmeyen
 * içerik hiçbir zaman HTML olarak yorumlanmaz.
 *
 * Durum makinesi: `pending` → balonun sağ-altında dönen `ReloadIcon`;
 * `sent` → spinner kaybolur, ek bir checkmark eklenmez (ikon bütçesi
 * minimal); `failed` → mesaj metni KORUNUR (D-15 — balon kırmızıya
 * boyanmaz), altında tıklanabilir "Gönderilemedi · Tekrar dene" satırı
 * `onRetry(message.id)`'i tetikler. Failed satırının rengi `text-red-200`
 * (02-UI-SPEC.md Bubble state colors — `bg-primary` üzerinde AA kontrastı
 * geçen, `text-destructive-foreground`den ayrışan alternatif).
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
          <span>Gönderilemedi · Tekrar dene</span>
        </button>
      )}
    </div>
  );
};

export { bubbleVariants };
