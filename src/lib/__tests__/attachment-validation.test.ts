import { makeTestFile } from "@/lib/attachment-test-helpers";

import {
  MAX_ATTACHMENT_BYTES,
  MAX_ATTACHMENT_COUNT,
  collectSurvivingInlineImageIds,
  validateAttachmentBatch,
} from "../attachment-validation";

describe("validateAttachmentBatch", () => {
  it("accepts a single file under the per-file limit with nothing rejected", () => {
    const file = makeTestFile("a.txt", 1024, "text/plain");

    const result = validateAttachmentBatch([], [file]);

    expect(result.accepted).toEqual([file]);
    expect(result.rejected).toEqual([]);
  });

  it("rejects a single file over the per-file limit for 'size', while other valid files in the same batch are still accepted (D-11 partial rejection)", () => {
    const tooBig = makeTestFile("big.zip", MAX_ATTACHMENT_BYTES + 1, "application/zip");
    const ok = makeTestFile("ok.txt", 1024, "text/plain");

    const result = validateAttachmentBatch([], [tooBig, ok]);

    expect(result.accepted).toEqual([ok]);
    expect(result.rejected).toEqual([{ file: tooBig, reason: "size" }]);
  });

  it("rejects overflow files by 'count' when the existing count is already near the cap", () => {
    const existing = Array.from({ length: 9 }, () => ({ size: 100 }));
    const incoming = [
      makeTestFile("f1.txt", 100, "text/plain"),
      makeTestFile("f2.txt", 100, "text/plain"),
      makeTestFile("f3.txt", 100, "text/plain"),
    ];

    const result = validateAttachmentBatch(existing, incoming);

    expect(result.accepted).toEqual([incoming[0]]);
    expect(result.rejected).toEqual([
      { file: incoming[1], reason: "count" },
      { file: incoming[2], reason: "count" },
    ]);
    expect(result.accepted.length + result.rejected.length).toBe(3);
  });

  it("rejects overflow files by 'total-size' in batch order once the running total would exceed the budget", () => {
    // Each file stays under the 10MB per-file cap on its own, but three of
    // them (27MB) exceed the 25MB total budget — the first two win (earlier
    // files in the batch win, UI-SPEC §3), the third is rejected.
    const perFile = 9 * 1024 * 1024;
    const first = makeTestFile("first.bin", perFile, "application/octet-stream");
    const second = makeTestFile("second.bin", perFile, "application/octet-stream");
    const third = makeTestFile("third.bin", perFile, "application/octet-stream");

    const result = validateAttachmentBatch([], [first, second, third]);

    expect(result.accepted).toEqual([first, second]);
    expect(result.rejected).toEqual([{ file: third, reason: "total-size" }]);
  });

  it("prioritizes rejection reasons in the order size -> count -> total-size (UI-SPEC §3)", () => {
    // A file that is simultaneously over the per-file size limit AND would
    // push the batch over count/total — must report "size", not the others.
    const existing = Array.from({ length: MAX_ATTACHMENT_COUNT }, () => ({ size: 100 }));
    const tooBig = makeTestFile("huge.bin", MAX_ATTACHMENT_BYTES + 1, "application/octet-stream");

    const result = validateAttachmentBatch(existing, [tooBig]);

    expect(result.rejected).toEqual([{ file: tooBig, reason: "size" }]);
  });

  it("never rejects a file for its MIME type (D-09) — executables/archives are accepted", () => {
    const exe = makeTestFile("tool.exe", 1024, "application/x-msdownload");
    const zip = makeTestFile("archive.zip", 1024, "application/zip");

    const result = validateAttachmentBatch([], [exe, zip]);

    expect(result.accepted).toEqual([exe, zip]);
    expect(result.rejected).toEqual([]);
  });
});

