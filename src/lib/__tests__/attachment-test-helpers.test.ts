import {
  hasNativeDataTransfer,
  makeClipboardPasteEvent,
  makeDropEvent,
  makeTestFile,
} from "../attachment-test-helpers";

describe("makeTestFile", () => {
  it("builds a File with the requested name, size, and type", () => {
    const file = makeTestFile("probe.png", 42, "image/png");

    expect(file.name).toBe("probe.png");
    expect(file.size).toBe(42);
    expect(file.type).toBe("image/png");
  });
});

describe("makeDropEvent", () => {
  it("carries a single dropped file through event.dataTransfer.files", () => {
    const file = makeTestFile("report.pdf", 10, "application/pdf");
    const event = makeDropEvent([file]) as DragEvent;

    expect(event.dataTransfer?.files.length).toBe(1);
    expect(event.dataTransfer?.files[0]?.name).toBe("report.pdf");
  });
});

describe("makeClipboardPasteEvent", () => {
  it("carries a pasted file and an empty text/html fallback when no html is given", () => {
    const file = makeTestFile("screenshot.png", 10, "image/png");
    const event = makeClipboardPasteEvent([file]) as ClipboardEvent;

    expect(event.clipboardData?.files.length).toBe(1);
    expect(event.clipboardData?.getData("text/html")).toBe("");
  });

  it("returns the provided html from getData when no files are pasted", () => {
    const event = makeClipboardPasteEvent(
      [],
      "<p>x</p>"
    ) as ClipboardEvent;

    expect(event.clipboardData?.files.length).toBe(0);
    expect(event.clipboardData?.getData("text/html")).toBe("<p>x</p>");
  });
});

describe("hasNativeDataTransfer", () => {
  it("is a boolean capability flag", () => {
    expect(typeof hasNativeDataTransfer).toBe("boolean");
  });
});
