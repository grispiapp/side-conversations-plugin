import { cn } from "@/lib/utils";

interface ParentKeyChipProps {
  parentKey: string;
  size?: "default" | "compact";
}

/**
 * D-10 — the PARENT ticket's key, rendered as a neutral, non-interactive
 * chip. Deliberately a plain `<span>` with no interactive/navigational
 * attributes of any kind — this is never a link/button, so it can never
 * be confused with `TicketKeyLink` (the side ticket's key).
 */
export function ParentKeyChip({ parentKey, size = "default" }: ParentKeyChipProps) {
  const compact = size === "compact";
  return (
    <span
      aria-label={`Üst talep: ${parentKey}`}
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full border border-border bg-muted text-muted-foreground",
        compact ? "px-1 py-0 text-[10px] leading-4" : "px-2 py-0.5 text-xs font-medium"
      )}
    >
      <span>üst talep</span>
      <span className="font-mono text-foreground">{parentKey}</span>
    </span>
  );
}
