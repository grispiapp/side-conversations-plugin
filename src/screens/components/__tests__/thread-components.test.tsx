import { RichTextComposer } from "../rich-text-composer";
import { ThreadMessage } from "../thread-message";
import { ReactElement, act } from "react";
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

function button(label: string): HTMLButtonElement {
  const result = container.querySelector<HTMLButtonElement>(
    `button[aria-label="${label}"]`
  );
  if (!result) throw new Error(`Button not found: ${label}`);
  return result;
}

function editor(): HTMLDivElement {
  const result = container.querySelector<HTMLDivElement>(
    '[role="textbox"][aria-label="Yanıt"]'
  );
  if (!result) throw new Error("Editor not found");
  return result;
}

beforeEach(() => {
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("ThreadMessage", () => {
  const baseMessage = {
    id: "m1",
    direction: "incoming" as const,
    body:
      '<p onclick="steal()">Hello <strong>world</strong></p>' +
      "<script>steal()</script><blockquote><p>Earlier</p></blockquote>",
    status: "sent" as const,
    createdAt: Date.UTC(2026, 6, 28, 12, 30),
    senderName: "Ada Lovelace",
    senderEmail: "ada@example.test",
  };

  it("renders the first external sender fully and opens a sanitized quote on demand", () => {
    render(
      <ThreadMessage message={baseMessage} showFullSender onRetry={jest.fn()} />
    );

    expect(container.textContent).toContain("Ada Lovelace <ada@example.test>");
    expect(container.querySelector("strong")?.textContent).toBe("world");
    expect(container.querySelector("script")).toBeNull();
    expect(container.querySelector("[onclick]")).toBeNull();
    expect(container.textContent).not.toContain("Earlier");

    act(() => button("Önceki e-postayı göster").click());
    expect(container.textContent).toContain("Earlier");
  });

  it("never lets raw remote HTML bypass the shared split-and-sanitize sink", () => {
    render(
      <ThreadMessage
        message={{
          ...baseMessage,
          body:
            '<p aria-label="spoofed" data-secret="leak">Visible</p>' +
            '<a href="javascript:steal()" onclick="steal()">unsafe link</a>' +
            "<blockquote><img src=x onerror=steal()><p>Safe quote</p></blockquote>",
        }}
        onRetry={jest.fn()}
      />
    );

    expect(
      container.querySelector("script, img, [onclick], [onerror]")
    ).toBeNull();
    expect(
      container.querySelector("[aria-label='spoofed'], [data-secret]")
    ).toBeNull();
    expect(container.querySelector("a")?.hasAttribute("href")).toBe(false);

    act(() => button("Önceki e-postayı göster").click());
    expect(container.textContent).toContain("Safe quote");
    expect(container.querySelector("img")).toBeNull();
  });

  it("uses minimal successive/own identity and explicit internal-note treatment", () => {
    render(<ThreadMessage message={baseMessage} onRetry={jest.fn()} />);
    expect(container.textContent).toContain("Ada Lovelace");
    expect(container.textContent).not.toContain("ada@example.test");

    render(
      <ThreadMessage
        message={{
          ...baseMessage,
          id: "m2",
          direction: "own",
          body: "<p>Outgoing</p>",
        }}
        onRetry={jest.fn()}
      />
    );
    expect(container.textContent).toContain("Siz");

    render(
      <ThreadMessage
        message={{ ...baseMessage, id: "m3", internal: true }}
        onRetry={jest.fn()}
      />
    );
    expect(container.textContent).toContain("İç not");
    expect(
      container.querySelector('[data-testid="thread-message-m3"]')?.className
    ).toContain("border-l-amber-500");
  });

  it("keeps pending and failed retry behavior in the email-flow block", () => {
    const onRetry = jest.fn();
    render(
      <ThreadMessage
        message={{ ...baseMessage, status: "pending" }}
        onRetry={onRetry}
      />
    );
    expect(
      container.querySelector('[aria-label="Gönderiliyor"]')
    ).not.toBeNull();

    render(
      <ThreadMessage
        message={{ ...baseMessage, status: "failed", errorKind: "network" }}
        onRetry={onRetry}
      />
    );
    act(() => button("Gönderilemedi. Tekrar dene").click());
    expect(onRetry).toHaveBeenCalledWith("m1");
    expect(container.textContent).toContain("Bağlantı sorunu");
  });
});

describe("RichTextComposer", () => {
  it("shows the immutable recipient and the complete accessible compact toolbar", () => {
    render(
      <RichTextComposer
        value=""
        recipientLabel="Ada Lovelace <ada@example.test>"
        onChange={jest.fn()}
        onSubmit={jest.fn()}
      />
    );

    expect(container.textContent).toContain(
      "Yanıt şu kişiye gidecek: Ada Lovelace <ada@example.test>"
    );
    ["Kalın", "İtalik", "Bağlantı", "Liste", "Emoji", "Alıntı"].forEach(
      (name) => expect(button(name)).toBeTruthy()
    );
    expect(container.textContent).not.toMatch(/Görsel|Tablo|Dosya/);
    expect(editor().className).toContain("overflow-y-auto");
  });

  it("sanitizes editor input before reporting changes", () => {
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value=""
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );
    const editable = editor();

    editable.innerHTML =
      '<p style="color:red" onclick="steal()">Safe</p><img src=x><script>bad()</script>';
    act(() =>
      editable.dispatchEvent(new InputEvent("input", { bubbles: true }))
    );

    expect(onChange).toHaveBeenLastCalledWith("<p>Safe</p>");
    expect(editable.innerHTML).toBe("<p>Safe</p>");
  });

  it("sanitizes pasted HTML before it enters the controlled draft", () => {
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value=""
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );
    const editable = editor();
    const paste = new Event("paste", { bubbles: true, cancelable: true });
    Object.defineProperty(paste, "clipboardData", {
      value: {
        getData: (type: string) =>
          type === "text/html"
            ? '<p style="color:red">Pasted</p><img src=x onerror=steal()>'
            : "",
      },
    });

    act(() => editable.dispatchEvent(paste));

    expect(paste.defaultPrevented).toBe(true);
    expect(onChange).toHaveBeenLastCalledWith("<p>Pasted</p>");
    expect(editable.querySelector("img")).toBeNull();
  });

  it("keeps Enter as newline and submits sanitized non-empty HTML with Shift+Enter", () => {
    const onSubmit = jest.fn();
    render(
      <RichTextComposer
        value={'<p onclick="steal()">Hello</p><script>bad()</script>'}
        recipientLabel="Ada"
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );
    const editable = editor();
    const enter = new KeyboardEvent("keydown", {
      key: "Enter",
      bubbles: true,
      cancelable: true,
    });

    act(() => editable.dispatchEvent(enter));
    expect(enter.defaultPrevented).toBe(false);
    expect(onSubmit).not.toHaveBeenCalled();

    act(() =>
      editable.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      )
    );
    expect(onSubmit).toHaveBeenCalledWith("<p>Hello</p>");

    onSubmit.mockClear();
    render(
      <RichTextComposer
        value="<p><br></p>"
        recipientLabel="Ada"
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );
    act(() =>
      editor().dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: true,
          bubbles: true,
          cancelable: true,
        })
      )
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("cannot edit, format, or submit while disabled", () => {
    const onSubmit = jest.fn();
    render(
      <RichTextComposer
        value="<p>Cannot send</p>"
        recipientLabel="Ada"
        disabled
        onChange={jest.fn()}
        onSubmit={onSubmit}
      />
    );
    const editable = editor();

    expect(editable.getAttribute("contenteditable")).toBe("false");
    expect(editable.getAttribute("aria-disabled")).toBe("true");
    Array.from(container.querySelectorAll("button")).forEach((control) => {
      expect(control.disabled).toBe(true);
    });
    act(() =>
      editable.dispatchEvent(
        new KeyboardEvent("keydown", {
          key: "Enter",
          shiftKey: true,
          bubbles: true,
        })
      )
    );
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
