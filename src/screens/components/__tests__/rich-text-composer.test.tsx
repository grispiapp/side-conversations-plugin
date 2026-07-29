import { RichTextComposer } from "../rich-text-composer";
import { ReactElement, RefObject, act, createRef, useState } from "react";
import { Root, createRoot } from "react-dom/client";

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
      "Bağlantı",
      "Liste",
      "Numaralı liste",
      "Emoji",
      "Alıntı",
      "Geri al",
      "Yinele",
    ].forEach((label) => expect(button(label)).toBeTruthy());

    [
      "Kalın",
      "İtalik",
      "Bağlantı",
      "Liste",
      "Numaralı liste",
      "Alıntı",
    ].forEach((label) =>
      expect(button(label).hasAttribute("aria-pressed")).toBe(true)
    );
    expect(container.textContent).toContain(
      "Yanıt şu kişiye gidecek: Ada <ada@example.test>"
    );
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

  it("creates safe links, lists, quotes and emoji through editor commands", () => {
    const onChange = jest.fn();
    jest.spyOn(window, "prompt").mockReturnValue("https://example.test/help");
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
    expect(onChange).toHaveBeenLastCalledWith(
      '<p><a href="https://example.test/help" target="_blank" rel="noopener noreferrer">Hello</a></p>'
    );

    render(
      <RichTextComposer
        value="<p>One</p><p>Two</p>"
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );
    selectAllEditorContent();
    act(() => button("Liste").click());
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

    act(() => button("Emoji").click());
    expect(latestHtml(onChange)).toContain("🙂");
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

    act(() => button("Emoji").click());
    expect(latestHtml(onChange)).toContain("🙂");

    act(() => button("Geri al").click());
    expect(onChange).toHaveBeenLastCalledWith("<p>Hello</p>");

    act(() => button("Yinele").click());
    expect(latestHtml(onChange)).toContain("🙂");
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
            ? '<div class="gmail_default"><strong>Pasted</strong><img src=x onerror=steal()></div>'
            : "Pasted",
      },
    });
    act(() => editor().dispatchEvent(paste));

    expect(paste.defaultPrevented).toBe(true);
    expect(editor().querySelector("img")).toBeNull();
    expect(onChange.mock.calls.at(-1)?.[0]).toContain(
      "<strong>Pasted</strong>"
    );

    render(
      <RichTextComposer
        value={'<p onclick="steal()">Restored</p><script>bad()</script>'}
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );
    expect(editor().innerHTML).toContain("Restored");
    expect(editor().querySelector("script, [onclick]")).toBeNull();

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
