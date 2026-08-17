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

  it("shows minimal successive sender identity and the shortened internal-note label", () => {
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
    expect(container.textContent).toContain("Ada Lovelace");
    expect(container.textContent).not.toContain("Siz");

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

  describe("sender identity (D-13/D-14/D-15)", () => {
    const ownMessage = {
      ...baseMessage,
      id: "own-ayse",
      direction: "own" as const,
      senderName: "Ayşe Yılmaz",
      senderEmail: "ayse@firma.test",
    };

    it("never lets the internal-note label carry the old second half, even when the agent matches", () => {
      render(
        <ThreadMessage
          message={{ ...baseMessage, id: "m-internal", internal: true }}
          agentEmail={baseMessage.senderEmail}
          onRetry={jest.fn()}
        />
      );
      expect(container.textContent).toContain("İç not");
      expect(container.textContent).not.toContain("Salt okunur");
    });

    it("shows each agent's real name on an own-direction message, with 'Siz' only for the active agent", () => {
      render(
        <ThreadMessage
          message={ownMessage}
          agentEmail="davut@firma.test"
          onRetry={jest.fn()}
        />
      );
      expect(container.textContent).toContain("Ayşe Yılmaz");
      expect(container.textContent).not.toContain("Siz");

      render(
        <ThreadMessage
          message={ownMessage}
          agentEmail="ayse@firma.test"
          onRetry={jest.fn()}
        />
      );
      expect(container.textContent).toContain("Ayşe Yılmaz");
      expect(container.textContent).toContain("Siz");
    });

    it("falls back to the bundled agent name for a still-pending optimistic own reply with no server sender name", () => {
      render(
        <ThreadMessage
          message={{
            ...baseMessage,
            id: "pending-own",
            direction: "own",
            senderName: undefined,
            senderEmail: "davut@firma.test",
            status: "pending",
          }}
          agentEmail="davut@firma.test"
          agentName="Davut Kember"
          onRetry={jest.fn()}
        />
      );
      expect(container.textContent).toContain("Davut Kember");
      expect(container.textContent).toContain("Siz");
    });

    it("falls back to senderEmail for a pending optimistic own reply when agentName is explicitly null (standalone dev, no name override)", () => {
      // Proves the real runtime value (standalone dev passes null, not
      // undefined) hits the same fallback branch as the test above.
      render(
        <ThreadMessage
          message={{
            ...baseMessage,
            id: "pending-own-null-agent-name",
            direction: "own",
            senderName: undefined,
            senderEmail: "davut@firma.test",
            status: "pending",
          }}
          agentEmail="davut@firma.test"
          agentName={null}
          onRetry={jest.fn()}
        />
      );
      expect(container.textContent).toContain("davut@firma.test");
      expect(container.textContent).toContain("Siz");
    });

    it("falls back through senderEmail then a static placeholder when neither senderName nor agentName exist", () => {
      render(
        <ThreadMessage
          message={{
            ...baseMessage,
            id: "own-email-only",
            direction: "own",
            senderName: undefined,
            senderEmail: "someone@firma.test",
          }}
          onRetry={jest.fn()}
        />
      );
      expect(container.textContent).toContain("someone@firma.test");

      render(
        <ThreadMessage
          message={{
            ...baseMessage,
            id: "own-no-identity",
            direction: "own",
            senderName: undefined,
            senderEmail: undefined,
          }}
          onRetry={jest.fn()}
        />
      );
      expect(container.textContent).toContain("Gönderen");
    });

    it("never marks an incoming message as the current agent even if the email matches", () => {
      render(
        <ThreadMessage
          message={baseMessage}
          agentEmail={baseMessage.senderEmail}
          onRetry={jest.fn()}
        />
      );
      expect(container.textContent).not.toContain("Siz");
    });

    it("never marks any message as the current agent when agentEmail is not provided", () => {
      render(<ThreadMessage message={ownMessage} onRetry={jest.fn()} />);
      expect(container.textContent).not.toContain("Siz");
    });
  });

  describe("identity row rendering (D-14)", () => {
    it("renders the sender name and the 'Siz' badge as separate DOM elements, not merged text", () => {
      render(
        <ThreadMessage
          message={{
            ...baseMessage,
            id: "own-match",
            direction: "own",
            senderName: "Davut Kember",
            senderEmail: "davut@firma.test",
          }}
          agentEmail="davut@firma.test"
          onRetry={jest.fn()}
        />
      );
      const nameEl = container.querySelector('[data-testid="sender-name"]');
      const badgeEl = container.querySelector('[data-testid="sender-badge"]');
      expect(nameEl?.textContent).toBe("Davut Kember");
      expect(badgeEl?.textContent).toBe("Siz");
      expect(nameEl).not.toBe(badgeEl);
    });

    it("omits the 'Siz' badge entirely from the DOM when the agent does not match", () => {
      render(
        <ThreadMessage
          message={{
            ...baseMessage,
            id: "own-mismatch",
            direction: "own",
            senderName: "Davut Kember",
            senderEmail: "davut@firma.test",
          }}
          agentEmail="baska@firma.test"
          onRetry={jest.fn()}
        />
      );
      expect(container.querySelector('[data-testid="sender-badge"]')).toBeNull();
    });

    it("keeps the internal note's amber visual language unchanged, with no name or badge", () => {
      render(
        <ThreadMessage
          message={{ ...baseMessage, id: "m-internal-2", internal: true }}
          agentEmail={baseMessage.senderEmail}
          onRetry={jest.fn()}
        />
      );
      expect(
        container.querySelector('[data-testid="thread-message-m-internal-2"]')
          ?.className
      ).toContain("border-l-amber-500");
      expect(container.querySelector('[data-testid="sender-badge"]')).toBeNull();
    });

    it("always truncates the sender name, never the badge or timestamp, for a long real name", () => {
      const longName = "A".repeat(80) + " Uzun Soyad Örneği";
      render(
        <ThreadMessage
          message={{
            ...baseMessage,
            id: "own-long-name",
            direction: "own",
            senderName: longName,
            senderEmail: "davut@firma.test",
          }}
          agentEmail="davut@firma.test"
          onRetry={jest.fn()}
        />
      );
      const nameEl = container.querySelector('[data-testid="sender-name"]');
      const badgeEl = container.querySelector('[data-testid="sender-badge"]');
      expect(nameEl?.className).toContain("truncate");
      expect(badgeEl?.className).toContain("shrink-0");
    });

    it("shows the bundled agent name for a pending own-direction message end to end", () => {
      render(
        <ThreadMessage
          message={{
            ...baseMessage,
            id: "pending-agent-name",
            direction: "own",
            senderName: undefined,
            senderEmail: "davut@firma.test",
            status: "pending",
          }}
          agentEmail="davut@firma.test"
          agentName="Davut Kember"
          onRetry={jest.fn()}
        />
      );
      expect(
        container.querySelector('[data-testid="sender-name"]')?.textContent
      ).toBe("Davut Kember");
    });
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
    // D-18 — the seven formatting actions now live inside the "Aa"
    // FormatMenu popover; open it before looking for their buttons.
    act(() => button("Biçimlendirme seçenekleri").click());
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
    // D-18 — open the "Aa" FormatMenu popover before clicking "Kalın".
    act(() => button("Biçimlendirme seçenekleri").click());
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
