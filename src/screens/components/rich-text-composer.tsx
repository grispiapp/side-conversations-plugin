import {
  FaceIcon,
  FontBoldIcon,
  FontItalicIcon,
  Link2Icon,
  ListBulletIcon,
  QuoteIcon,
} from "@radix-ui/react-icons";
import {
  ClipboardEvent,
  FormEvent,
  KeyboardEvent,
  MouseEvent,
  ReactNode,
  forwardRef,
  useCallback,
  useLayoutEffect,
  useRef,
} from "react";

import { Button } from "@/components/ui/button";
import { sanitizeHtml } from "@/lib/html-sanitizer";
import { cn } from "@/lib/utils";

export interface RichTextComposerProps {
  value: string;
  recipientLabel: string;
  onChange: (html: string) => void;
  onSubmit: (html: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  className?: string;
}

interface ToolbarAction {
  label: string;
  icon: ReactNode;
  command: string;
  value?: string;
}

const TOOLBAR_ACTIONS: ToolbarAction[] = [
  { label: "Kalın", icon: <FontBoldIcon />, command: "bold" },
  { label: "İtalik", icon: <FontItalicIcon />, command: "italic" },
  { label: "Bağlantı", icon: <Link2Icon />, command: "createLink" },
  { label: "Liste", icon: <ListBulletIcon />, command: "insertUnorderedList" },
  { label: "Emoji", icon: <FaceIcon />, command: "insertText", value: "🙂" },
  {
    label: "Alıntı",
    icon: <QuoteIcon />,
    command: "formatBlock",
    value: "blockquote",
  },
];

function hasMeaningfulContent(html: string): boolean {
  const parsed = new DOMParser().parseFromString(html, "text/html");
  return Boolean(parsed.body.textContent?.replace(/\u00a0/g, " ").trim());
}

export const RichTextComposer = forwardRef<
  HTMLDivElement,
  RichTextComposerProps
>(
  (
    {
      value,
      recipientLabel,
      onChange,
      onSubmit,
      disabled = false,
      autoFocus = false,
      className,
    },
    forwardedRef
  ) => {
    const editorRef = useRef<HTMLDivElement | null>(null);
    const savedRange = useRef<Range | null>(null);

    const setEditorRef = useCallback(
      (node: HTMLDivElement | null) => {
        editorRef.current = node;
        if (typeof forwardedRef === "function") {
          forwardedRef(node);
        } else if (forwardedRef) {
          forwardedRef.current = node;
        }
      },
      [forwardedRef]
    );

    useLayoutEffect(() => {
      const editor = editorRef.current;
      if (!editor) return;

      const safeValue = sanitizeHtml(value);
      if (editor.innerHTML !== safeValue) editor.innerHTML = safeValue;
    }, [value]);

    useLayoutEffect(() => {
      if (autoFocus && !disabled) editorRef.current?.focus();
    }, [autoFocus, disabled]);

    const rememberSelection = () => {
      const selection = window.getSelection();
      const editor = editorRef.current;
      if (
        selection &&
        selection.rangeCount > 0 &&
        editor?.contains(selection.anchorNode)
      ) {
        savedRange.current = selection.getRangeAt(0).cloneRange();
      }
    };

    const restoreSelection = () => {
      const selection = window.getSelection();
      if (!selection || !savedRange.current) return;
      selection.removeAllRanges();
      selection.addRange(savedRange.current);
    };

    const reportSanitizedValue = () => {
      const editor = editorRef.current;
      if (!editor) return;

      const safeValue = sanitizeHtml(editor.innerHTML);
      if (editor.innerHTML !== safeValue) editor.innerHTML = safeValue;
      onChange(safeValue);
      rememberSelection();
    };

    const onInput = (event: FormEvent<HTMLDivElement>) => {
      if (disabled) {
        event.preventDefault();
        return;
      }
      reportSanitizedValue();
    };

    const insertHtml = (html: string) => {
      restoreSelection();
      const inserted = document.execCommand?.("insertHTML", false, html);
      if (inserted || !editorRef.current) return;

      const selection = window.getSelection();
      const range =
        selection && selection.rangeCount > 0 ? selection.getRangeAt(0) : null;
      if (
        !range ||
        !editorRef.current.contains(range.commonAncestorContainer)
      ) {
        editorRef.current.insertAdjacentHTML("beforeend", html);
        return;
      }
      range.deleteContents();
      range.insertNode(range.createContextualFragment(html));
      range.collapse(false);
    };

    const onPaste = (event: ClipboardEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (disabled) return;

      const clipboardHtml = event.clipboardData.getData("text/html");
      const clipboardText = event.clipboardData.getData("text/plain");
      const plainContainer = document.createElement("div");
      plainContainer.textContent = clipboardText;
      const safePaste = sanitizeHtml(
        clipboardHtml || plainContainer.innerHTML.replace(/\n/g, "<br>")
      );
      insertHtml(safePaste);
      reportSanitizedValue();
    };

    const runToolbarAction = (action: ToolbarAction) => {
      if (disabled || !editorRef.current) return;

      editorRef.current.focus();
      restoreSelection();

      let value = action.value;
      if (action.command === "createLink") {
        value = window.prompt("Bağlantı adresi", "https://") || undefined;
        if (!value) return;
      }

      document.execCommand?.(action.command, false, value);
      reportSanitizedValue();
    };

    const preserveSelection = (event: MouseEvent<HTMLButtonElement>) => {
      event.preventDefault();
    };

    const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
      if (disabled || event.key !== "Enter" || !event.shiftKey) return;

      event.preventDefault();
      const safeValue = sanitizeHtml(event.currentTarget.innerHTML);
      if (hasMeaningfulContent(safeValue)) onSubmit(safeValue);
    };

    return (
      <section
        className={cn(
          "border-t border-border bg-background px-3 py-2",
          className
        )}
        aria-label="Yanıt oluşturucu"
      >
        <p className="mb-1.5 break-words text-xs text-muted-foreground">
          <span className="font-medium text-foreground">
            Yanıt şu kişiye gidecek:
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
                title={action.label}
                disabled={disabled}
                className="size-7 shrink-0"
                onMouseDown={preserveSelection}
                onClick={() => runToolbarAction(action)}
              >
                {action.icon}
              </Button>
            ))}
          </div>

          <div
            ref={setEditorRef}
            role="textbox"
            aria-label="Yanıt"
            aria-multiline="true"
            aria-disabled={disabled}
            contentEditable={!disabled}
            suppressContentEditableWarning
            className={cn(
              "max-h-32 min-h-10 overflow-y-auto break-words px-3 py-2 text-sm leading-5 outline-none",
              disabled && "cursor-not-allowed bg-muted text-muted-foreground"
            )}
            onInput={onInput}
            onPaste={onPaste}
            onKeyDown={onKeyDown}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onBlur={rememberSelection}
          />
        </div>
      </section>
    );
  }
);

RichTextComposer.displayName = "RichTextComposer";
