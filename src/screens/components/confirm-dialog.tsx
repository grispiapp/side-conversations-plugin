import {
  CheckCircledIcon,
  ExclamationTriangleIcon,
} from "@radix-ui/react-icons";
import { FC, useEffect, useId, useRef } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

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
  tone?: "default" | "danger";
}> = ({
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
  tone = "default",
}) => {
  const titleId = useId();
  const bodyId = useId();
  const overlayRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  onCancelRef.current = onCancel;

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    const overlay = overlayRef.current;
    const backgroundSiblings = Array.from(
      overlay?.parentElement?.children ?? []
    ).filter((element) => element !== overlay);
    const backgroundState = backgroundSiblings.map((element) => ({
      element,
      inert: element.hasAttribute("inert"),
      ariaHidden: element.getAttribute("aria-hidden"),
    }));
    backgroundSiblings.forEach((element) => {
      element.setAttribute("inert", "");
      element.setAttribute("aria-hidden", "true");
    });
    cancelRef.current?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'
        ) ?? []
      );
      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!dialogRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      backgroundState.forEach(({ element, inert, ariaHidden }) => {
        if (!inert) element.removeAttribute("inert");
        if (ariaHidden === null) element.removeAttribute("aria-hidden");
        else element.setAttribute("aria-hidden", ariaHidden);
      });
      previousFocus?.focus();
    };
  }, []);

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-20 flex items-center justify-center bg-slate-950/30 p-4 backdrop-blur-[2px]"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
        className="flex w-full max-w-[340px] flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl shadow-slate-950/15"
      >
        <div className="flex gap-3 p-4 pb-3">
          <span
            className={cn(
              "flex size-9 shrink-0 items-center justify-center rounded-full",
              tone === "danger"
                ? "bg-destructive/10 text-destructive"
                : "bg-primary/10 text-primary"
            )}
          >
            {tone === "danger" ? (
              <ExclamationTriangleIcon className="size-4" aria-hidden="true" />
            ) : (
              <CheckCircledIcon className="size-4" aria-hidden="true" />
            )}
          </span>
          <div className="min-w-0">
            <h2 id={titleId} className="text-sm font-semibold leading-5">
              {title}
            </h2>
            <p
              id={bodyId}
              className="mt-1 text-sm leading-5 text-muted-foreground"
            >
              {body}
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-border bg-muted/30 px-4 py-3">
          <Button
            ref={cancelRef}
            variant="outline"
            size="sm"
            onClick={onCancel}
          >
            {cancelLabel}
          </Button>
          <Button
            variant={tone === "danger" ? "destructive" : "default"}
            size="sm"
            onClick={onConfirm}
          >
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
};
