import { Cross2Icon, InfoCircledIcon } from "@radix-ui/react-icons";

/**
 * UX-06/D-16/D-17. One component, two call sites: compose screen (persistent,
 * dismissible=false) and chat screen (once, dismissible=true, Plan 06). The
 * caller owns visibility and post-dismiss focus — this component never
 * manages its own state.
 */
export function InfoBox({
  dismissible,
  onDismiss,
}: {
  dismissible: boolean;
  onDismiss?: () => void;
}) {
  return (
    <div className="flex items-start gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
      <InfoCircledIcon
        className="mt-0.5 size-3.5 shrink-0"
        aria-hidden="true"
      />
      <p className="min-w-0 flex-1">
        Bu işlem yeni bir talep oluşturur. Alan, atanan ve durum bilgileri
        otomatik dolmaz; gerekiyorsa talep ekranından manuel ayarlayın.
      </p>
      {dismissible && (
        <button
          type="button"
          aria-label="Bilgi kutusunu kapat"
          className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          onClick={onDismiss}
        >
          <Cross2Icon className="size-3" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
