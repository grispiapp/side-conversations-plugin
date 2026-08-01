import { RichTextComposer } from "../rich-text-composer";
import { ReactElement, RefObject, act, createRef, useState } from "react";
import { Root, createRoot } from "react-dom/client";

import {
  makeClipboardPasteEvent,
  makeDragEndEvent,
  makeDragEnterEvent,
  makeDragLeaveEvent,
  makeDragOverEvent,
  makeDropEvent,
  makeTestFile,
} from "@/lib/attachment-test-helpers";
import type { AttachmentChipVM } from "@/store/attachment-upload-store";

let container: HTMLDivElement;
let root: Root;

let objectUrlCounter = 0;
const createObjectURLMock = jest.fn();
const revokeObjectURLMock = jest.fn();

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;

  // jsdom has no `URL.createObjectURL`/`revokeObjectURL` — only the inline
  // paste/drop tests below exercise these (04-01-SUMMARY's recorded jsdom
  // gap; same mock shape as `attachment-upload-store.test.ts`'s).
  Object.defineProperty(global.URL, "createObjectURL", {
    value: createObjectURLMock,
    writable: true,
  });
  Object.defineProperty(global.URL, "revokeObjectURL", {
    value: revokeObjectURLMock,
    writable: true,
  });
});

// react-scripts' Jest preset defaults `resetMocks: true` — the mock
// implementation must be (re)installed in `beforeEach`, not at module scope
// (04-03-SUMMARY's documented gotcha).
beforeEach(() => {
  objectUrlCounter = 0;
  createObjectURLMock.mockImplementation(
    (): string => `blob:mock-${++objectUrlCounter}`
  );
  revokeObjectURLMock.mockImplementation(() => undefined);
});

function render(ui: ReactElement): void {
  act(() => {
    root.render(ui);
  });
}

function editor(): HTMLDivElement {
  const result = container.querySelector<HTMLDivElement>(
    '[role="textbox"][aria-label="Yanıt"]'
  );
  if (!result) throw new Error("Editor not found");
  return result;
}

function button(label: string): HTMLButtonElement {
  const result = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  );
  if (!result) throw new Error(`Button not found: ${label}`);
  return result;
}

function latestHtml(mock: jest.Mock): string {
  const call = mock.mock.calls[mock.mock.calls.length - 1];
  return call?.[0] || "";
}

function composerRoot(): HTMLElement {
  const result = container.querySelector("section");
  if (!result) throw new Error("Composer root not found");
  return result;
}

/** The wrapping div `rich-text-composer.tsx` measures the two-zone drag boundary against. */
function editorDropZone(): HTMLElement {
  const result = container.querySelector<HTMLElement>(
    '[data-testid="editor-drop-zone"]'
  );
  if (!result) throw new Error("Editor drop zone not found");
  return result;
}

/**
 * jsdom's `getBoundingClientRect` always reports all-zero — the pointer-
 * tracking two-zone assertions need a real box to compare `dragover`
 * coordinates against. Stubs `editorDropZone()`'s own rect for the
 * duration of the test.
 */
function stubEditorDropZoneRect(rect: {
  left: number;
  top: number;
  right: number;
  bottom: number;
}): void {
  editorDropZone().getBoundingClientRect = () => ({
    ...rect,
    width: rect.right - rect.left,
    height: rect.bottom - rect.top,
    x: rect.left,
    y: rect.top,
    toJSON: () => rect,
  });
}

/** Finds the drag-overlay `<p>` label by its exact Turkish copy (UI-SPEC §2). */
function dragLabel(text: string): HTMLParagraphElement | null {
  return (
    Array.from(container.querySelectorAll("p")).find(
      (p) => p.textContent === text
    ) ?? null
  );
}

/**
 * `react-dropzone`'s `onDrop` pipeline reads dropped files through an async
 * `getFilesFromEvent` (a `Promise`, even for the synchronous case this
 * composer configures — see rich-text-composer.tsx's `getFilesFromEvent`
 * doc-comment) — a plain `act(() => dispatchEvent(...))` does not wait for
 * that chain to settle. `setTimeout(resolve, 0)` schedules a macrotask,
 * which only runs after the microtask queue (every chained `.then()`) is
 * fully drained, so it reliably flushes the whole chain regardless of how
 * many `.then()` hops it takes.
 */
