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
import Link from "@tiptap/extension-link";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  ReactNode,
  forwardRef,
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

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  {
    label: "Dosya ekle",
    icon: <FilePlusIcon />,
    command: "attach",
    groupEnd: true,
  },
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
    groupEnd: true,
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
    groupEnd: true,
  },
  {
    label: "Geri al",
    icon: <CounterClockwiseClockIcon />,
    command: "undo",
  },
  { label: "Yinele", icon: <ReloadIcon />, command: "redo" },
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
    mode === "compose" ? "min-h-48" : "max-h-40 min-h-24",
    disabled && "cursor-not-allowed bg-muted/30 text-muted-foreground"
  );
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
    },
    forwardedRef
  ) => {
    const editorRef = useRef<Editor | null>(null);
    const onChangeRef = useRef(onChange);
    const onSubmitRef = useRef(onSubmit);
    const disabledRef = useRef(disabled);
    const sanitizeValue = valueIsTrustedAuthored
      ? sanitizeAuthoredHtml
      : sanitizeUntrustedDraftHtml;
    const lastEmittedHtml = useRef(sanitizeValue(value));
    const linkTriggerRef = useRef<HTMLButtonElement>(null);
    const linkInputRef = useRef<HTMLInputElement>(null);
    const headingTriggerRef = useRef<HTMLButtonElement>(null);
    const headingFirstOptionRef = useRef<HTMLButtonElement>(null);
    const attachTriggerRef = useRef<HTMLButtonElement>(null);
    const attachmentGroupRef = useRef<HTMLDivElement | null>(null);
    const attachmentPendingFocusIndexRef = useRef<number | null>(null);
    const previousAttachmentCountRef = useRef(attachments.length);
    const linkPanelId = useId();
    const headingPanelId = useId();
    const attachmentChipListId = useId();
    const sendLockDescriptionId = useId();
    const [linkEditorOpen, setLinkEditorOpen] = useState(false);
    const [headingMenuOpen, setHeadingMenuOpen] = useState(false);
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

    const {
      getRootProps,
      getInputProps,
      open: openFilePicker,
      isDragActive,
    } = useDropzone({
      noClick: true,
      noKeyboard: true,
      multiple: true,
      disabled,
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
          // D-13 / RESEARCH.md Integration Pitfall #6: the FileHandler
          // extension's own drop plugin prop is a silent no-op (no
          // `preventDefault`) whenever its `onDrop` option is left
          // unconfigured — which it deliberately is here, since
          // drag-and-drop is always an attachment, never inline (D-13).
          // Without this guard, nothing else would stop a
          // browser/ProseMirror default from inserting a dropped file
          // straight into the document. Every file-carrying drop is treated
          // as "handled" here (never inserted) — the same native event still
          // bubbles to react-dropzone's own listener bound to the composer's
          // root section, which is what actually turns it into an
          // attachment chip via `onAttachFiles`. This is the structural
          // mirror of the paste fix above: there, control had to be RELEASED
          // to a plugin; here, control must be RETAINED so nothing else can
          // act on a file drop.
          handleDrop: (_view, event) => {
            if (event.dataTransfer?.files.length) return true;
            return false;
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
    }, [disabled, headingMenuOpen, linkEditorOpen]);

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
      linkTriggerRef.current?.focus();
    };

    const closeHeadingMenu = () => {
      setHeadingMenuOpen(false);
      headingTriggerRef.current?.focus();
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
            no visual cue from the overlay below. */}
        <span aria-live="assertive" className="sr-only">
          {isDragActive ? "Dosyaları bırakın, ek olarak eklenecek." : ""}
        </span>

        {recipientLabel && (
          <p className="flex min-h-9 min-w-0 items-center gap-1 border-b border-border px-4 py-2 text-xs text-muted-foreground">
            <span className="shrink-0 font-medium text-foreground">
              {recipientPrefix}{" "}
            </span>
            <span className="truncate">{recipientLabel}</span>
          </p>
        )}

        <div
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

          {isDragActive && (
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
        </div>

        <div className="border-t border-border bg-card">
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
              className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto"
            >
              {TOOLBAR_ACTIONS.map((action) => {
                const pressed = action.activeName
                  ? (editor?.isActive(action.activeName) ?? false)
                  : false;
                const unavailable =
                  action.command === "undo"
                    ? !(editor?.can().chain().focus().undo().run() ?? false)
                    : action.command === "redo"
                      ? !(editor?.can().chain().focus().redo().run() ?? false)
                      : false;

                return (
                  <div
                    key={action.label}
                    className="flex shrink-0 items-center gap-0.5"
                  >
                    <Button
                      ref={
                        action.command === "link"
                          ? linkTriggerRef
                          : action.command === "heading"
                            ? headingTriggerRef
                            : action.command === "attach"
                              ? attachTriggerRef
                              : undefined
                      }
                      type="button"
                      variant="ghost"
                      size="toolbar"
                      aria-label={action.label}
                      aria-pressed={action.activeName ? pressed : undefined}
                      aria-expanded={
                        action.command === "link"
                          ? linkEditorOpen
                          : action.command === "heading"
                            ? headingMenuOpen
                            : undefined
                      }
                      aria-controls={
                        action.command === "link" && linkEditorOpen
                          ? linkPanelId
                          : action.command === "heading" && headingMenuOpen
                            ? headingPanelId
                            : undefined
                      }
                      title={action.label}
                      disabled={disabled || !editor || unavailable}
                      className={cn(
                        "shrink-0 text-muted-foreground focus-visible:ring-2 focus-visible:ring-offset-0",
                        pressed && "bg-accent text-foreground"
                      )}
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
