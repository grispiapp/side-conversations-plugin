import { makeTestFile } from "@/lib/attachment-test-helpers";

import {
  attachmentKind,
  formatFileSize,
  rejectionToastLines,
  truncateFilename,
} from "../attachment-format";

describe("formatFileSize", () => {
  it("formats a small value in bytes", () => {
    expect(formatFileSize(512)).toBe("512 B");
  });

  it("formats a value under 1MB as rounded KB", () => {
    expect(formatFileSize(2048)).toBe("2 KB");
  });

  it("formats a value at or above 1MB as one-decimal comma-separated MB", () => {
    expect(formatFileSize(2_516_582)).toBe("2,4 MB");
  });

  it("does not crash on 0 bytes", () => {
    expect(formatFileSize(0)).toBe("0 B");
  });
});

describe("truncateFilename", () => {
  it("returns a name unchanged when it is at or under the limit", () => {
    expect(truncateFilename("short.pdf", 20)).toBe("short.pdf");
  });

  it("truncates a long name while preserving the extension intact and staying within the limit", () => {
    const name = "cok-uzun-musteri-dosyasi-v3-final-raporu.pdf";
    const result = truncateFilename(name, 20);

    expect(result.length).toBeLessThanOrEqual(20);
    expect(result.endsWith(".pdf")).toBe(true);
    expect(result).toContain("…");
  });

  it("truncates a long name with no extension without crashing", () => {
    const name = "a".repeat(40);
    const result = truncateFilename(name, 15);

    expect(result.length).toBeLessThanOrEqual(15);
    expect(result).toContain("…");
  });

  it("does not corrupt Turkish characters when truncating", () => {
    const name = "çok-uzun-müşteri-dosyası-v3-final-raporu.pdf";
    const result = truncateFilename(name, 22);

    expect(result.length).toBeLessThanOrEqual(22);
    expect(result.endsWith(".pdf")).toBe(true);
    expect(result.startsWith("ç")).toBe(true);
  });
});

describe("attachmentKind", () => {
  it("classifies image/png as image", () => {
    expect(attachmentKind("image/png")).toBe("image");
  });

  it("classifies image/svg+xml as its own 'svg' kind, distinct from image (D-10)", () => {
    expect(attachmentKind("image/svg+xml")).not.toBe("image");
    expect(attachmentKind("image/svg+xml")).toBe("svg");
  });

  it("classifies application/pdf as pdf", () => {
    expect(attachmentKind("application/pdf")).toBe("pdf");
  });

  it("classifies video/mp4 as video", () => {
    expect(attachmentKind("video/mp4")).toBe("video");
  });

  it("classifies application/zip as the generic file kind", () => {
    expect(attachmentKind("application/zip")).toBe("file");
  });

  it("classifies an empty/unknown MIME type as the generic file kind", () => {
    expect(attachmentKind("")).toBe("file");
    expect(attachmentKind(undefined)).toBe("file");
  });
});

describe("rejectionToastLines", () => {
  it("includes the filename, formatted size, and the fixed limit for a size rejection", () => {
    const file = makeTestFile("rapor.zip", 12_000_000, "application/zip");
    const lines = rejectionToastLines([{ file, reason: "size" }]);

    expect(lines).toHaveLength(1);
    expect(lines[0]).toContain("rapor.zip");
    expect(lines[0]).toContain(formatFileSize(file.size));
    expect(lines[0]).toContain("sınır 10 MB");
  });

  it("returns the fixed sentence for count and total-size rejections", () => {
    const file = makeTestFile("x.txt", 1024, "text/plain");
    const lines = rejectionToastLines([
      { file, reason: "count" },
      { file, reason: "total-size" },
    ]);

    expect(lines).toEqual([
      "En fazla 10 dosya ekleyebilirsiniz.",
      "Toplam ek boyutu 25 MB sınırını aşıyor.",
    ]);
  });

  it("caps the list at 3 lines plus one overflow line when more than 3 rejections exist", () => {
    const rejections = Array.from({ length: 5 }, (_, index) => ({
      file: makeTestFile(`f${index}.txt`, 1024, "text/plain"),
      reason: "count" as const,
    }));

    const lines = rejectionToastLines(rejections);

    expect(lines).toHaveLength(4);
    expect(lines[3]).toBe("+2 dosya daha");
  });
});