function flushPromises(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * ProseMirror's OWN native "drop" listener (registered directly on
 * `view.dom`, firing at the TARGET phase — before any ancestor's `onDrop`,
 * including react-dropzone's) calls `view.posAtCoords(...)` unconditionally
 * BEFORE ever consulting our plugin's `handleDrop` prop
 * (`prosemirror-view/dist/index.cjs`'s internal `handleDrop`). That call
 * reads `document.elementFromPoint`, which this repo's jsdom does not
 * implement at all — calling it throws, short-circuiting before our guard
 * ever runs. Stubbing it to resolve to a real element inside the editor
 * (removed again by the caller) is what lets ProseMirror's own dispatch
 * reach `view.someProp("handleDrop", ...)`, i.e. actually exercises the
 * Pitfall #6 guard rather than merely observing jsdom's unrelated crash.
 */
function stubElementFromPoint(target: Element): () => void {
  const doc = document as unknown as {
    elementFromPoint?: (x: number, y: number) => Element | null;
  };
  doc.elementFromPoint = () => target;
  return () => {
    delete doc.elementFromPoint;
  };
}

function makeChip(
  id: string,
  overrides: Partial<AttachmentChipVM> = {}
): AttachmentChipVM {
  return {
    id,
    filename: `${id}.pdf`,
    size: 1024,
    mimeType: "application/pdf",
    status: "done",
    ...overrides,
  };
}

function dispatchKey(
  key: string,
  options: KeyboardEventInit = {}
): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ...options,
  });
  act(() => editor().dispatchEvent(event));
  return event;
}

function selectAllEditorContent(): void {
  act(() => {
    editor().focus();
    editor().dispatchEvent(
      new KeyboardEvent("keydown", {
        key: "a",
        ctrlKey: true,
        bubbles: true,
        cancelable: true,
      })
    );
  });
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  jest.restoreAllMocks();
});

