import {
  ChevronDownIcon,
  CounterClockwiseClockIcon,
  FilePlusIcon,
  FontBoldIcon,
  FontItalicIcon,
  HeadingIcon,
  Link2Icon,
  ListBulletIcon,
  QuoteIcon,
  ReloadIcon,
  RowsIcon,
  UploadIcon,
} from "@radix-ui/react-icons";
import FileHandler from "@tiptap/extension-file-handler";
import Link from "@tiptap/extension-link";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  Fragment,
  ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { useDropzone } from "react-dropzone";

import { badgeVariants } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  sanitizeAuthoredHtml,
  sanitizeUntrustedDraftHtml,
} from "@/lib/html-sanitizer";
import { cn } from "@/lib/utils";
import { AttachmentChip } from "@/screens/components/attachment-chip";
import {
  INLINE_IMAGE_MIME_TYPES,
  InlineImage,
  insertInlineImagePlaceholder,
  removeInlineImagePlaceholder,
  resolveInlineImagePlaceholder,
} from "@/screens/components/inline-image-extension";
import type { AttachmentChipVM } from "@/store/attachment-upload-store";

export interface RichTextComposerProps {
  value: string;
  recipientLabel?: string;
  recipientPrefix?: string;
  editorLabel?: string;
  sectionLabel?: string;
  placeholder?: string;
  mode?: "compose" | "reply";
  submitLabel?: string;
  submitDisabled?: boolean;
  submitting?: boolean;
  required?: boolean;
  onChange: (html: string) => void;
  onSubmit: (html: string) => void;
  valueIsTrustedAuthored?: boolean;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
  /**
   * Attachment chip list (D-01/COMP-05/THRD-05). Store-independent — the
   * composer stays prop-driven; `MessageField` (compose) and `chat-screen`
   * (reply) read `AttachmentUploadStore` and pass its view models down.
   */
  attachments?: readonly AttachmentChipVM[];
  /** Fired for every accepted drop/file-picker batch (D-13). */
  onAttachFiles?: (files: File[]) => void;
  onRemoveAttachment?: (chipId: string) => void;
  onRetryAttachment?: (chipId: string) => void;
  /** D-06 send-lock signal — true while any chip is still uploading. */
  attachmentsUploading?: boolean;
  /**
   * Inline-image upload adapter (D-14/COMP-08). Called with the pasted or
   * editor-dropped `File`; resolves to the uploaded `objectUrl` on success,
   * or `undefined` on failure (never expected to throw, but a rejection is
   * treated the same as an `undefined` result — see the placeholder-flow
   * catch below). The composer stays store-independent — same
   * prop-driven architecture as `onAttachFiles` — `MessageField`/
   * `chat-screen` own the real `AttachmentUploadStore.uploadInlineImage`
   * call and the failure toast (UI-SPEC §7).
   */
  onInlineImagePaste?: (file: File) => Promise<string | undefined>;
  /** CC row (D-CC-8, quick-260918-fx7) — prop-driven, same architecture as
   * `attachments`/`onAttachFiles`; the composer never reads CC state itself. */
  ccSlot?: ReactNode;
}

type ToolbarCommand =
  | "attach"
  | "bold"
  | "italic"
  | "heading"
  | "link"
  | "bulletList"
  | "orderedList"
  | "blockquote"
  | "undo"
  | "redo";

interface ToolbarAction {
  label: string;
  icon: ReactNode;
  command: ToolbarCommand;
  activeName?: string;
  groupEnd?: boolean;
}

// D-18 — toolbar split into a lean direct-action row and a single "Aa"
// popover (FORMAT_ACTIONS below). Direct order is locked: attach, then the
// Aa trigger (separate JSX, not an action object), then undo/redo.
const DIRECT_ACTIONS: ToolbarAction[] = [
  {
    label: "Dosya ekle",
    icon: <FilePlusIcon />,
    command: "attach",
    groupEnd: true,
  },
  {
    label: "Geri al",
    icon: <CounterClockwiseClockIcon />,
    command: "undo",
  },
  { label: "Yinele", icon: <ReloadIcon />, command: "redo" },
];

// The seven formatting actions live inside the "Aa" popover (FormatMenu).
// Order/labels/icons/activeName unchanged from the pre-split toolbar.
const FORMAT_ACTIONS: ToolbarAction[] = [
  {
    label: "Kalın",
    icon: <FontBoldIcon />,
    command: "bold",
    activeName: "bold",
  },
  {
    label: "İtalik",
    icon: <FontItalicIcon />,
    command: "italic",
    activeName: "italic",
  },
  {
    label: "Başlık",
    icon: <HeadingIcon />,
    command: "heading",
    activeName: "heading",
  },
  {
    label: "Bağlantı",
    icon: <Link2Icon />,
    command: "link",
    activeName: "link",
  },
  {
    label: "Madde işaretli liste",
    icon: <ListBulletIcon />,
    command: "bulletList",
    activeName: "bulletList",
  },
  {
    label: "Numaralı liste",
    icon: <RowsIcon />,
    command: "orderedList",
    activeName: "orderedList",
  },
  {
    label: "Alıntı",
    icon: <QuoteIcon />,
    command: "blockquote",
    activeName: "blockquote",
  },
];

type HeadingLevel = 1 | 2 | 3;

const HEADING_OPTIONS: Array<{
  label: string;
  level: HeadingLevel | null;
}> = [
  { label: "Normal metin", level: null },
  { label: "Başlık 1", level: 1 },
  { label: "Başlık 2", level: 2 },
  { label: "Başlık 3", level: 3 },
];

// Threshold above which the chip list collapses behind a summary pill
// (UI-SPEC §4, D-02).
const ATTACHMENT_SUMMARY_THRESHOLD = 3;

function editorClassName(mode: "compose" | "reply", disabled: boolean): string {
  return cn(
    "rich-text-content w-full flex-1 overflow-y-auto break-words px-4 py-3 text-sm leading-6 outline-none",
    // D-19 — marker classes for index.css's `@media (max-height: 620px)`
    // block: these height literals aren't on the `var(--...)` token layer,
    // so a plain CSS rule keyed off the class name is the only way to
    // override them in compact mode (RESEARCH Pitfall #5).
    mode === "compose"
      ? "min-h-48 side-conversation-editor-compose"
      : "max-h-40 min-h-24 side-conversation-editor-reply",
    disabled && "cursor-not-allowed bg-muted/30 text-muted-foreground"
  );
}

// UAT fix (D-13 rev., 2026-08-01) — per-zone drag emphasis: whichever zone
// the pointer is currently over is ACTIVE (full-strength border/text),
// the other is DIMMED. Same two-zone visual language as before, now
// pointer-reactive instead of static.
function dragZoneBorderClassName(active: boolean): string {
  return active ? "border-primary" : "border-primary/40";
}

function dragZoneTextClassName(active: boolean): string {
  return active ? "text-primary" : "text-muted-foreground";
}

function hasMeaningfulContent(html: string): boolean {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return Boolean(parsed.body.textContent?.replace(/\u00a0/g, " ").trim());
}

