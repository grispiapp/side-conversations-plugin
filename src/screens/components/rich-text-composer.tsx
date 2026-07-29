import {
  CounterClockwiseClockIcon,
  FaceIcon,
  FontBoldIcon,
  FontItalicIcon,
  Link2Icon,
  ListBulletIcon,
  QuoteIcon,
  ReloadIcon,
  RowsIcon,
} from "@radix-ui/react-icons";
import Link from "@tiptap/extension-link";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { ReactNode, forwardRef, useLayoutEffect, useRef } from "react";

import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { cn } from "@/lib/utils";

export interface RichTextComposerProps {
  value: string;
  recipientLabel: string;
  recipientPrefix?: string;
  editorLabel?: string;
  sectionLabel?: string;
  required?: boolean;
  onChange: (html: string) => void;
  onSubmit: (html: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

type ToolbarCommand =
  | "bold"
  | "italic"
  | "link"
  | "bulletList"
  | "orderedList"
  | "emoji"
  | "blockquote"
  | "undo"
  | "redo";

interface ToolbarAction {
  label: string;
  icon: ReactNode;
  command: ToolbarCommand;
  activeName?: string;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
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
    label: "Bağlantı",
    icon: <Link2Icon />,
    command: "link",
    activeName: "link",
  },
  {
    label: "Liste",
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
  { label: "Emoji", icon: <FaceIcon />, command: "emoji" },
  {
    label: "Alıntı",
    icon: <QuoteIcon />,
    command: "blockquote",
    activeName: "blockquote",
  },
  {
    label: "Geri al",
    icon: <CounterClockwiseClockIcon />,
    command: "undo",
  },
  { label: "Yinele", icon: <ReloadIcon />, command: "redo" },
];

const EDITOR_CLASS_NAME =
  "max-h-32 min-h-10 overflow-y-auto break-words px-3 py-2 text-sm leading-5 outline-none";

function hasMeaningfulContent(html: string): boolean {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return Boolean(parsed.body.textContent?.replace(/\u00a0/g, " ").trim());
}

function isAllowedLink(rawHref: string): boolean {
  const href = rawHref.trim().replace(/[\u0000-\u0020\u007f]+/g, "");

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
      required = false,
      onChange,
      onSubmit,
      disabled = false,
      autoFocus = false,
      className,
    },
    forwardedRef
  ) => {
    const editorRef = useRef<Editor | null>(null);
    const onChangeRef = useRef(onChange);
    const onSubmitRef = useRef(onSubmit);
    const disabledRef = useRef(disabled);
    const lastEmittedHtml = useRef(sanitizeHtml(value));

    onChangeRef.current = onChange;
    onSubmitRef.current = onSubmit;
    disabledRef.current = disabled;

    const editor = useEditor(
      {
        content: lastEmittedHtml.current,
        editable: !disabled,
        extensions: [
          StarterKit.configure({
            code: false,
            codeBlock: false,
            heading: false,
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
            class: EDITOR_CLASS_NAME,
          },
          handleKeyDown: (view, event) => {
            if (event.key !== "Enter" || !event.shiftKey) return false;
            if (event.isComposing || view.composing) return false;
            if (disabledRef.current) return true;

            const currentEditor = editorRef.current;
            if (!currentEditor) return true;

            const safeHtml = sanitizeHtml(currentEditor.getHTML());
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
            const safePaste = sanitizeHtml(
              clipboardHtml || plainTextHtml(clipboardText)
            );
            if (!safePaste) return true;

            editorRef.current?.chain().focus().insertContent(safePaste).run();
            return true;
          },
        },
        onUpdate: ({ editor: currentEditor }) => {
          if (disabledRef.current) return;

          const safeHtml = sanitizeHtml(currentEditor.getHTML());
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
        EDITOR_CLASS_NAME,
        disabled && "cursor-not-allowed bg-muted text-muted-foreground"
      );
    }, [disabled, editor, editorLabel, required]);

    useLayoutEffect(() => {
      if (!editor) return;

      const safeValue = sanitizeHtml(value);
      if (safeValue === lastEmittedHtml.current) return;

      lastEmittedHtml.current = safeValue;
      editor.commands.setContent(safeValue, false);
    }, [editor, value]);

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

    const runToolbarAction = (action: ToolbarAction) => {
      if (!editor || disabled) return;

      switch (action.command) {
        case "bold":
          editor.chain().focus().toggleBold().run();
          break;
        case "italic":
          editor.chain().focus().toggleItalic().run();
          break;
        case "link": {
          const href = window.prompt("Bağlantı adresi", "https://")?.trim();
          if (!href || !isAllowedLink(href)) return;
          editor
            .chain()
            .focus()
            .setLink({
              href,
              target: /^https?:/i.test(href) ? "_blank" : null,
              rel: "noopener noreferrer",
            })
            .run();
          break;
        }
        case "bulletList":
          editor.chain().focus().toggleBulletList().run();
          break;
        case "orderedList":
          editor.chain().focus().toggleOrderedList().run();
          break;
        case "emoji":
          editor.chain().focus().insertContent("🙂").run();
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

    return (
      <section
        className={cn(
          "border-t border-border bg-background px-3 py-2",
          className
        )}
        aria-label={sectionLabel}
      >
        <p className="mb-1.5 break-words text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">
            {recipientPrefix}
          </span>{" "}
          {recipientLabel}
        </p>

        <div className="rounded-md border border-input bg-card focus-within:ring-1 focus-within:ring-ring">
          <div
            role="toolbar"
            aria-label="Metin biçimlendirme"
            className="flex flex-nowrap items-center gap-0.5 overflow-x-auto border-b border-border p-1"
          >
            {TOOLBAR_ACTIONS.map((action) => (
              <Button
                key={action.label}
                type="button"
                variant="ghost"
                size="icon"
                aria-label={action.label}
                aria-pressed={
                  action.activeName
                    ? (editor?.isActive(action.activeName) ?? false)
                    : undefined
                }
                title={action.label}
                disabled={disabled || !editor}
                className="shrink-0 focus-visible:ring-2"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => runToolbarAction(action)}
              >
                {action.icon}
              </Button>
            ))}
          </div>

          <EditorContent editor={editor} />
        </div>
      </section>
    );
  }
);

RichTextComposer.displayName = "RichTextComposer";