describe("RichTextComposer Tiptap contract", () => {
  it("offers the complete accessible Turkish toolbar with active states", () => {
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        recipientLabel="Ada <ada@example.test>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    [
      "Kalın",
      "İtalik",
      "Başlık",
      "Bağlantı",
      "Madde işaretli liste",
      "Numaralı liste",
      "Alıntı",
      "Geri al",
      "Yinele",
    ].forEach((label) => expect(button(label)).toBeTruthy());

    [
      "Kalın",
      "İtalik",
      "Başlık",
      "Bağlantı",
      "Madde işaretli liste",
      "Numaralı liste",
      "Alıntı",
    ].forEach((label) =>
      expect(button(label).hasAttribute("aria-pressed")).toBe(true)
    );
    expect(container.textContent).toContain(
      "Yanıt şu kişiye gidecek: Ada <ada@example.test>"
    );
    expect(container.querySelector('button[aria-label="Emoji"]')).toBeNull();
  });

  it("formats a selection with Tiptap commands and tracks active marks", () => {
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value="<p>Hello</p>"
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );

    selectAllEditorContent();
    act(() => button("Kalın").click());

    expect(onChange).toHaveBeenLastCalledWith("<p><strong>Hello</strong></p>");
    expect(button("Kalın").getAttribute("aria-pressed")).toBe("true");
  });

  it("does not reset the selection when the controlled parent mirrors onUpdate", () => {
    function ControlledComposer(): ReactElement {
      const [value, setValue] = useState("<p>Hello</p>");
      return (
        <RichTextComposer
          value={value}
          recipientLabel="Ada"
          onChange={setValue}
          onSubmit={jest.fn()}
        />
      );
    }

    render(<ControlledComposer />);
    selectAllEditorContent();
    act(() => button("İtalik").click());

    expect(editor().innerHTML).toContain("<em>Hello</em>");
    expect(button("İtalik").getAttribute("aria-pressed")).toBe("true");
  });

  it("creates safe links through a labelled validated embedded flow with focus return", () => {
    const onChange = jest.fn();
    const prompt = jest.spyOn(window, "prompt");
    render(
      <RichTextComposer
        value="<p>Hello</p>"
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );

    selectAllEditorContent();
    act(() => button("Bağlantı").click());
    const linkInput = container.querySelector<HTMLInputElement>(
      'input[aria-label], input[type="url"]'
    );
    expect(
      container.querySelector('[aria-label="Bağlantı ekle"]')
    ).not.toBeNull();
    expect(document.activeElement).toBe(linkInput);

    act(() => {
      if (!linkInput) return;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(linkInput, "javascript:bad()");
      linkInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((control) => control.textContent?.trim() === "Uygula")
        ?.click();
    });
    expect(container.textContent).toContain(
      "Geçerli bir http, https veya mailto adresi girin."
    );

    act(() => {
      if (!linkInput) return;
      const valueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      valueSetter?.call(linkInput, "https://example.test/help");
      linkInput.dispatchEvent(new Event("input", { bubbles: true }));
    });
    act(() => {
      Array.from(container.querySelectorAll<HTMLButtonElement>("button"))
        .find((control) => control.textContent?.trim() === "Uygula")
        ?.click();
    });
    expect(onChange).toHaveBeenLastCalledWith(
      '<p><a href="https://example.test/help" target="_blank" rel="noopener noreferrer">Hello</a></p>'
    );
    expect(document.activeElement).toBe(button("Bağlantı"));
    expect(prompt).not.toHaveBeenCalled();

    selectAllEditorContent();
    act(() => button("Bağlantı").click());
    const removeLink = Array.from(
      container.querySelectorAll<HTMLButtonElement>("button")
    ).find((control) => control.textContent?.trim() === "Bağlantıyı kaldır");
    expect(removeLink).toBeDefined();
    act(() => removeLink?.click());
    expect(onChange).toHaveBeenLastCalledWith("<p>Hello</p>");
    expect(document.activeElement).toBe(button("Bağlantı"));
  });

  it("creates bullet lists, ordered lists and quotes through their own editor commands", () => {
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value="<p>One</p><p>Two</p>"
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );
    selectAllEditorContent();
    act(() => button("Madde işaretli liste").click());
    expect(latestHtml(onChange)).toContain("<ul>");

    render(
      <RichTextComposer
        value="<p>One</p><p>Two</p>"
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );
    selectAllEditorContent();
    act(() => button("Numaralı liste").click());
    expect(latestHtml(onChange)).toContain("<ol>");

    render(
      <RichTextComposer
        value="<p>Quoted</p>"
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );
    selectAllEditorContent();
    act(() => button("Alıntı").click());
    expect(latestHtml(onChange)).toContain("<blockquote>");
  });

  it.each([
    ["Başlık 1", "<h1>Hello</h1>"],
    ["Başlık 2", "<h2>Hello</h2>"],
    ["Başlık 3", "<h3>Hello</h3>"],
  ])("applies %s and can return it to normal text", (heading, expectedHtml) => {
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value="<p>Hello</p>"
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );

    selectAllEditorContent();
    act(() => button("Başlık").click());
    expect(
      container.querySelector('[role="menu"][aria-label="Başlık düzeyi"]')
    ).not.toBeNull();
    act(() => button(heading).click());
    expect(onChange).toHaveBeenLastCalledWith(expectedHtml);

    act(() => button("Başlık").click());
    act(() => button("Normal metin").click());
    expect(onChange).toHaveBeenLastCalledWith("<p>Hello</p>");
  });

  it("uses Tiptap history for undo and redo", () => {
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value="<p>Hello</p>"
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );

    selectAllEditorContent();
    act(() => button("Kalın").click());
    expect(latestHtml(onChange)).toContain("<strong>Hello</strong>");

    act(() => button("Geri al").click());
    expect(onChange).toHaveBeenLastCalledWith("<p>Hello</p>");

    act(() => button("Yinele").click());
    expect(latestHtml(onChange)).toContain("<strong>Hello</strong>");
  });

  it("sanitizes paste before parsing and external restore before synchronization", () => {
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value="<p>Initial</p>"
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );

    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: {
        getData: (type: string) =>
          type === "text/html"
            ? '<div class="gmail_default"><strong>Pasted</strong><img src=x onerror=steal()></div><blockquote data-sc-authored-quote="true"><p>Inherited</p></blockquote><p>Trailing history</p>'
            : "Pasted",
      },
    });
    act(() => editor().dispatchEvent(paste));

    expect(paste.defaultPrevented).toBe(true);
    expect(editor().querySelector("img")).toBeNull();
    expect(onChange.mock.calls.at(-1)?.[0]).toContain(
      "<strong>Pasted</strong>"
    );
    expect(onChange.mock.calls.at(-1)?.[0]).not.toMatch(
      /Inherited|Trailing history|data-sc-authored-quote/
    );

    render(
      <RichTextComposer
        value={
          '<p onclick="steal()">Restored</p><script>bad()</script><blockquote data-sc-authored-quote="true"><p>Restored history</p></blockquote>'
        }
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );
    expect(editor().innerHTML).toContain("Restored");
    expect(editor().querySelector("script, [onclick]")).toBeNull();
    expect(editor().textContent).not.toContain("Restored history");

    render(
      <RichTextComposer
        value=""
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );
    expect(editor().textContent).toBe("");
  });

  it("keeps Enter native and submits only sanitized meaningful non-IME content", () => {
    const onSubmit = jest.fn();
    render(
      <RichTextComposer
        value={'<p onclick="steal()">Hello</p><script>bad()</script>'}
        recipientLabel="Ada"
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    const enter = dispatchKey("Enter");
    expect(enter.defaultPrevented).toBe(true);
    expect(editor().querySelectorAll("p")).toHaveLength(2);
    expect(onSubmit).not.toHaveBeenCalled();

    const composingSubmit = dispatchKey("Enter", {
      shiftKey: true,
      isComposing: true,
    });
    expect(onSubmit).not.toHaveBeenCalled();

    const submit = dispatchKey("Enter", { shiftKey: true });
    expect(submit.defaultPrevented).toBe(true);
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onSubmit.mock.calls[0][0]).toContain("Hello");
    expect(onSubmit.mock.calls[0][0]).not.toMatch(/onclick|script/i);

    onSubmit.mockClear();
    render(
      <RichTextComposer
        value="<p><br></p>"
        recipientLabel="Ada"
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );
    dispatchKey("Enter", { shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("submits the current sanitized content from the dock action", () => {
    const onSubmit = jest.fn();
    render(
      <RichTextComposer
        value={'<p onclick="steal()">Dock reply</p><script>bad()</script>'}
        recipientLabel="Ada"
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );

    act(() => button("Yanıt gönder").click());

    expect(onSubmit).toHaveBeenCalledWith("<p>Dock reply</p>");

    onSubmit.mockClear();
    render(
      <RichTextComposer
        value="<p><br></p>"
        recipientLabel="Ada"
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );
    expect(button("Yanıt gönder").disabled).toBe(true);
    act(() => button("Yanıt gönder").click());
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("preserves forwarded focus and blocks all interaction while disabled", () => {
    const ref: RefObject<HTMLDivElement> = createRef();
    const onChange = jest.fn();
    const onSubmit = jest.fn();
    render(
      <RichTextComposer
        ref={ref}
        value="<p>Cannot send</p>"
        recipientLabel="Ada"
        disabled
        autoFocus
        onChange={onChange}
        onSubmit={onSubmit}
      />
    );

    expect(ref.current).toBe(editor());
    expect(editor().getAttribute("contenteditable")).toBe("false");
    expect(editor().getAttribute("aria-disabled")).toBe("true");
    Array.from(container.querySelectorAll("button")).forEach((control) => {
      expect(control.disabled).toBe(true);
    });

    dispatchKey("Enter", { shiftKey: true });
    expect(onSubmit).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
  });

  it("forwards the editable surface and honors autoFocus when enabled", () => {
    const ref: RefObject<HTMLDivElement> = createRef();
    render(
      <RichTextComposer
        ref={ref}
        value="<p>Focus me</p>"
        recipientLabel="Ada"
        autoFocus
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    expect(ref.current).toBe(editor());
    expect(document.activeElement).toBe(editor());
  });
});

describe("RichTextComposer attachments (COMP-05/THRD-05)", () => {
  it("offers an attach toolbar button as the first toolbar action", () => {
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    expect(button("Dosya ekle")).toBeTruthy();
  });

  it("forwards dropped files on the composer root to onAttachFiles", async () => {
    const onAttachFiles = jest.fn();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onAttachFiles={onAttachFiles}
      />
    );

    const file = makeTestFile("rapor.pdf", 1024, "application/pdf");
    await act(async () => {
      composerRoot().dispatchEvent(makeDropEvent([file]));
      await flushPromises();
    });

    expect(onAttachFiles).toHaveBeenCalledWith([file]);
  });

  it("routes a NON-image file dropped directly onto the editor to attachments, never into the document body (D-13 rev./Pitfall #6 — a non-image drop is always an attachment, regardless of where it lands)", async () => {
    const onAttachFiles = jest.fn();
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={onChange}
        onSubmit={jest.fn()}
        onAttachFiles={onAttachFiles}
      />
    );
    const beforeHtml = editor().innerHTML;
    const file = makeTestFile("rapor.pdf", 2048, "application/pdf");
    const restoreElementFromPoint = stubElementFromPoint(editor());
    // `editor.setEditable()` (called from this composer's own mount-time
    // layout effect) emits a spurious Tiptap "update" event with an
    // unchanged, empty transaction — pre-existing behavior, unrelated to
    // this guard. Isolate the drop's effect by clearing that initial call.
    onChange.mockClear();

    await act(async () => {
      editor().dispatchEvent(makeDropEvent([file]));
      await flushPromises();
    });
    restoreElementFromPoint();

    expect(editor().innerHTML).toBe(beforeHtml);
    expect(onChange).not.toHaveBeenCalled();
    expect(onAttachFiles).toHaveBeenCalledWith([file]);
  });

  it("lets a non-file drop fall through harmlessly, without forwarding it or touching editor content", async () => {
    const onAttachFiles = jest.fn();
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={onChange}
        onSubmit={jest.fn()}
        onAttachFiles={onAttachFiles}
      />
    );
    const beforeHtml = editor().innerHTML;
    const restoreElementFromPoint = stubElementFromPoint(editor());
    // See the sibling test above — clears the mount-time spurious update.
    onChange.mockClear();

    // Empty `files` (e.g. an internal text drag carries no File objects) —
    // the `handleDrop` guard only intercepts file-carrying drops (Pitfall
    // #6); `event.defaultPrevented` isn't a reliable signal here since
    // react-dropzone's own root `onDrop` unconditionally calls
    // `preventDefault()` regardless of whether files are present.
    await act(async () => {
      editor().dispatchEvent(makeDropEvent([]));
      await flushPromises();
    });
    restoreElementFromPoint();

    expect(onAttachFiles).not.toHaveBeenCalled();
    expect(onChange).not.toHaveBeenCalled();
    expect(editor().innerHTML).toBe(beforeHtml);
  });

  it("renders each attachment chip with its filename and a working remove callback", () => {
    const onRemoveAttachment = jest.fn();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        attachments={[makeChip("a", { filename: "rapor.pdf" })]}
        onRemoveAttachment={onRemoveAttachment}
      />
    );

    expect(container.textContent).toContain("rapor.pdf");
    const removeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="rapor.pdf dosyasını kaldır"]'
    );
    expect(removeButton).not.toBeNull();

    act(() => removeButton?.click());
    expect(onRemoveAttachment).toHaveBeenCalledWith("a");
  });

  it("collapses 3+ attachments behind a summary pill that expands on click", () => {
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        attachments={[makeChip("a"), makeChip("b"), makeChip("c")]}
      />
    );

    const summary = button("3 dosya, listeyi genişlet");
    expect(summary.getAttribute("aria-expanded")).toBe("false");
    expect(container.textContent).not.toContain("a.pdf");

    act(() => summary.click());

    const expanded = button("3 dosya, listeyi daralt");
    expect(expanded.getAttribute("aria-expanded")).toBe("true");
    expect(container.textContent).toContain("a.pdf");
    expect(container.textContent).toContain("b.pdf");
    expect(container.textContent).toContain("c.pdf");
  });

  it("shows 1-2 attachments directly, with no summary pill", () => {
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        attachments={[makeChip("a"), makeChip("b")]}
      />
    );

    expect(container.textContent).toContain("a.pdf");
    expect(container.textContent).toContain("b.pdf");
    expect(container.querySelector('button[aria-label^="2 dosya"]')).toBeNull();
  });

  it("locks Gönder while an attachment is uploading and describes why via aria-describedby", () => {
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        attachmentsUploading
      />
    );

    const sendButton = button("Yanıt gönder");
    expect(sendButton.disabled).toBe(true);
    const describedBy = sendButton.getAttribute("aria-describedby");
    expect(describedBy).toBeTruthy();
    expect(document.getElementById(describedBy ?? "")?.textContent).toBe(
      "Ekler yükleniyor, gönderim şu anda kilitli."
    );

    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        attachmentsUploading={false}
      />
    );

    const unlockedButton = button("Yanıt gönder");
    expect(unlockedButton.disabled).toBe(false);
    expect(unlockedButton.getAttribute("aria-describedby")).toBeNull();
  });

  it("moves focus to the next remove button after removing a chip, never leaving it stranded", () => {
    function Wrapper(): ReactElement {
      const [attachments, setAttachments] = useState<AttachmentChipVM[]>([
        makeChip("a"),
        makeChip("b"),
        makeChip("c"),
      ]);
      return (
        <RichTextComposer
          value="<p>Metin</p>"
          onChange={jest.fn()}
          onSubmit={jest.fn()}
          attachments={attachments}
          onRemoveAttachment={(chipId) =>
            setAttachments((prev) => prev.filter((chip) => chip.id !== chipId))
          }
        />
      );
    }
    render(<Wrapper />);

    // Starts collapsed (3 files already present at mount, D-02) — expand
    // first so every chip's remove button is actually in the DOM.
    act(() => button("3 dosya, listeyi genişlet").click());

    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="a.pdf dosyasını kaldır"]'
        )
        ?.click()
    );
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "b.pdf dosyasını kaldır"
    );

    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="b.pdf dosyasını kaldır"]'
        )
        ?.click()
    );
    expect(document.activeElement?.getAttribute("aria-label")).toBe(
      "c.pdf dosyasını kaldır"
    );

    act(() =>
      container
        .querySelector<HTMLButtonElement>(
          'button[aria-label="c.pdf dosyasını kaldır"]'
        )
        ?.click()
    );
    expect(document.activeElement).toBe(button("Dosya ekle"));
  });
});

