import { resolveTicketStatusTag } from "@/lib/ticket-status";

interface StatusTagProps {
  statusName: string | null | undefined;
}

/**
 * The host agent UI's `MiniTag` in its compact (single-letter) form — a
 * coloured square carrying the ticket's own status.
 *
 * Distinct from the row's action badge ("Yanıt bekleniyor"): that answers
 * "whose turn is it", this answers "what state is the ticket in". They are
 * shown together because the agent needs both.
 *
 * The colour is an inline style rather than a Tailwind class because the
 * value is data-driven and mirrored hex-for-hex from grispi-ui's antd
 * palette — same approach MiniTag itself takes.
 */
export function StatusTag({ statusName }: StatusTagProps) {
  const tag = resolveTicketStatusTag(statusName);
  if (!tag) return null;

  return (
    <span
      role="img"
      aria-label={`Durum: ${tag.label}`}
      title={tag.label}
      style={{ backgroundColor: tag.color }}
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-[10px] font-bold leading-none text-white"
    >
      {tag.letter}
    </span>
  );
}
