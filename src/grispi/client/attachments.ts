import { Authentication } from "./authentication";
import { HttpError, HttpHandler } from "./http-handler";

import { UploadFilesResponse } from "@/types/grispi.type";

/**
 * `POST {no public/v1 prefix}/attachments/upload` — CONFIRMED live (Phase 04
 * Plan 01 Task 1 checkpoint probe A1, see `04-01-SUMMARY.md` "Probe
 * Findings"). This breaks the `public/v1`-prefix convention every other
 * client method in this codebase follows: `public/v1/attachments/upload`
 * returns 403, while the root path (no prefix) returns 201. The response is
 * ALWAYS an array, even for a single uploaded file (multipart field name
 * `files`, plural) — `upload()` consumes only the first element.
 */
export class Attachments {
  constructor(
    private http: HttpHandler,
    private auth: Authentication
  ) {}

  /**
   * Uploads a single `File`. Pass `options.inline: true` for editor-embedded
   * images (Tiptap paste flow, D-22) — CONFIRMED live that `?inline=true`
   * round-trips as `inline: true` on the re-fetched comment's attachment
   * (Phase 04 Plan 01 probe A3). Binding the returned `id` to a comment is a
   * separate step handled by the caller against `/v2/tickets` (see
   * `04-01-SUMMARY.md` "Architecture Decision" — `public/v1` silently
   * ignores `comment.attachmentIds`). Each returned id can be bound to
   * exactly one comment — reusing an already-bound id returns HTTP 422
   * (probe finding N1).
   */
  async upload(
    file: File,
    options: { inline?: boolean } = {}
  ): Promise<UploadFilesResponse> {
    const formData = new FormData();
    formData.append("files", file);
    const suffix = options.inline ? "?inline=true" : "";

    const response = await this.http.sendMultipart<UploadFilesResponse[]>(
      `attachments/upload${suffix}`,
      formData,
      this.auth.headers
    );

    const [uploaded] = response;
    if (!uploaded) {
      // Reuse the existing HttpError taxonomy rather than adding a new error
      // class — an empty array from a 2xx response is itself an unexpected
      // server contract violation, so callers (the attachment-chip upload
      // handler) can treat it identically to any other upload failure.
      throw new HttpError(200, response);
    }

    return uploaded;
  }
}