/**
 * Deferred promise helper (04-03's test convention) — lets a test control
 * exactly when the injected `onInlineImagePaste` adapter settles, so the
 * uploading-placeholder state can be asserted mid-flight.
 */
function deferredInlinePaste(): {
  onInlineImagePaste: jest.Mock<Promise<string | undefined>, [File]>;
  resolve: (objectUrl: string | undefined) => void;
  reject: (error: unknown) => void;
} {
  let resolve!: (objectUrl: string | undefined) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<string | undefined>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  const onInlineImagePaste: jest.Mock<Promise<string | undefined>, [File]> =
    jest.fn((_file: File) => promise);
  return { onInlineImagePaste, resolve, reject };
}

describe("RichTextComposer inline image paste/drop (COMP-08, D-13 rev.)", () => {
  it("uploads a file pasted into the editor and shows an uploading placeholder immediately", async () => {
    const { onInlineImagePaste } = deferredInlinePaste();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onInlineImagePaste={onInlineImagePaste}
      />
    );

    const file = makeTestFile("ekran-goruntusu.png", 2048, "image/png");
    await act(async () => {
      editor().dispatchEvent(makeClipboardPasteEvent([file]));
      await flushPromises();
    });

    expect(onInlineImagePaste).toHaveBeenCalledWith(file);
    expect(editor().querySelector("img")).not.toBeNull();
    expect(
      editor().querySelector(".inline-image-uploading")
    ).not.toBeNull();
  });

  it("swaps the placeholder's src to the resolved objectUrl and clears the uploading marker once the adapter resolves", async () => {
    const { onInlineImagePaste, resolve } = deferredInlinePaste();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onInlineImagePaste={onInlineImagePaste}
      />
    );

    const file = makeTestFile("ekran-goruntusu.png", 2048, "image/png");
    await act(async () => {
      editor().dispatchEvent(makeClipboardPasteEvent([file]));
      await flushPromises();
    });

    await act(async () => {
      resolve("https://usercontent.grispi.net/final-1");
      await flushPromises();
    });

    expect(
      editor().querySelector<HTMLImageElement>("img")?.src
    ).toBe("https://usercontent.grispi.net/final-1");
    expect(
      editor().querySelector(".inline-image-uploading")
    ).toBeNull();
  });

  it("removes the placeholder entirely and never shows a toast itself when the adapter resolves empty (UI-SPEC §8.4)", async () => {
    const { onInlineImagePaste, resolve } = deferredInlinePaste();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onInlineImagePaste={onInlineImagePaste}
      />
    );

    const file = makeTestFile("ekran-goruntusu.png", 2048, "image/png");
    await act(async () => {
      editor().dispatchEvent(makeClipboardPasteEvent([file]));
      await flushPromises();
    });
    expect(editor().querySelector("img")).not.toBeNull();

    await act(async () => {
      resolve(undefined);
      await flushPromises();
    });

    expect(editor().querySelector("img")).toBeNull();
    // The composer never renders/dispatches a toast itself (UI-SPEC §7's
    // toast lives in message-field.tsx/chat-screen.tsx, not here) — the
    // absence of any `role="status"`/sonner markup is the closest in-tree
    // signal this component stays silent on failure.
    expect(container.querySelector('[data-sonner-toast]')).toBeNull();
  });

  it("never calls the inline callback when the clipboard carries no files — existing HTML-paste cleaning still runs (Pitfall #1 regression gate)", async () => {
    const onInlineImagePaste = jest.fn();
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={onChange}
        onSubmit={jest.fn()}
        onInlineImagePaste={onInlineImagePaste}
      />
    );

    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: {
        getData: (type: string) =>
          type === "text/html" ? "<p>Yapıştırılan</p>" : "Yapıştırılan",
      },
    });
    act(() => editor().dispatchEvent(paste));

    expect(onInlineImagePaste).not.toHaveBeenCalled();
    expect(onChange.mock.calls.at(-1)?.[0]).toContain("Yapıştırılan");
  });

  it("never calls the inline callback while the composer is disabled (disabled check runs first)", async () => {
    const onInlineImagePaste = jest.fn();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onInlineImagePaste={onInlineImagePaste}
        disabled
      />
    );

    const file = makeTestFile("ekran-goruntusu.png", 2048, "image/png");
    await act(async () => {
      editor().dispatchEvent(makeClipboardPasteEvent([file]));
      await flushPromises();
    });

    expect(onInlineImagePaste).not.toHaveBeenCalled();
  });

  it("never calls the inline callback when the clipboard carries BOTH a file and html (FileHandler's documented fallthrough — accepted MVP limit)", async () => {
    const onInlineImagePaste = jest.fn();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onInlineImagePaste={onInlineImagePaste}
      />
    );

    const file = makeTestFile("shot.gif", 2048, "image/gif");
    await act(async () => {
      editor().dispatchEvent(
        makeClipboardPasteEvent([file], "<p>gif html fallback</p>")
      );
      await flushPromises();
    });

    expect(onInlineImagePaste).not.toHaveBeenCalled();
  });

  it("never calls the inline callback for a vector-graphic MIME paste (D-10)", async () => {
    const onInlineImagePaste = jest.fn();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onInlineImagePaste={onInlineImagePaste}
      />
    );

    const file = makeTestFile("icon.svg", 512, "image/svg+xml");
    await act(async () => {
      editor().dispatchEvent(makeClipboardPasteEvent([file]));
      await flushPromises();
    });

    expect(onInlineImagePaste).not.toHaveBeenCalled();
    expect(editor().querySelector("img")).toBeNull();
  });

  it("drops an all-image file directly onto the editor and it becomes INLINE, not an attachment (D-13 rev.)", async () => {
    const onAttachFiles = jest.fn();
    const { onInlineImagePaste } = deferredInlinePaste();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onAttachFiles={onAttachFiles}
        onInlineImagePaste={onInlineImagePaste}
      />
    );

    const file = makeTestFile("ekran-goruntusu.png", 2048, "image/png");
    const restoreElementFromPoint = stubElementFromPoint(editor());

    await act(async () => {
      editor().dispatchEvent(makeDropEvent([file]));
      await flushPromises();
    });
    restoreElementFromPoint();

    expect(onInlineImagePaste).toHaveBeenCalledWith(file);
    expect(onAttachFiles).not.toHaveBeenCalled();
    expect(editor().querySelector("img")).not.toBeNull();
  });
});

