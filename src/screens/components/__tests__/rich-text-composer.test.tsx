import { RichTextComposer } from "../rich-text-composer";
import { ReactElement, RefObject, act, createRef, useState } from "react";
import { Root, createRoot } from "react-dom/client";

import { makeDropEvent, makeTestFile } from "@/lib/attachment-test-helpers";
import type { AttachmentChipVM } from "@/store/attachment-upload-store";

let container: HTMLDivElement;
let root: Root;

beforeAll(() => {
  (
    globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }
  ).IS_REACT_ACT_ENVIRONMENT = true;
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
