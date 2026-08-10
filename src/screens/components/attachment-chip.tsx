import {
  Cross2Icon,
  ExclamationTriangleIcon,
  ExternalLinkIcon,
  FileIcon,
  FileTextIcon,
  ImageIcon,
  ReloadIcon,
  VideoIcon,
} from "@radix-ui/react-icons";
import { FC, ReactNode } from "react";

import { badgeVariants } from "@/components/ui/badge";
import {
  AttachmentKind,
  attachmentKind,
  formatFileSize,
  truncateFilename,
} from "@/lib/attachment-format";
import { cn } from "@/lib/utils";
import { AttachmentChipVM } from "@/store/attachment-upload-store";

export interface AttachmentChipProps {
  chip: AttachmentChipVM;
  /** Composer surfaces only — omitted in read-only (`href`) mode. */
  onRemove?: (chipId: string) => void;
  /** Composer surfaces only — omitted in read-only (`href`) mode. */
  onRetry?: (chipId: string) => void;
  /**
   * Read-only mode (04-UI-SPEC.md §9 thread rendering, THRD-06): when set,
   * the chip renders as an `<a>` opening the attachment in a new tab, with
   * NO remove/retry affordances — a plain trailing `ExternalLinkIcon`
   * replaces the remove button's position.
   */
  href?: string;
}

// UI-SPEC §5's "~14–16 visible characters" composer budget (pill capped at
// max-w-[180px]) vs. §9's "≈28" thread-chip budget (more width available in
// the file chip row's read-only context).
const COMPOSER_FILENAME_MAX_LENGTH = 16;
const THREAD_FILENAME_MAX_LENGTH = 28;

const KIND_ICON_CLASSNAME = "size-3.5 shrink-0 text-muted-foreground";

function KindIcon({ kind }: { kind: AttachmentKind }): JSX.Element {
  switch (kind) {
    // D-10: SVG is deliberately treated like every other non-thumbnailable
    // kind here — `ImageIcon` signals "this is an image" without ever
    // rendering pixel data for it (no `<img>` path exists for `"svg"`).
    case "image":
    case "svg":
      return <ImageIcon className={KIND_ICON_CLASSNAME} />;
    case "pdf":
      return <FileTextIcon className={KIND_ICON_CLASSNAME} />;
    case "video":
      return <VideoIcon className={KIND_ICON_CLASSNAME} />;
    default:
      return <FileIcon className={KIND_ICON_CLASSNAME} />;
  }
}

/**
 * The leading 24px circular slot (UI-SPEC §5): a spinner while uploading, a
 * destructive warning icon once failed, else a MIME-branched thumbnail/icon.
 * SVG never gets the `<img>` thumbnail branch (D-10) — only `kind === "image"`
 * does, and only when a local preview URL exists (composer-uploaded files).
 */
function LeadingSlot({
  chip,
  compact = false,
}: {
  chip: AttachmentChipVM;
  compact?: boolean;
}): JSX.Element {
  const slotClassName = cn(
    "flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-card",
    compact ? "size-5" : "size-6"
  );

  if (chip.status === "uploading") {
    return (
      <span className={slotClassName}>
        <ReloadIcon className="size-3 animate-spin text-muted-foreground" />
      </span>
    );
  }

  if (chip.status === "failed") {
    return (
      <span className={cn(slotClassName, "bg-destructive/10")}>
        <ExclamationTriangleIcon className="size-3 text-destructive" />
      </span>
    );
  }

  const kind = attachmentKind(chip.mimeType);
  return (
    <span className={slotClassName}>
      {kind === "image" && chip.previewUrl ? (
        <img src={chip.previewUrl} alt="" className="size-full object-cover" />
      ) : (
        <KindIcon kind={kind} />
      )}
    </span>
  );
}

/**
 * One chip pill — idle/uploaded, uploading, or failed (D-05/D-06/D-07), or a
 * read-only link variant for already-sent attachments (UI-SPEC §9). Visual
 * shell matches `badgeVariants({ variant: "file" })` exactly (04-UI-SPEC.md
 * §4); filenames are ALWAYS rendered as plain JSX text nodes (T-04-08 — no
 * HTML sink is ever used here, since filenames are untrusted input).
 */
export const AttachmentChip: FC<AttachmentChipProps> = ({
  chip,
  onRemove,
  onRetry,
  href,
}) => {
  const isReadOnly = href !== undefined;
  const maxLength = isReadOnly
    ? THREAD_FILENAME_MAX_LENGTH
    : COMPOSER_FILENAME_MAX_LENGTH;
  const truncatedName = truncateFilename(chip.filename, maxLength);

  const containerClassName = cn(
    badgeVariants({ variant: "file" }),
    isReadOnly
      ? "h-7 max-w-[210px] items-center gap-1.5 px-1.5 py-0 font-normal"
      : "h-8 max-w-[180px] items-center gap-1.5 px-2 py-0 font-normal"
  );

  let body: ReactNode;
  if (chip.status === "failed" && !isReadOnly) {
    const failureReason =
      chip.errorKind === "network" ? "Bağlantı sorunu" : "Yüklenemedi";
    body = (
      <button
        type="button"
        className="min-w-0 flex-1 truncate text-left text-destructive hover:underline"
        onClick={() => onRetry?.(chip.id)}
      >
        {truncatedName} · {failureReason} · Tekrar dene
      </button>
    );
  } else {
    body = (
      <span className="min-w-0 flex-1 truncate">
        <span className="font-medium text-foreground">{truncatedName}</span>
        <span className="text-muted-foreground">
          {" "}
          ·{" "}
          {chip.status === "uploading"
            ? "Yükleniyor…"
            : formatFileSize(chip.size)}
        </span>
      </span>
    );
  }

  const trailing = isReadOnly ? (
    <ExternalLinkIcon className="size-2.5 shrink-0 text-muted-foreground" />
  ) : (
    <button
      type="button"
      aria-label={`${chip.filename} dosyasını kaldır`}
      className="flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onClick={() => onRemove?.(chip.id)}
    >
      <Cross2Icon className="size-2.5" />
    </button>
  );

  if (isReadOnly) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={containerClassName}
        aria-label={`${chip.filename}, ${formatFileSize(chip.size)}, yeni sekmede açılır`}
      >
        <LeadingSlot chip={chip} compact />
        {body}
        {trailing}
      </a>
    );
  }

  // Three literal, mutually-exclusive branches (rather than one dynamic
  // `role={...}` expression) — mirrors `thread-message.tsx`'s
  // `role="status"`/`role="alert"` conditional-block convention exactly.
  if (chip.status === "uploading") {
    return (
      <div role="status" aria-live="polite" className={containerClassName}>
        <LeadingSlot chip={chip} />
        {body}
        {trailing}
      </div>
    );
  }

  if (chip.status === "failed") {
    return (
      <div role="alert" className={containerClassName}>
        <LeadingSlot chip={chip} />
        {body}
        {trailing}
      </div>
    );
  }

  return (
    <div className={containerClassName}>
      <LeadingSlot chip={chip} />
      {body}
      {trailing}
    </div>
  );
};