function isAllowedLink(rawHref: string): boolean {
  const href = Array.from(rawHref.trim())
    .filter((character) => {
      const codePoint = character.codePointAt(0) ?? 0;
      return codePoint > 0x20 && codePoint !== 0x7f;
    })
    .join("");

  if (/^mailto:[^:]+$/i.test(href)) return true;
  if (!/^https?:\/\//i.test(href)) return false;

  try {
    const url = new URL(href);
    return /^(?:http|https):$/.test(url.protocol) && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function plainTextHtml(text: string): string {
  const container = document.createElement("div");
  container.textContent = text;
  return container.innerHTML.replace(/\r?\n/g, "<br>");
}

function assignForwardedRef(
  forwardedRef: React.ForwardedRef<HTMLDivElement>,
  node: HTMLDivElement | null
): void {
  if (typeof forwardedRef === "function") {
    forwardedRef(node);
  } else if (forwardedRef) {
    forwardedRef.current = node;
  }
}

export const RichTextComposer = forwardRef<
  HTMLDivElement,
  RichTextComposerProps
>(
  (
    {
      value,
      recipientLabel,
      recipientPrefix = "Yanıt şu kişiye gidecek:",
      editorLabel = "Yanıt",
      sectionLabel = "Yanıt oluşturucu",
      placeholder = "Yanıtınızı yazın…",
      mode = "reply",
      submitLabel = "Gönder",
      submitDisabled = false,
      submitting = false,
      required = false,
      onChange,
      onSubmit,
      valueIsTrustedAuthored = false,
      disabled = false,
      autoFocus = false,
      className,
      attachments = [],
      onAttachFiles,
      onRemoveAttachment,
      onRetryAttachment,
      attachmentsUploading = false,
      onInlineImagePaste,
      ccSlot,
    },
    forwardedRef
  ) => {
    const editorRef = useRef<Editor | null>(null);
    const onChangeRef = useRef(onChange);
    const onSubmitRef = useRef(onSubmit);
    const disabledRef = useRef(disabled);
    // Ref-mirror idiom (Pitfall #5) — `useEditor`'s deps array is `[]`, so
    // the FileHandler extension's onPaste/onDrop closures below are frozen
    // at mount; they must read `.current` to ever see a fresh prop value.
    const onInlineImagePasteRef = useRef(onInlineImagePaste);
    onInlineImagePasteRef.current = onInlineImagePaste;
    // Local preview blob URLs keyed by placeholder upload id — released on
    // BOTH the success and failure paths, plus on unmount (cleanup effect
    // below). A leak here compounds over a long agent session
    // (RESEARCH.md "losing the local blob URL memory lifecycle" pitfall).
    const pendingInlinePreviewUrls = useRef(new Map<string, string>());
    // UAT fix (D-13 rev., 2026-08-01) — the drag affordance is now OWNED
    // here rather than read off react-dropzone's own `isDragActive`.
    // Reason: an editor-handled (inline) drop is consumed by
    // `FileHandler`'s own `handleDrop` plugin prop, which calls
    // `event.stopPropagation()` (its documented behavior — see
    // `@tiptap/extension-file-handler`'s `dist/index.js`) BEFORE the native
    // "drop" event ever reaches this composer's root `<section>` — so
    // react-dropzone's own internal `isDragActive` reset (which lives on
    // its root-level onDrop) never runs for that path, stranding the
    // overlay forever. `dragActive`/`dragAllImages`/`dragOverEditor` are
    // cleared from every terminal path explicitly (see `clearDragState`
    // below and its call sites) instead of relying on react-dropzone's own
    // bookkeeping for rendering.
    //
    // UAT fix round 2 (D-13 rev. 2, 2026-08-01 live re-verification) — the
    // round 1 fix (explicit `clearDragState()` calls wired into
    // `FileHandler.onDrop` and the dropzone's own `onDrop`) still left the
    // overlay stranded live, even though the inline upload itself
    // succeeded. The AUTHORITATIVE clear is now the capture-phase
    // `document`-level "drop" listener registered further down (see its
    // own comment) — structurally guaranteed to run regardless of what any
    // downstream callback does or fails to do. The per-path calls below
    // are kept as harmless, redundant defense-in-depth, not the primary
    // mechanism.
    const [dragActive, setDragActive] = useState(false);
    // UI-SPEC §2 two-zone drag affordance: which overlay to show while
    // `dragActive`. `false` (single full-composer zone) is the safe
    // default — used whenever the payload isn't all-images OR its type
    // can't be determined at dragenter time.
    const [dragAllImages, setDragAllImages] = useState(false);
    // Which zone the pointer is currently over — drives the ACTIVE/DIMMED
    // emphasis swap (UAT fix) between the editor zone and the attachment
    // zone while both are shown. Recomputed on every `dragenter`/`dragover`
    // against `editorZoneRef`'s own bounding box (UI-SPEC §2: "the boundary
    // is exactly the editor's own bounding box").
    const [dragOverEditor, setDragOverEditor] = useState(false);
    const editorZoneRef = useRef<HTMLDivElement | null>(null);
    const sanitizeValue = valueIsTrustedAuthored
      ? sanitizeAuthoredHtml
      : sanitizeUntrustedDraftHtml;
    const lastEmittedHtml = useRef(sanitizeValue(value));
    const linkInputRef = useRef<HTMLInputElement>(null);
    const headingFirstOptionRef = useRef<HTMLButtonElement>(null);
    const attachTriggerRef = useRef<HTMLButtonElement>(null);
    const attachmentGroupRef = useRef<HTMLDivElement | null>(null);
    const attachmentPendingFocusIndexRef = useRef<number | null>(null);
    const previousAttachmentCountRef = useRef(attachments.length);
    // D-18 — FormatMenu ("Aa" popover) lifecycle refs. `formatItemRefs`
    // tracks all seven items (for Arrow key navigation); `formatFirstItemRef`
    // mirrors index 0 for the open-focuses-first-item effect below.
    const formatTriggerRef = useRef<HTMLButtonElement>(null);
    const formatMenuRef = useRef<HTMLDivElement>(null);
    const formatFirstItemRef = useRef<HTMLButtonElement | null>(null);
    const formatItemRefs = useRef<Array<HTMLButtonElement | null>>([]);
    const linkPanelId = useId();
    const headingPanelId = useId();
    const formatMenuId = useId();
    const attachmentChipListId = useId();
    const sendLockDescriptionId = useId();
    const [linkEditorOpen, setLinkEditorOpen] = useState(false);
    const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
    const [formatMenuOpen, setFormatMenuOpen] = useState(false);
    const [linkHref, setLinkHref] = useState("https://");
    const [linkError, setLinkError] = useState("");
    const [editingExistingLink, setEditingExistingLink] = useState(false);
    // D-02 default-state rule: only auto-collapse when the composer session
    // is ENTERED with 3+ files already present. A live 2→3 transition while
    // the agent watches must stay expanded (never hide a file they just
    // watched upload) — this initializer only runs once at mount, capturing
    // whichever case applies then.
    const [attachmentListExpanded, setAttachmentListExpanded] = useState(
      () => attachments.length < ATTACHMENT_SUMMARY_THRESHOLD
    );

    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;
    disabledRef.current = disabled;

    /**
     * Resets every own drag-tracking bit (UAT fix, D-13 rev.). Called from
     * EVERY terminal drag outcome this composer can observe: a
     * dropzone-handled (attachment) drop, an editor-handled (inline) drop
     * — from inside `FileHandler`'s frozen `onDrop` closure below, which is
     * the ONLY place that path is ever observable (see the `dragActive`
     * state comment above) — plus the global `dragend`/leave-window safety
     * net effect further down. `useCallback([])` gives it a stable identity
     * so the `FileHandler` closure (frozen at mount, `useEditor`'s deps
     * array is `[]`) can safely call it without the ref-mirror idiom: it
     * only ever calls the three stable `useState` setters below, never
     * reads a prop/state value itself, so there is no stale-closure risk
     * from capturing whichever render's copy got frozen in.
     */
    const clearDragState = useCallback((): void => {
      setDragActive(false);
      setDragAllImages(false);
      setDragOverEditor(false);
    }, []);

    /**
     * Recomputes `dragOverEditor` from the pointer's client coordinates
     * against `editorZoneRef`'s own bounding box (UI-SPEC §2's "the
     * boundary is exactly the editor's own bounding box"). Called on both
     * `dragenter` (so the very first paint already reflects where the
     * gesture started, before any `dragover` has fired) and every
     * subsequent `dragover` as the pointer moves.
     */
    const updateDragOverEditor = useCallback(
      (position: { clientX: number; clientY: number }): void => {
        const box = editorZoneRef.current?.getBoundingClientRect();
        if (!box) {
          setDragOverEditor(false);
          return;
        }
        setDragOverEditor(
          position.clientX >= box.left &&
            position.clientX <= box.right &&
            position.clientY >= box.top &&
            position.clientY <= box.bottom
        );
      },
      []
    );

    /**
     * Shared by FileHandler's `onPaste` and `onDrop` callbacks below (D-13
     * rev. — both paths insert a placeholder then upload). `pos` is only
     * ever supplied by the drop path (FileHandler's own `posAtCoords`
     * result); the paste path always inserts at the current selection.
     * Only reads the two stable refs above plus the pure lifecycle helpers
     * — safe to call from a closure frozen at mount (`useEditor`'s deps
     * array is `[]`, Pitfall #5).
     */
    function startInlineImageUpload(
      currentEditor: Editor,
      file: File,
      pos?: number
    ): void {
      const localPreviewUrl = URL.createObjectURL(file);
      const uploadId = insertInlineImagePlaceholder(currentEditor, {
        src: localPreviewUrl,
        alt: file.name,
        pos,
      });

      if (!uploadId) {
        URL.revokeObjectURL(localPreviewUrl);
        return;
      }

      pendingInlinePreviewUrls.current.set(uploadId, localPreviewUrl);
      const releasePreview = () => {
        const url = pendingInlinePreviewUrls.current.get(uploadId);
        if (url) URL.revokeObjectURL(url);
        pendingInlinePreviewUrls.current.delete(uploadId);
      };

      const uploader = onInlineImagePasteRef.current;
      if (!uploader) {
        removeInlineImagePlaceholder(currentEditor, uploadId);
        releasePreview();
        return;
      }

      uploader(file)
        .then((objectUrl) => {
          if (objectUrl) {
            resolveInlineImagePlaceholder(currentEditor, uploadId, objectUrl);
          } else {
            removeInlineImagePlaceholder(currentEditor, uploadId);
          }
        })
        .catch(() => {
          removeInlineImagePlaceholder(currentEditor, uploadId);
        })
        .finally(releasePreview);
    }

    const { getRootProps, getInputProps, open: openFilePicker } = useDropzone({
      noClick: true,
      noKeyboard: true,
      multiple: true,
      disabled,
      // UI-SPEC §2 (D-13 rev.): during `dragenter`/`dragover` the browser
      // only exposes `DataTransferItem`s (kind/type), never the `File`
      // objects themselves (those are only readable on drop) — enough to
      // decide which drag overlay to show. Falls back to the single-zone
      // default whenever `items` is empty/unavailable ("payload type
      // undeterminable" — UI-SPEC's own fallback rule); `.every()` over an
      // empty array is vacuously `true`, so the length check guards against
      // that misclassifying an unknown payload as all-images.
      //
      // UAT fix: also owns `dragActive` (rendering no longer reads
      // react-dropzone's own `isDragActive`, see the state comment above)
      // and primes `dragOverEditor` from THIS event's own coordinates, so
      // the very first paint is already correct even before any `dragover`
      // fires.
      onDragEnter: (event) => {
        const items = event.dataTransfer?.items;
        setDragAllImages(
          Boolean(items?.length) &&
            Array.from(items ?? []).every(
              (item) =>
                item.kind === "file" &&
                INLINE_IMAGE_MIME_TYPES.includes(item.type)
            )
        );
        setDragActive(true);
        updateDragOverEditor(event);
      },
      // UAT fix: live per-zone tracking (Defect B) — every `dragover` that
      // bubbles to the composer root recomputes which zone the pointer is
      // over. `prosemirror-view`'s own internal `dragover`/`dragenter`
      // handlers (`editHandlers.dragover`/`dragenter` in
      // `prosemirror-view/dist/index.js`) only call `preventDefault()`,
      // never `stopPropagation()`, so this fires reliably even while the
      // pointer is over the editor's own contenteditable.
      onDragOver: (event) => {
        updateDragOverEditor(event);
      },
      // UAT fix: react-dropzone's own internal drag-target bookkeeping
      // (`dragTargetsRef` in `react-dropzone/dist/index.js`) already
      // guards this callback against the nested-child `dragenter`/
      // `dragleave` churn the composer's many nested children would
      // otherwise cause — it only invokes this once the pointer has
      // actually left every tracked target within the root, i.e. truly
      // left the composer. No separate depth counter is needed here.
      onDragLeave: () => {
        clearDragState();
      },
      // react-dropzone defaults to `file-selector`'s `fromEvent`, which reads
      // `dataTransfer.items` (real `DataTransferItem`s with `getAsFile()`).
      // This repo's jsdom has no working `DataTransfer`
      // (`hasNativeDataTransfer === false`, recorded in 04-01-SUMMARY.md), so
      // both a real browser drop AND this project's own
      // `attachment-test-helpers.ts` stub are read directly off
      // `dataTransfer.files`/`input.files` instead — simpler, and this
      // plugin never needs folder-drop support (D-09: no type/shape
      // restriction beyond size/count, enforced separately by the store).
      getFilesFromEvent: (event) => {
        const dragEvent = event as { dataTransfer?: DataTransfer | null };
        const dataTransferFiles = dragEvent.dataTransfer?.files;
        if (dataTransferFiles && dataTransferFiles.length > 0) {
          return Promise.resolve(Array.from(dataTransferFiles));
        }
        const changeEvent = event as {
          target?: { files?: FileList | null } | null;
        };
        const inputFiles = changeEvent.target?.files;
        if (inputFiles && inputFiles.length > 0) {
          return Promise.resolve(Array.from(inputFiles));
        }
        return Promise.resolve([]);
      },
      onDrop: (acceptedFiles) => {
        clearDragState();
        if (acceptedFiles.length > 0) onAttachFiles?.(acceptedFiles);
      },
    });

    const editor = useEditor(
      {
        content: lastEmittedHtml.current,
        editable: !disabled,
        extensions: [
          StarterKit.configure({
            code: false,
            codeBlock: false,
            heading: { levels: [1, 2, 3] },
            horizontalRule: false,
            strike: false,
          }),
          Link.configure({
            autolink: false,
            linkOnPaste: false,
            openOnClick: false,
            protocols: ["http", "https", "mailto"],
            HTMLAttributes: {
              target: "_blank",
              rel: "noopener noreferrer",
            },
            isAllowedUri: (url) => isAllowedLink(url),
          }),
          // D-14: never persist base64 beyond the transient local preview
          // placeholder — `allowBase64: false` means only the local blob
          // URL (uploading) or the returned `objectUrl` (resolved) ever
          // become a real `src`. The shared class matches UI-SPEC §8's
          // `.rich-text-content img` CSS rule.
          //
          // `inline: true` is required, not cosmetic: the base extension's
          // default (`inline: false`) makes every image a BLOCK atom, and
          // inserting a block atom leaves the editor's selection as a
          // `NodeSelection` wrapping that exact node. A second placeholder
          // inserted right after (two pastes in quick succession, before
          // the first resolves) would then REPLACE that selection —
          // silently deleting the first placeholder instead of adding a
          // second one. `inline: true` joins the paragraph's own inline
          // content group instead, so insertion leaves an ordinary cursor
          // position right after the new node, and CSS alone (`.rich-text-
          // content img`'s `block`) still controls its own-line rendering.
          InlineImage.configure({
            inline: true,
            allowBase64: false,
            HTMLAttributes: { class: "rich-text-content-image" },
          }),
          // D-13 rev. (2026-08-01, live UAT): paste AND drop-into-editor
          // both go through FileHandler now — see the `handleDrop` guard
          // below for the drop-routing half of this decision.
          FileHandler.configure({
            allowedMimeTypes: INLINE_IMAGE_MIME_TYPES,
            onPaste: (currentEditor, files, htmlContent) => {
              // FileHandler's own documented fallthrough (RESEARCH.md
              // Integration Pitfall #6, last paragraph): some GIF/WEBM
              // clipboard payloads carry both a file AND html. FileHandler
              // already returns `false` in that case so "other extensions
              // handle the incoming html via their inputRules" — deferring
              // here (not starting an upload) avoids a guaranteed double
              // insert; the narrow remaining GIF/WEBM double-insert edge
              // case (file WITHOUT accompanying html, which most OS "copy
              // image" actions produce) is accepted as a known MVP limit.
              if (htmlContent) return;
              files.forEach((file) =>
                startInlineImageUpload(currentEditor, file)
              );
            },
            onDrop: (currentEditor, files, pos) => {
              // UAT fix (Defect A) — an editor-handled (inline) drop is
              // consumed entirely inside this plugin's OWN `handleDrop`
              // (see `@tiptap/extension-file-handler`'s `dist/index.js`),
              // which calls `event.stopPropagation()` before calling this
              // callback, so react-dropzone's own `onDrop` never fires for
              // this path. Clearing here catches it as early as possible
              // for a snappy UI, but this call is defense-in-depth, NOT the
              // guaranteed fix (round 1 relied on it alone and it still
              // stranded the overlay live) — the capture-phase `document`
              // "drop" listener registered in the layout effect further
              // down is the authoritative clear; see its comment.
              clearDragState();
              // `pos` is FileHandler's own `posAtCoords` result — inserted
              // at the DROPPED position, never recomputed by hand (D-13
              // rev.).
              files.forEach((file) =>
                startInlineImageUpload(currentEditor, file, pos)
              );
            },
          }),
        ],
        editorProps: {
          attributes: {
            role: "textbox",
            "aria-label": editorLabel,
            "aria-multiline": "true",
            "aria-required": String(required),
            class: editorClassName(mode, disabled),
          },
          handleKeyDown: (view, event) => {
            if (event.key !== "Enter" || !event.shiftKey) return false;
            if (event.isComposing || view.composing) return false;
            if (disabledRef.current) return true;

            const currentEditor = editorRef.current;
            if (!currentEditor) return true;

            const safeHtml = sanitizeAuthoredHtml(currentEditor.getHTML());
            if (hasMeaningfulContent(safeHtml)) {
              onSubmitRef.current(safeHtml);
            }
            return true;
          },
          handlePaste: (_view, event) => {
            if (disabledRef.current) return true;

            // RESEARCH.md Integration Pitfall #1: ProseMirror consults
            // `editorProps` (this function) BEFORE any registered plugin's
            // own `handlePaste` — an unconditional `true` here would make
            // FileHandler's paste-image plugin prop UNREACHABLE regardless
            // of how it's configured. Releasing control (`return false`)
            // whenever the clipboard carries files lets FileHandler's own
            // `handlePaste` run next; the untrusted-HTML sanitize path
            // below is otherwise UNCHANGED (04-07's call-site routing here
            // stays exactly as it was).
            if (event.clipboardData?.files?.length) return false;

            const clipboardHtml = event.clipboardData?.getData("text/html");
            const clipboardText =
              event.clipboardData?.getData("text/plain") || "";
            const safePaste = sanitizeUntrustedDraftHtml(
              clipboardHtml || plainTextHtml(clipboardText)
            );
            if (!safePaste) return true;

            editorRef.current?.chain().focus().insertContent(safePaste).run();
            return true;
          },
          // D-13 rev. (2026-08-01, RESEARCH.md Integration Pitfall #6) —
          // this guard now decides EDITOR-INTERIOR drop routing, not just
          // "always attachment": every dropped file's MIME must be an
          // inline-embeddable image for the drop to become inline. When
          // ALL dropped files qualify, control is RELEASED (`return
          // false`) so FileHandler's own `handleDrop` plugin prop can take
          // over — it inserts at the exact `posAtCoords` position it
          // computed. Otherwise (any non-image file present, or no files —
          // an internal text drag) control is RETAINED (`return true`), so
          // neither ProseMirror's default insertion nor FileHandler can
          // ever touch the drop — the same native event still bubbles to
          // react-dropzone's own listener, which turns it into an
          // attachment via `onAttachFiles`. The mixed-drop-is-all-attachment
          // rule (D-13 rev.) falls out of the `.every()` check below: ONE
          // non-image file anywhere in the batch fails it. This guard only
          // governs drops landing INSIDE the editor's own contenteditable —
          // drops elsewhere on the composer never reach it at all and are
          // always attachments (react-dropzone's root listener).
          handleDrop: (_view, event) => {
            const files = event.dataTransfer?.files;
            if (!files || files.length === 0) return false;
            const allInlineImages = Array.from(files).every((file) =>
              INLINE_IMAGE_MIME_TYPES.includes(file.type)
            );
            return !allInlineImages;
          },
        },
        onUpdate: ({ editor: currentEditor }) => {
          if (disabledRef.current) return;

          const safeHtml = sanitizeAuthoredHtml(currentEditor.getHTML());
          lastEmittedHtml.current = safeHtml;
          onChangeRef.current(safeHtml);
        },
      },
      []
    );

    editorRef.current = editor;

    // Releases every local preview blob URL still pending when the
    // composer unmounts (RESEARCH.md "losing the local blob URL memory
    // lifecycle" pitfall) — the success/failure paths inside
    // `startInlineImageUpload` already release their own on settle, this
    // only catches whatever is still in flight at teardown time.
    useLayoutEffect(() => {
      const pending = pendingInlinePreviewUrls.current;
      return () => {
        pending.forEach((url) => URL.revokeObjectURL(url));
        pending.clear();
      };
    }, []);

    // UAT fix (Defect A safety net) — global terminal-outcome listeners for
    // drag gestures that never produce a "drop" our own root/editor
    // handlers can see at all: the drag is cancelled (Esc) or the pointer
    // leaves the browser window entirely mid-drag. Registered on
    // `document` rather than the composer root because both signals are
    // meaningful regardless of which element they land on.
    //  - `dragend` fires on the drag SOURCE when the gesture ends for any
    //    reason (drop, cancel). Same-page-initiated drags reach it
    //    directly; the OS-file-drag case has no in-page source to fire it
    //    on, so this is a courtesy net for that case, not the primary
    //    defense against the reported bug (see `handleDocumentDropCapture`
    //    below for that).
    //  - `dragleave` with `relatedTarget === null` is the standard signal
    //    for "the pointer left the viewport" (every in-page dragleave has
    //    a `relatedTarget` element; only crossing the window boundary
    //    leaves it `null`).
    useLayoutEffect(() => {
      const handleDragEnd = (): void => clearDragState();
      const handleDocumentDragLeave = (event: DragEvent): void => {
        if (event.relatedTarget === null) clearDragState();
      };
      // UAT fix round 2 (D-13 rev. 2, live re-verification, 2026-08-01) —
      // THE primary defense against the stranded-overlay bug, registered
      // in the CAPTURE phase. Round 1 relied on `FileHandler.onDrop` and
      // the dropzone's own `onDrop` explicitly calling `clearDragState()`
      // (still present below/above as defense-in-depth) — but both of
      // those only run if and when the event actually reaches THAT
      // specific downstream callback. Event propagation has two phases:
      // CAPTURE (document → target, top-down) runs to completion BEFORE
      // the BUBBLE phase (target → document) even starts, and
      // `stopPropagation()` called by any bubble-phase or target-phase
      // handler (FileHandler's plugin `handleDrop` calls it — see
      // `@tiptap/extension-file-handler`'s `dist/index.js` — as does
      // ProseMirror's own internal drop dispatch in some paths) can only
      // suppress propagation to nodes that have NOT been visited yet in
      // whichever phase is currently running; it has no power at all over
      // a capture-phase listener on an ANCESTOR (here, `document`), since
      // that listener already ran, in full, before the event ever reached
      // the target. A listener registered here is therefore structurally
      // guaranteed to observe every "drop" this composer's overlay could
      // ever be showing for — regardless of which downstream extension
      // consumes it, whether `posAtCoords` resolves, or any other
      // third-party detail this composer doesn't control. Unconditional
      // and side-effect-free beyond the state clear itself (never calls
      // `preventDefault`/`stopPropagation`), so it never interferes with
      // FileHandler's or react-dropzone's own handling of the same event —
      // it only ever OBSERVES. Safe to fire on every "drop" anywhere in
      // the document (not just within the composer): if this composer's
      // own `dragActive` is already `false`, `clearDragState()` is a
      // same-value `setState` no-op.
      const handleDocumentDropCapture = (): void => clearDragState();
      document.addEventListener("dragend", handleDragEnd);
      document.addEventListener("dragleave", handleDocumentDragLeave);
      document.addEventListener("drop", handleDocumentDropCapture, true);
      return () => {
        document.removeEventListener("dragend", handleDragEnd);
        document.removeEventListener("dragleave", handleDocumentDragLeave);
        document.removeEventListener("drop", handleDocumentDropCapture, true);
      };
    }, [clearDragState]);

    useLayoutEffect(() => {
      if (!editor) return;

      editor.setEditable(!disabled);
      editor.view.dom.setAttribute("aria-disabled", String(disabled));
      editor.view.dom.setAttribute("aria-label", editorLabel);
      editor.view.dom.setAttribute("aria-required", String(required));
      editor.view.dom.className = cn(
        "ProseMirror",
        editorClassName(mode, disabled)
      );
    }, [disabled, editor, editorLabel, mode, required]);

    useLayoutEffect(() => {
      if (!editor) return;

      const safeValue = sanitizeValue(value);
      if (safeValue === lastEmittedHtml.current) return;

      lastEmittedHtml.current = safeValue;
      editor.commands.setContent(safeValue, false);
    }, [editor, sanitizeValue, value]);

    useLayoutEffect(() => {
      const editorElement = (editor?.view.dom as HTMLDivElement) ?? null;
      assignForwardedRef(forwardedRef, editorElement);
      return () => assignForwardedRef(forwardedRef, null);
    }, [editor, forwardedRef]);

    useLayoutEffect(() => {
      if (autoFocus && !disabled && editor) {
        editor.commands.focus("end");
        editor.view.focus();
      }
    }, [autoFocus, disabled, editor]);

    useLayoutEffect(() => {
      if (!linkEditorOpen) return;
      linkInputRef.current?.focus();
      linkInputRef.current?.select();
    }, [linkEditorOpen]);

    useLayoutEffect(() => {
      if (headingMenuOpen) headingFirstOptionRef.current?.focus();
    }, [headingMenuOpen]);

    useLayoutEffect(() => {
      if (!disabled) return;
      if (linkEditorOpen) {
        setLinkEditorOpen(false);
        setLinkError("");
      }
      if (headingMenuOpen) setHeadingMenuOpen(false);
      if (formatMenuOpen) setFormatMenuOpen(false);
    }, [disabled, formatMenuOpen, headingMenuOpen, linkEditorOpen]);

    // D-18 — FormatMenu ("Aa" popover) accessible lifecycle, copied verbatim
    // from chat-screen.tsx's proven conversation-options menu (RESEARCH.md
    // Pattern 3): outside mousedown closes, Escape closes + returns focus,
    // Tab closes without forcing focus, opening focuses the first item.
    const closeFormatMenu = useCallback((returnFocus = true) => {
      setFormatMenuOpen(false);
      if (returnFocus) formatTriggerRef.current?.focus();
    }, []);

    useEffect(() => {
      if (!formatMenuOpen) return;

      formatFirstItemRef.current?.focus();

      const handlePointerDown = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          formatMenuRef.current?.contains(target) ||
          formatTriggerRef.current?.contains(target)
        ) {
          return;
        }
        closeFormatMenu();
      };
      const handleKeyDown = (event: globalThis.KeyboardEvent) => {
        if (event.key === "Escape") {
          event.preventDefault();
          closeFormatMenu();
        } else if (event.key === "Tab") {
          closeFormatMenu(false);
        }
      };

      document.addEventListener("mousedown", handlePointerDown);
      document.addEventListener("keydown", handleKeyDown);
      return () => {
        document.removeEventListener("mousedown", handlePointerDown);
        document.removeEventListener("keydown", handleKeyDown);
      };
    }, [closeFormatMenu, formatMenuOpen]);

    // Arrow-key navigation between the seven `menuitemcheckbox` items,
    // wrapping at both ends; Home/End jump to the first/last item.
    const handleFormatItemKeyDown = (
      event: React.KeyboardEvent<HTMLButtonElement>,
      index: number
    ) => {
      const items = formatItemRefs.current;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        items[(index + 1) % items.length]?.focus();
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        items[(index - 1 + items.length) % items.length]?.focus();
      } else if (event.key === "Home") {
        event.preventDefault();
        items[0]?.focus();
      } else if (event.key === "End") {
        event.preventDefault();
        items[items.length - 1]?.focus();
      }
    };

    // D-02: once the count drops back below the summary threshold, no
    // residual "collapsed" memory survives — the next time it climbs back to
    // 3+ within the same session is treated as a fresh live transition
    // (stays expanded), never silently re-collapsing.
    useLayoutEffect(() => {
      const count = attachments.length;
      if (
        count < ATTACHMENT_SUMMARY_THRESHOLD &&
        previousAttachmentCountRef.current >= ATTACHMENT_SUMMARY_THRESHOLD
      ) {
        setAttachmentListExpanded(true);
      }
      previousAttachmentCountRef.current = count;
    }, [attachments]);

    // Accessibility focus-restoration after chip removal (UI-SPEC
    // Accessibility): next chip's remove button, else previous chip's, else
    // the attach toolbar button — focus is never left on a removed node.
    useLayoutEffect(() => {
      const pendingIndex = attachmentPendingFocusIndexRef.current;
      if (pendingIndex === null) return;
      attachmentPendingFocusIndexRef.current = null;

      const removeButtons = attachmentGroupRef.current
        ? Array.from(
            attachmentGroupRef.current.querySelectorAll<HTMLButtonElement>(
              'button[aria-label$="dosyasını kaldır"]'
            )
          )
        : [];

      if (removeButtons.length === 0) {
        attachTriggerRef.current?.focus();
        return;
      }

      const nextIndex = Math.min(pendingIndex, removeButtons.length - 1);
      removeButtons[nextIndex]?.focus();
    }, [attachments]);

    const closeLinkEditor = () => {
      setLinkEditorOpen(false);
      setLinkError("");
      setEditingExistingLink(false);
      // D-18 — "Bağlantı" now only exists inside the FormatMenu popover,
      // which is already closed by the time this runs (closeFormatMenu(false)
      // fired when the item was clicked); its DOM node is gone. The "Aa"
      // trigger is the only stable, always-mounted control to return to.
      formatTriggerRef.current?.focus();
    };

    const closeHeadingMenu = () => {
      setHeadingMenuOpen(false);
      // Same reasoning as closeLinkEditor above — "Başlık" only exists while
      // the FormatMenu popover is open.
      formatTriggerRef.current?.focus();
    };

    const applyLink = () => {
      if (!editor || disabled) return;
      const href = linkHref.trim();
      if (!isAllowedLink(href)) {
        setLinkError("Geçerli bir http, https veya mailto adresi girin.");
        linkInputRef.current?.focus();
        return;
      }
      editor
        .chain()
        .focus()
        .setLink({
          href,
          target: /^https?:/i.test(href) ? "_blank" : null,
          rel: "noopener noreferrer",
        })
        .run();
      closeLinkEditor();
    };

    const removeLink = () => {
      if (!editor || disabled || !editingExistingLink) return;
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      closeLinkEditor();
    };

    const handleRemoveAttachment = (chipId: string) => {
      const index = attachments.findIndex((chip) => chip.id === chipId);
      attachmentPendingFocusIndexRef.current = index === -1 ? null : index;
      onRemoveAttachment?.(chipId);
    };

    const runToolbarAction = (action: ToolbarAction) => {
      if (!editor || disabled) return;

      switch (action.command) {
        case "attach":
          openFilePicker();
          break;
        case "bold":
          editor.chain().focus().toggleBold().run();
          break;
        case "italic":
          editor.chain().focus().toggleItalic().run();
          break;
        case "heading":
          if (headingMenuOpen) {
            closeHeadingMenu();
            return;
          }
          setLinkEditorOpen(false);
          setLinkError("");
          setEditingExistingLink(false);
          setHeadingMenuOpen(true);
          break;
        case "link": {
          if (linkEditorOpen) {
            closeLinkEditor();
            return;
          }
          setHeadingMenuOpen(false);
          const currentHref = editor.getAttributes("link").href;
          const hasCurrentLink =
            typeof currentHref === "string" && currentHref.length > 0;
          setLinkHref(hasCurrentLink ? currentHref : "https://");
          setEditingExistingLink(hasCurrentLink);
          setLinkError("");
          setLinkEditorOpen(true);
          break;
        }
        case "bulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "blockquote":
          editor.chain().focus().toggleBlockquote().run();
          break;
        case "undo":
          editor.chain().focus().undo().run();
          break;
        case "redo":
          editor.chain().focus().redo().run();
          break;
      }
    };

    const applyHeading = (level: HeadingLevel | null) => {
      if (!editor || disabled) return;
      if (level === null) {
        editor.chain().focus().setParagraph().run();
      } else {
        editor.chain().focus().setHeading({ level }).run();
      }
      closeHeadingMenu();
    };

    const submitCurrentContent = () => {
      if (!editor || disabled || submitDisabled || submitting) return;
      const safeHtml = sanitizeAuthoredHtml(editor.getHTML());
      if (!hasMeaningfulContent(safeHtml)) return;
      onSubmitRef.current(safeHtml);
    };

    const hasContent = hasMeaningfulContent(
      sanitizeValue(editor?.getHTML() ?? value)
    );

    const attachmentSummaryVisible =
      attachments.length >= ATTACHMENT_SUMMARY_THRESHOLD;
    const attachmentChipsVisible =
      !attachmentSummaryVisible || attachmentListExpanded;

    return (
      <section
        {...getRootProps({
          className: cn(
            "min-w-0 bg-card",
            mode === "compose"
              ? "flex min-h-0 flex-1 flex-col"
              : "shrink-0 border-t border-border",
            className
          ),
          "aria-label": sectionLabel,
        })}
      >
        {/* react-dropzone's own default `aria-label="file upload"` is
            dropped (`aria-hidden` instead) — this element is never a
            meaningful AT target on its own (it's opened programmatically by
            the labelled "Dosya ekle" toolbar button, which is the real
            accessible entry point), and leaving the default label present
            would make this the FIRST `input[aria-label]` in DOM order,
            ahead of the link-editor's own labelled url input. */}
        <input
          {...getInputProps({ "aria-label": undefined })}
          aria-hidden="true"
        />

        {/* Non-visual drag feedback (UI-SPEC §2) — screen-reader users get
            no visual cue from the overlays below. */}
        <span aria-live="assertive" className="sr-only">
          {dragActive
            ? dragAllImages
              ? "Görseli mesaja gömmek için editöre bırakın, dosya olarak eklemek için dışına bırakın."
              : "Dosyaları bırakın, ek olarak eklenecek."
            : ""}
        </span>

        {recipientLabel && (
          <p className="flex min-h-9 min-w-0 items-center gap-1 border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <span className="shrink-0 font-medium text-foreground">
              {recipientPrefix}{" "}
            </span>
            <span className="truncate">{recipientLabel}</span>
          </p>
        )}

        {ccSlot}

        <div
          ref={editorZoneRef}
          data-testid="editor-drop-zone"
          className={cn(
            "relative min-h-0 bg-card focus-within:bg-background",
            mode === "compose" && "flex flex-1"
          )}
        >
          {!hasContent && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute left-4 top-3 text-sm leading-6 text-muted-foreground/70"
            >
              {placeholder}
            </span>
          )}
          <EditorContent
            editor={editor}
            className={cn(
              "min-w-0 flex-1",
              mode === "compose" && "flex min-h-0"
            )}
          />

          {/* Single zone (UI-SPEC §2, unchanged from the original spec) —
              whenever the drag payload contains any non-image file, or its
              type can't be determined, a mixed drop routes entirely to
              attachments (D-13 rev.'s mixed rule), so the WHOLE composer is
              one honest "this becomes an attachment" zone. */}
          {dragActive && !dragAllImages && (
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-primary bg-primary/5 p-6"
            >
              <UploadIcon className="size-5 text-primary" aria-hidden="true" />
              <p className="text-center text-sm font-semibold text-primary">
                Dosyaları buraya bırakın
              </p>
            </div>
          )}

          {/* Two-zone drag affordance (UI-SPEC §2, D-13 rev.) — shown only
              while the drag payload is confirmed all-images. Editor-zone
              half: dropping HERE embeds inline, at the exact position
              `posAtCoords` would resolve. The sibling attachment-zone half
              lives in the bottom panel below, over the toolbar/chip band —
              the two never overlap, matching the editor's own bounding
              box exactly. UAT fix: emphasis now tracks `dragOverEditor`
              live instead of always rendering "active" — this is the
              editor half, so it's active exactly when the pointer IS over
              the editor's own box. */}
          {dragActive && dragAllImages && (
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 flex items-center justify-center rounded-md border-2 border-dashed bg-primary/5 p-6",
                dragZoneBorderClassName(dragOverEditor)
              )}
            >
              <p
                className={cn(
                  "text-center text-sm font-semibold",
                  dragZoneTextClassName(dragOverEditor)
                )}
              >
                Mesaja göm
              </p>
            </div>
          )}
        </div>

        <div className="relative border-t border-border bg-card">
          {/* UAT fix: attachment half of the same pair above — active
              exactly when the pointer is OUTSIDE the editor's own box
              (`!dragOverEditor`), the inverse of the editor zone. */}
          {dragActive && dragAllImages && (
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute inset-0 z-10 flex items-center justify-center rounded-md border-2 border-dashed bg-primary/5 p-2",
                dragZoneBorderClassName(!dragOverEditor)
              )}
            >
              <p
                className={cn(
                  "text-center text-xs font-medium",
                  dragZoneTextClassName(!dragOverEditor)
                )}
              >
                Dosya olarak ekle
              </p>
            </div>
          )}

          {attachments.length > 0 && (
            <div
              ref={attachmentGroupRef}
              role="group"
              aria-label={`Ekler (${attachments.length})`}
              className="flex flex-wrap items-center gap-1.5 border-b border-border bg-muted/20 px-2 py-2"
            >
              {attachmentSummaryVisible && (
                <button
                  type="button"
                  aria-expanded={attachmentListExpanded}
                  aria-controls={
                    attachmentListExpanded ? attachmentChipListId : undefined
                  }
                  aria-label={
                    attachmentListExpanded
                      ? `${attachments.length} dosya, listeyi daralt`
                      : `${attachments.length} dosya, listeyi genişlet`
                  }
                  className={cn(
                    badgeVariants({ variant: "file" }),
                    "h-8 shrink-0 items-center gap-1.5 px-2 py-0 font-normal"
                  )}
                  onClick={() =>
                    setAttachmentListExpanded((expanded) => !expanded)
                  }
                >
                  <span>{attachments.length} dosya</span>
                  <ChevronDownIcon
                    aria-hidden="true"
                    className={cn(
                      "size-3 transition-transform",
                      attachmentListExpanded && "rotate-180"
                    )}
                  />
                </button>
              )}

              {attachmentChipsVisible && (
                <div id={attachmentChipListId} className="contents">
                  {attachments.map((chip) => (
                    <AttachmentChip
                      key={chip.id}
                      chip={chip}
                      onRemove={handleRemoveAttachment}
                      onRetry={onRetryAttachment}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {headingMenuOpen && (
            <div
              id={headingPanelId}
              role="menu"
              aria-label="Başlık düzeyi"
              className="flex flex-wrap gap-1 border-b border-border bg-muted/20 p-2"
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                closeHeadingMenu();
              }}
            >
              {HEADING_OPTIONS.map((option, index) => {
                const selected =
                  option.level === null
                    ? !(editor?.isActive("heading") ?? false)
                    : (editor?.isActive("heading", {
                        level: option.level,
                      }) ?? false);
                return (
                  <Button
                    key={option.label}
                    ref={index === 0 ? headingFirstOptionRef : undefined}
                    type="button"
                    role="menuitemradio"
                    aria-label={option.label}
                    aria-checked={selected}
                    size="sm"
                    variant={selected ? "secondary" : "ghost"}
                    className="h-8 px-2"
                    onClick={() => applyHeading(option.level)}
                  >
                    {option.label}
                  </Button>
                );
              })}
            </div>
          )}

          {linkEditorOpen && (
            <form
              id={linkPanelId}
              aria-label="Bağlantı ekle"
              className="flex flex-col gap-2 border-b border-border bg-muted/20 p-3"
              onSubmit={(event) => {
                event.preventDefault();
                applyLink();
              }}
              onKeyDown={(event) => {
                if (event.key !== "Escape") return;
                event.preventDefault();
                closeLinkEditor();
              }}
            >
              <label
                htmlFor={`${linkPanelId}-url`}
                className="text-xs font-semibold text-foreground"
              >
                Bağlantı adresi
              </label>
              <input
                ref={linkInputRef}
                id={`${linkPanelId}-url`}
                type="url"
                value={linkHref}
                aria-invalid={Boolean(linkError)}
                aria-describedby={
                  linkError ? `${linkPanelId}-error` : undefined
                }
                className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onChange={(event) => {
                  setLinkHref(event.target.value);
                  setLinkError("");
                }}
              />
              {linkError && (
                <p
                  id={`${linkPanelId}-error`}
                  role="alert"
                  className="text-xs text-destructive"
                >
                  {linkError}
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                {editingExistingLink ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="px-2 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    onClick={removeLink}
                  >
                    Bağlantıyı kaldır
                  </Button>
                ) : (
                  <span />
                )}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={closeLinkEditor}
                  >
                    İptal
                  </Button>
                  <Button type="submit" size="sm">
                    Uygula
                  </Button>
                </div>
              </div>
            </form>
          )}

          <div className="flex min-w-0 items-center gap-2 px-2 py-2">
            <div
              role="toolbar"
              aria-label="Metin biçimlendirme"
              className="flex min-w-0 flex-1 items-center gap-0.5"
            >
              {DIRECT_ACTIONS.map((action) => {
                const unavailable =
                  action.command === "undo"
                    ? !(editor?.can().chain().focus().undo().run() ?? false)
                    : action.command === "redo"
                      ? !(editor?.can().chain().focus().redo().run() ?? false)
                      : false;

                return (
                  <Fragment key={action.command}>
                    <div className="flex shrink-0 items-center gap-0.5">
                      <Button
                        ref={
                          action.command === "attach"
                            ? attachTriggerRef
                            : undefined
                        }
                        type="button"
                        variant="ghost"
                        size="toolbar"
                        aria-label={action.label}
                        title={action.label}
                        disabled={disabled || !editor || unavailable}
                        className="shrink-0 text-muted-foreground focus-visible:ring-2 focus-visible:ring-offset-0"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => runToolbarAction(action)}
                      >
                        {action.icon}
                      </Button>
                      {action.groupEnd && (
                        <span
                          aria-hidden="true"
                          className="mx-0.5 h-4 w-px bg-border"
                        />
                      )}
                    </div>

                    {/* D-18 — "Aa" FormatMenu trigger+panel sits right after
                        the "Dosya ekle" button, per the locked toolbar order
                        [Dosya ekle] [Aa ▾] [Geri al] [Yinele]. */}
                    {action.command === "attach" && (
                      <div className="relative shrink-0">
                        <Button
                          ref={formatTriggerRef}
                          type="button"
                          variant="ghost"
                          size="toolbar"
                          aria-label="Biçimlendirme seçenekleri"
                          aria-haspopup="menu"
                          aria-expanded={formatMenuOpen}
                          aria-controls={
                            formatMenuOpen ? formatMenuId : undefined
                          }
                          disabled={disabled || !editor}
                          className="w-auto gap-0.5 px-1.5 text-muted-foreground"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() =>
                            setFormatMenuOpen((open) => !open)
                          }
                        >
                          <span className="text-xs font-semibold">Aa</span>
                          <ChevronDownIcon
                            className="size-3"
                            aria-hidden="true"
                          />
                        </Button>

                        {formatMenuOpen && (
                          <div
                            ref={formatMenuRef}
                            id={formatMenuId}
                            role="menu"
                            aria-label="Metin biçimlendirme seçenekleri"
                            className="absolute bottom-full left-0 z-20 mb-1 max-h-64 w-56 overflow-y-auto rounded-md border border-border bg-card p-1 shadow-lg"
                            onBlur={(event) => {
                              const nextFocus =
                                event.relatedTarget as Node | null;
                              // Focus moving into the editor no longer needs
                              // an exemption: every item now closes the panel
                              // itself, and a click straight into the editor
                              // should close it too.
                              if (
                                nextFocus &&
                                formatMenuRef.current?.contains(nextFocus)
                              ) {
                                return;
                              }
                              closeFormatMenu(false);
                            }}
                          >
                            {FORMAT_ACTIONS.map((formatAction, index) => (
                              <button
                                key={formatAction.command}
                                ref={(node) => {
                                  formatItemRefs.current[index] = node;
                                  if (index === 0) {
                                    formatFirstItemRef.current = node;
                                  }
                                }}
                                type="button"
                                role="menuitemcheckbox"
                                aria-checked={
                                  formatAction.activeName
                                    ? (editor?.isActive(
                                        formatAction.activeName
                                      ) ?? false)
                                    : false
                                }
                                aria-label={formatAction.label}
                                aria-expanded={
                                  formatAction.command === "link"
                                    ? linkEditorOpen
                                    : formatAction.command === "heading"
                                      ? headingMenuOpen
                                      : undefined
                                }
                                aria-controls={
                                  formatAction.command === "link" &&
                                  linkEditorOpen
                                    ? linkPanelId
                                    : formatAction.command === "heading" &&
                                        headingMenuOpen
                                      ? headingPanelId
                                      : undefined
                                }
                                disabled={disabled || !editor}
                                className="flex min-h-11 w-full items-center gap-2 rounded px-3 py-2 text-left text-sm text-foreground hover:bg-accent aria-checked:bg-accent aria-checked:font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                onMouseDown={(event) =>
                                  event.preventDefault()
                                }
                                onKeyDown={(event) =>
                                  handleFormatItemKeyDown(event, index)
                                }
                                onClick={() => {
                                  // Every item closes the panel (live UAT,
                                  // 2026-08-17). The panel opens UPWARD over
                                  // the composer at w-56/max-h-64, so while it
                                  // is open the agent cannot see the text the
                                  // toggle just affected — "toggle-and-
                                  // continue" only pays off when the result is
                                  // visible. `false` keeps focus where
                                  // runToolbarAction put it (the editor), so
                                  // typing continues with the mark active.
                                  runToolbarAction(formatAction);
                                  closeFormatMenu(false);
                                }}
                              >
                                {formatAction.icon}
                                <span>{formatAction.label}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </Fragment>
                );
              })}
            </div>

            <Button
              type="button"
              size="sm"
              aria-label={`${editorLabel} gönder`}
              aria-describedby={
                attachmentsUploading ? sendLockDescriptionId : undefined
              }
              title={attachmentsUploading ? "Ekler yükleniyor…" : undefined}
              className="shrink-0 px-4"
              disabled={
                disabled ||
                submitDisabled ||
                submitting ||
                !editor ||
                !hasContent ||
                attachmentsUploading
              }
              onClick={submitCurrentContent}
            >
              {submitting ? "Gönderiliyor…" : submitLabel}
            </Button>
            {attachmentsUploading && (
              <span id={sendLockDescriptionId} className="sr-only">
                Ekler yükleniyor, gönderim şu anda kilitli.
              </span>
            )}
          </div>
        </div>
      </section>
    );
  }
);

RichTextComposer.displayName = "RichTextComposer";
