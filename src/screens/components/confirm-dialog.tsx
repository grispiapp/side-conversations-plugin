import { FC } from "react";

import { Button } from "@/components/ui/button";

/**
 * D-02 (dirty-back) ve D-03 (parent-değişim) için TEK paylaşılan onay
 * dialog'u — 02-CONTEXT.md'nin açık talimatı ("D-02 VE D-03 için TEK
 * bileşen, farklı copy/props"). En yakın görsel analog `error-card.tsx`'in
 * merkezi card + mesaj + buton(lar) yerleşimi (02-PATTERNS.md) — burada
 * modal olduğu için ayrıca tam-ekran `bg-black/40` overlay eklenir (Faz 1'de
 * hiç modal yoktu, bu fazın ilk overlay'i).
 *
 * `cancelLabel` her zaman güvenli/geri-dönüşsüz aksiyonu temsil eder
 * (`outline` variant), `confirmLabel` her zaman yıkıcı aksiyonu temsil eder
 * (`destructive` variant) — asla bare "Tamam"/"OK" (02-UI-SPEC.md
 * "Destructive confirmation summary").
 */
export const ConfirmDialog: FC<{
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}> = ({ title, body, confirmLabel, cancelLabel, onConfirm, onCancel }) => {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-black/40">
      <div className="mx-4 flex w-full max-w-sm flex-col gap-3 rounded-lg bg-card p-6 shadow-lg">
        <h3 className="text-base font-semibold">{title}</h3>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex justify-end gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant="destructive" size="sm" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