describe("collectSurvivingInlineImageIds", () => {
  it("returns the id of an inline image whose objectUrl still appears in the body", () => {
    const ids = collectSurvivingInlineImageIds(
      '<p><img src="https://x/a.png"></p>',
      [{ id: 1, objectUrl: "https://x/a.png" }]
    );

    expect(ids).toEqual([1]);
  });

  it("drops the id of an inline image removed from the body (D-16)", () => {
    const ids = collectSurvivingInlineImageIds("<p>no images here</p>", [
      { id: 1, objectUrl: "https://x/a.png" },
    ]);

    expect(ids).toEqual([]);
  });

  it("returns an empty array for an empty inline image list or empty body", () => {
    expect(collectSurvivingInlineImageIds("<p>hi</p>", [])).toEqual([]);
    expect(
      collectSurvivingInlineImageIds("", [{ id: 1, objectUrl: "https://x/a.png" }])
    ).toEqual([]);
  });

  it("preserves the input order of the surviving ids", () => {
    const body = '<img src="https://x/b.png"><img src="https://x/a.png">';
    const ids = collectSurvivingInlineImageIds(body, [
      { id: 1, objectUrl: "https://x/a.png" },
      { id: 2, objectUrl: "https://x/b.png" },
    ]);

    expect(ids).toEqual([1, 2]);
  });

  // Regression coverage for the phase-end UAT bug (TICKET-592): the raw
  // `objectUrl` from the upload response contains a bare `&`, but the
  // composer's serialized HTML always entity-encodes it as `&amp;`, and the
  // server additionally re-encodes `=` as `&#61;` on storage (04-01 N3).
  describe("encoding-insensitive matching (TICKET-592 regression)", () => {
    const objectUrl =
      "https://usercontent.grispi.net/?tenant=gsocial-test&objectkey=key-abc123.grspaf";

    it("(a) still matches when the body contains the raw, unencoded URL", () => {
      const body = `<p><img src="${objectUrl}"></p>`;

      const ids = collectSurvivingInlineImageIds(body, [{ id: 1, objectUrl }]);

      expect(ids).toEqual([1]);
    });

    it("(b) matches when the body HTML-entity-encodes '&' as '&amp;' (composer serialization)", () => {
      const encoded =
        "https://usercontent.grispi.net/?tenant=gsocial-test&amp;objectkey=key-abc123.grspaf";
      const body = `<p><img src="${encoded}"></p>`;

      const ids = collectSurvivingInlineImageIds(body, [{ id: 1, objectUrl }]);

      expect(ids).toEqual([1]);
    });

    it("(c) matches when the body is doubly re-encoded ('=' -> '&#61;' AND '&' -> '&amp;', N3 server round-trip)", () => {
      const doublyEncoded =
        "https://usercontent.grispi.net/?tenant&#61;gsocial-test&amp;objectkey&#61;key-abc123.grspaf";
      const body = `<p><img src="${doublyEncoded}"></p>`;

      const ids = collectSurvivingInlineImageIds(body, [{ id: 1, objectUrl }]);

      expect(ids).toEqual([1]);
    });

    it("(d) still drops a deleted image's id even with entity-encoded bodies present for other images", () => {
      const survivorEncoded =
        "https://usercontent.grispi.net/?tenant=gsocial-test&amp;objectkey=key-survivor.grspaf";
      const body = `<p><img src="${survivorEncoded}"></p>`;

      const ids = collectSurvivingInlineImageIds(body, [
        { id: 1, objectUrl: "https://usercontent.grispi.net/?tenant=gsocial-test&objectkey=key-survivor.grspaf" },
        { id: 2, objectUrl: "https://usercontent.grispi.net/?tenant=gsocial-test&objectkey=key-deleted.grspaf" },
      ]);

      expect(ids).toEqual([1]);
    });

    it("(e) does not confuse two different uploads whose objectkeys share a common prefix", () => {
      const bodyWithLongerKey =
        '<p><img src="https://usercontent.grispi.net/?tenant=gsocial-test&amp;objectkey=key-abc.grspaf"></p>';

      const ids = collectSurvivingInlineImageIds(bodyWithLongerKey, [
        {
          id: 1,
          objectUrl: "https://usercontent.grispi.net/?tenant=gsocial-test&objectkey=key-ab.grspaf",
        },
        {
          id: 2,
          objectUrl: "https://usercontent.grispi.net/?tenant=gsocial-test&objectkey=key-abc.grspaf",
        },
      ]);

      expect(ids).toEqual([2]);
    });
  });
});
