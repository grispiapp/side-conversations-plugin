import { AttachmentChip } from "../attachment-chip";
import { ReactElement, act } from "react";
import { Root, createRoot } from "react-dom/client";

import { AttachmentChipVM } from "@/store/attachment-upload-store";

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

function makeChip(overrides: Partial<AttachmentChipVM> = {}): AttachmentChipVM {
  return {
    id: "chip-1",
    filename: "rapor.pdf",
    size: 2_400_000,
    mimeType: "application/pdf",
    status: "done",
    ...overrides,
  };
}

describe("AttachmentChip", () => {
  it("renders the idle/uploaded copy: {filename} · {size}", () => {
    render(<AttachmentChip chip={makeChip({ filename: "rapor.pdf", size: 1024 })} />);

    expect(container.textContent).toContain("rapor.pdf");
    expect(container.textContent).toContain("1 KB");
  });

  it("renders the uploading copy with role=status/aria-live=polite", () => {
    render(<AttachmentChip chip={makeChip({ status: "uploading" })} />);

    expect(container.textContent).toContain("Yükleniyor…");
    const region = container.querySelector('[role="status"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-live")).toBe("polite");
  });

  it("renders the failed (network) copy with role=alert and a distinct message from server failures", () => {
    render(
      <AttachmentChip
        chip={makeChip({ status: "failed", errorKind: "network" })}
      />
    );

    expect(container.textContent).toContain("Bağlantı sorunu");
    expect(container.textContent).toContain("Tekrar dene");
    const alertRegion = container.querySelector('[role="alert"]');
    expect(alertRegion).not.toBeNull();
  });

  it("renders the failed (server) copy distinctly from the network failure copy", () => {
    render(
      <AttachmentChip chip={makeChip({ status: "failed", errorKind: "server" })} />
    );

    expect(container.textContent).toContain("Yüklenemedi");
    expect(container.textContent).not.toContain("Bağlantı sorunu");
  });

  it("the remove button's aria-label contains the filename and clicking it calls onRemove with the chip id", () => {
    const onRemove = jest.fn();
    render(
      <AttachmentChip chip={makeChip({ id: "chip-9", filename: "fatura.png" })} onRemove={onRemove} />
    );

    const removeButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="fatura.png dosyasını kaldır"]'
    );
    expect(removeButton).not.toBeNull();

    act(() => {
      removeButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRemove).toHaveBeenCalledWith("chip-9");
  });

  it("clicking the retry affordance in the failed state calls onRetry with the chip id", () => {
    const onRetry = jest.fn();
    render(
      <AttachmentChip
        chip={makeChip({ id: "chip-7", status: "failed", errorKind: "server" })}
        onRetry={onRetry}
      />
    );

    const retryButton = container.querySelector("button");
    expect(retryButton?.textContent).toContain("Tekrar dene");

    act(() => {
      retryButton?.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(onRetry).toHaveBeenCalledWith("chip-7");
  });

  it("does not render an <img> thumbnail for an SVG-typed chip (D-10)", () => {
    render(
      <AttachmentChip
        chip={makeChip({
          mimeType: "image/svg+xml",
          previewUrl: "blob:should-not-be-used",
        })}
      />
    );

    expect(container.querySelector("img")).toBeNull();
  });

  it("renders a real thumbnail <img> for a non-SVG image chip with a preview URL", () => {
    render(
      <AttachmentChip
        chip={makeChip({ mimeType: "image/png", previewUrl: "blob:mock-1" })}
      />
    );

    const img = container.querySelector("img");
    expect(img).not.toBeNull();
    expect(img?.getAttribute("src")).toBe("blob:mock-1");
  });

  it("renders as a link with target=_blank and rel containing both noopener and noreferrer when href is provided", () => {
    render(
      <AttachmentChip
        chip={makeChip()}
        href="https://usercontent.grispi.net/?objectkey=abc"
      />
    );

    const link = container.querySelector("a");
    expect(link).not.toBeNull();
    expect(link?.getAttribute("target")).toBe("_blank");
    expect(link?.getAttribute("rel")).toContain("noopener");
    expect(link?.getAttribute("rel")).toContain("noreferrer");
    // read-only mode renders no remove/retry buttons
    expect(container.querySelector("button")).toBeNull();
  });

  it("middle-truncates a long filename", () => {
    render(
      <AttachmentChip
        chip={makeChip({
          filename: "cok-uzun-musteri-dosyasi-v3-final-surumu.pdf",
        })}
      />
    );

    expect(container.textContent).not.toContain(
      "cok-uzun-musteri-dosyasi-v3-final-surumu.pdf"
    );
    expect(container.textContent).toContain("…");
    expect(container.textContent).toContain(".pdf");
  });
});
