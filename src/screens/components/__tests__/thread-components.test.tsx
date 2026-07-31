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

function makeAttachment(overrides: Partial<{
  id: number;
  filename: string;
  mimeType: string;
  size: number;
  inline: boolean;
}> = {}) {
  const id = overrides.id ?? 1;
  return {
    id,
    filename: overrides.filename ?? `file-${id}.txt`,
    objectKey: `objectKey-${id}`,
    objectThumbKey: `objectThumbKey-${id}`,
    bucket: "bucket",
    mimeType: overrides.mimeType ?? "text/plain",
    size: overrides.size ?? 2048,
    userId: 4,
    objectThumbUrl: `https://usercontent.grispi.net/thumb-${id}`,
    objectUrl: `https://usercontent.grispi.net/file-${id}`,
    ...(overrides.inline !== undefined ? { inline: overrides.inline } : {}),
  };
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
    expect(container.textContent).toContain("Salt okunur");
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
    expect(
      container.querySelector('[role="status"][aria-label="Gönderiliyor"]')
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

  it("keeps authored quotes and trailing text visible for pending and canonical own replies", () => {
    const authoredBodyHtml =
      "<blockquote><p>Agent quote</p></blockquote><p>After quote</p>";
    const historyHtml = "<p>Earlier public message</p>";
    const outboundHtml = `${authoredBodyHtml}<blockquote>${historyHtml}</blockquote>`;
    const pending = {
      ...baseMessage,
      id: "pending-own",
      direction: "own" as const,
      body: outboundHtml,
      authoredBodyHtml,
      quotedHtml: historyHtml,
      status: "pending" as const,
    };

    render(<ThreadMessage message={pending} onRetry={jest.fn()} />);
    expect(container.textContent).toContain("Agent quote");
    expect(container.textContent).toContain("After quote");
    expect(container.textContent).not.toContain("Earlier public message");
    act(() => button("Önceki e-postayı göster").click());
    expect(container.textContent).toContain("Earlier public message");

    render(
      <ThreadMessage
        key="comment-2"
        message={{ ...pending, id: "comment-2", status: "sent" }}
        onRetry={jest.fn()}
      />
    );
    expect(container.textContent).toContain("Agent quote");
    expect(container.textContent).toContain("After quote");
    expect(container.textContent).not.toContain("Earlier public message");
    expect(container.textContent).not.toContain("Gönderiliyor");
  });

  it("renders no attachment block at all when the message has no attachments", () => {
    render(<ThreadMessage message={baseMessage} onRetry={jest.fn()} />);
    expect(container.querySelectorAll("a[target='_blank']").length).toBe(0);
  });

  it("renders an image attachment as a new-tab thumbnail link with hardened rel", () => {
    const image = makeAttachment({ id: 10, filename: "ekran-goruntusu.png", mimeType: "image/png" });
    render(
      <ThreadMessage
        message={{ ...baseMessage, attachments: [image] }}
        onRetry={jest.fn()}
      />
    );

    const link = container.querySelector<HTMLAnchorElement>(
      `a[href="${image.objectUrl}"]`
    );
    expect(link).not.toBeNull();
    expect(link?.target).toBe("_blank");
    expect(link?.rel).toContain("noopener");
    expect(link?.rel).toContain("noreferrer");
    expect(link?.querySelector("img")?.getAttribute("alt")).toBe(
      image.filename
    );
  });

  it("renders a pdf attachment in the file chip row, not the thumbnail row", () => {
    const pdf = makeAttachment({ id: 11, filename: "fatura.pdf", mimeType: "application/pdf" });
    render(
      <ThreadMessage
        message={{ ...baseMessage, attachments: [pdf] }}
        onRetry={jest.fn()}
      />
    );

    const link = container.querySelector<HTMLAnchorElement>(
      `a[href="${pdf.objectUrl}"]`
    );
    expect(link).not.toBeNull();
    expect(link?.querySelector("img")).toBeNull();
    expect(link?.textContent).toContain("fatura.pdf");
  });

  it("renders an SVG attachment as a file chip, never a thumbnail (D-10)", () => {
    const svg = makeAttachment({ id: 12, filename: "logo.svg", mimeType: "image/svg+xml" });
    render(
      <ThreadMessage
        message={{ ...baseMessage, attachments: [svg] }}
        onRetry={jest.fn()}
      />
    );

    const link = container.querySelector<HTMLAnchorElement>(
      `a[href="${svg.objectUrl}"]`
    );
    expect(link).not.toBeNull();
    expect(link?.querySelector("img")).toBeNull();
    expect(
      container.querySelector(`img[src="${svg.objectUrl}"]`)
    ).toBeNull();
  });

  it("still renders an inline-flagged attachment (D-22 regression guard)", () => {
    const inlineImage = makeAttachment({
      id: 13,
      filename: "gomulu.png",
      mimeType: "image/png",
      inline: true,
    });
    render(
      <ThreadMessage
        message={{ ...baseMessage, attachments: [inlineImage] }}
        onRetry={jest.fn()}
      />
    );

    expect(
      container.querySelector(`a[href="${inlineImage.objectUrl}"]`)
    ).not.toBeNull();
  });

  it("shows attachments for own-direction messages too", () => {
    const file = makeAttachment({ id: 14, filename: "kanit.pdf", mimeType: "application/pdf" });
    render(
      <ThreadMessage
        message={{
          ...baseMessage,
          id: "own-1",
          direction: "own",
          attachments: [file],
        }}
        onRetry={jest.fn()}
      />
    );

    expect(
      container.querySelector(`a[href="${file.objectUrl}"]`)
    ).not.toBeNull();
  });

  it("renders the attachment filename as plain text, never through an HTML sink", () => {
    const malicious = makeAttachment({
      id: 15,
      filename: "<img onerror=a()>.pdf",
      mimeType: "application/pdf",
    });
    render(
      <ThreadMessage
        message={{ ...baseMessage, attachments: [malicious] }}
        onRetry={jest.fn()}
      />
    );

    expect(container.querySelector("[onerror]")).toBeNull();
    const link = container.querySelector<HTMLAnchorElement>(
      `a[href="${malicious.objectUrl}"]`
    );
    expect(link?.textContent).toContain(malicious.filename);
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
    [
      "Kalın",
      "İtalik",
      "Başlık",
      "Bağlantı",
      "Madde işaretli liste",
      "Numaralı liste",
      "Alıntı",
    ].forEach((name) => expect(button(name)).toBeTruthy());
    expect(container.textContent).not.toMatch(/Görsel|Tablo|Dosya/);
    expect(container.querySelector('button[aria-label="Emoji"]')).toBeNull();
    expect(editor().className).toContain("overflow-y-auto");
    expect(editor().className).toContain("rich-text-content");
  });

  it("sanitizes editor updates before reporting changes", () => {
    const onChange = jest.fn();
    render(
      <RichTextComposer
        value={
          '<p style="color:red" onclick="steal()">Safe</p><img src=x><script>bad()</script>'
        }
        recipientLabel="Ada"
        onChange={onChange}
        onSubmit={jest.fn()}
      />
    );

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
    act(() => button("Kalın").click());

    const reportedHtml = onChange.mock.calls[onChange.mock.calls.length - 1][0];
    expect(reportedHtml).toContain("Safe");
    expect(reportedHtml).toContain("<strong>Safe</strong>");
    expect(reportedHtml).not.toMatch(/style=|onclick|img|script/i);
    expect(
      editor().querySelector("img, script, [onclick], [style]")
    ).toBeNull();
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
    expect(editable.querySelectorAll("p")).toHaveLength(2);
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