describe("RichTextComposer two-zone drag affordance (UI-SPEC §2, D-13 rev. UAT fix)", () => {
  it("clears the drag overlay after an editor-handled (inline) drop — the exact regression the user hit", async () => {
    const { onInlineImagePaste } = deferredInlinePaste();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onInlineImagePaste={onInlineImagePaste}
      />
    );

    const file = makeTestFile("ekran-goruntusu.png", 2048, "image/png");
    await act(async () => {
      composerRoot().dispatchEvent(makeDragEnterEvent([file]));
      await flushPromises();
    });
    expect(dragLabel("Mesaja göm")).not.toBeNull();
    expect(dragLabel("Dosya olarak ekle")).not.toBeNull();

    const restoreElementFromPoint = stubElementFromPoint(editor());
    await act(async () => {
      editor().dispatchEvent(makeDropEvent([file]));
      await flushPromises();
    });
    restoreElementFromPoint();

    expect(onInlineImagePaste).toHaveBeenCalledWith(file);
    expect(dragLabel("Mesaja göm")).toBeNull();
    expect(dragLabel("Dosya olarak ekle")).toBeNull();
    expect(dragLabel("Dosyaları buraya bırakın")).toBeNull();
  });

  it("clears the drag overlay via the capture-phase document safety net even when a downstream listener stops propagation before any of this composer's own bubble-phase clears can run (round 2 fix — the exact live-verification miss)", async () => {
    const onAttachFiles = jest.fn();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onAttachFiles={onAttachFiles}
      />
    );

    const file = makeTestFile("rapor.pdf", 1024, "application/pdf");
    await act(async () => {
      composerRoot().dispatchEvent(makeDragEnterEvent([file]));
      await flushPromises();
    });
    expect(dragLabel("Dosyaları buraya bırakın")).not.toBeNull();

    // Simulates exactly what live re-verification found: a downstream
    // consumer (a third-party extension, or in this case a hand-rolled
    // stand-in for one) calls `stopPropagation()` on the "drop" event
    // before it ever reaches react-dropzone's own React-delegated
    // `onDrop` — which is how `dragActive` got cleared in round 1. A
    // plain native listener attached directly to the composer root (NOT
    // through React, so it always runs before React's own delegated
    // listener further up the tree) reproduces that exact interference.
    const stopDownstreamPropagation = (event: Event): void => {
      event.stopPropagation();
    };
    composerRoot().addEventListener("drop", stopDownstreamPropagation);

    try {
      await act(async () => {
        composerRoot().dispatchEvent(makeDropEvent([file]));
        await flushPromises();
      });
    } finally {
      composerRoot().removeEventListener("drop", stopDownstreamPropagation);
    }

    // Proves the interference actually worked: react-dropzone's own
    // bubble-phase `onDrop` (round 1's only clearing path for the
    // attachment route) never got a chance to fire.
    expect(onAttachFiles).not.toHaveBeenCalled();
    // Yet the overlay is gone anyway — the capture-phase `document`
    // "drop" listener already ran, in full, before the bubble phase (and
    // therefore before `stopDownstreamPropagation`) ever started.
    expect(dragLabel("Dosyaları buraya bırakın")).toBeNull();
  });

  it("clears the drag overlay after a dropzone-handled (attachment) drop", async () => {
    const onAttachFiles = jest.fn();
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
        onAttachFiles={onAttachFiles}
      />
    );

    const file = makeTestFile("rapor.pdf", 1024, "application/pdf");
    await act(async () => {
      composerRoot().dispatchEvent(makeDragEnterEvent([file]));
      await flushPromises();
    });
    expect(dragLabel("Dosyaları buraya bırakın")).not.toBeNull();

    await act(async () => {
      composerRoot().dispatchEvent(makeDropEvent([file]));
      await flushPromises();
    });

    expect(onAttachFiles).toHaveBeenCalledWith([file]);
    expect(dragLabel("Dosyaları buraya bırakın")).toBeNull();
  });

  it("clears the drag overlay on dragend", async () => {
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    const file = makeTestFile("rapor.pdf", 1024, "application/pdf");
    await act(async () => {
      composerRoot().dispatchEvent(makeDragEnterEvent([file]));
      await flushPromises();
    });
    expect(dragLabel("Dosyaları buraya bırakın")).not.toBeNull();

    act(() => {
      document.dispatchEvent(makeDragEndEvent());
    });

    expect(dragLabel("Dosyaları buraya bırakın")).toBeNull();
  });

  it("clears the drag overlay when the pointer leaves the browser window entirely", async () => {
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    const file = makeTestFile("rapor.pdf", 1024, "application/pdf");
    await act(async () => {
      composerRoot().dispatchEvent(makeDragEnterEvent([file]));
      await flushPromises();
    });
    expect(dragLabel("Dosyaları buraya bırakın")).not.toBeNull();

    // `relatedTarget: null` is the standard "left the viewport" signal —
    // an ordinary in-page dragleave to a sibling/child element always
    // carries a real element there instead (see the sibling nested-child
    // churn test below, which must NOT clear on that path).
    act(() => {
      document.dispatchEvent(makeDragLeaveEvent(null));
    });

    expect(dragLabel("Dosyaları buraya bırakın")).toBeNull();
  });

  it("does not prematurely clear the overlay on nested-child dragenter/dragleave churn", async () => {
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    const file = makeTestFile("ekran-goruntusu.png", 2048, "image/png");
    // Pointer enters the composer root, then moves onto a deeply nested
    // child (the editor) — react-dropzone's own `dragTargetsRef` tracks
    // both as still-open targets.
    await act(async () => {
      composerRoot().dispatchEvent(makeDragEnterEvent([file]));
      await flushPromises();
    });
    await act(async () => {
      editor().dispatchEvent(makeDragEnterEvent([file]));
      await flushPromises();
    });
    expect(dragLabel("Mesaja göm")).not.toBeNull();

    // Pointer leaves the nested child but is still within the composer —
    // must NOT clear (the classic nested-child flicker).
    act(() => {
      editor().dispatchEvent(makeDragLeaveEvent(composerRoot()));
    });
    expect(dragLabel("Mesaja göm")).not.toBeNull();

    // Pointer now leaves the composer root itself — the real end of the
    // drag over this element — must clear.
    act(() => {
      composerRoot().dispatchEvent(makeDragLeaveEvent(null));
    });
    expect(dragLabel("Mesaja göm")).toBeNull();
  });

  it("makes the zone under the pointer active and dims the other, swapping live as the pointer crosses the editor boundary", async () => {
    render(
      <RichTextComposer
        value="<p>Metin</p>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );
    stubEditorDropZoneRect({ left: 0, top: 0, right: 300, bottom: 200 });

    const file = makeTestFile("ekran-goruntusu.png", 2048, "image/png");
    await act(async () => {
      composerRoot().dispatchEvent(
        makeDragEnterEvent([file], { clientX: 50, clientY: 50 })
      );
      await flushPromises();
    });

    expect(dragLabel("Mesaja göm")?.className).toContain("text-primary");
    expect(dragLabel("Dosya olarak ekle")?.className).toContain(
      "text-muted-foreground"
    );

    act(() => {
      composerRoot().dispatchEvent(
        makeDragOverEvent({ clientX: 500, clientY: 500 })
      );
    });

    expect(dragLabel("Mesaja göm")?.className).toContain(
      "text-muted-foreground"
    );
    expect(dragLabel("Dosya olarak ekle")?.className).toContain(
      "text-primary"
    );
  });
});
