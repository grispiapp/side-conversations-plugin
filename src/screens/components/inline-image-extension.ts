import { mergeAttributes } from "@tiptap/core";
import Image from "@tiptap/extension-image";
import { Node as ProseMirrorNode } from "@tiptap/pm/model";
import type { Editor } from "@tiptap/react";

/**
 * D-10 (uniform, restated for the inline paste/drop path): this list is a
 * literal, exhaustive MIME allowlist — `@tiptap/extension-file-handler`'s
 * `allowedMimeTypes` matching is a byte-for-byte `Array.includes(file.type)`
 * check, no wildcard support (04-RESEARCH.md, source-verified). The raster
 * image MIME type that previews unsafely if ever embedded via `<object>`/
 * `<iframe>` is intentionally never added here — the D-10 rule the rest of
 * this phase already enforces for attachment chips and thread thumbnails.
 */
export const INLINE_IMAGE_MIME_TYPES = [
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
];

/**
 * Class name for the placeholder wrapper rendered while an inline image is
 * still uploading (UI-SPEC §8.2). Shared by `renderHTML` below, `index.css`,
 * and this file's own tests — a single source of truth for the selector.
 */
export const INLINE_IMAGE_UPLOADING_CLASS = "inline-image-uploading";

const UPLOADING_ATTR = "data-uploading";
const UPLOAD_ID_ATTR = "data-upload-id";

/**
 * `@tiptap/extension-image`, extended with two marker attributes used only
 * for the transient placeholder lifecycle (UI-SPEC §8 items 1-4):
 *
 * - `data-uploading` — presence (`"true"`) means this node is still a local
 *   preview waiting on its upload; both attributes are cleared together the
 *   moment `resolveInlineImagePlaceholder` swaps in the real `objectUrl`.
 * - `data-upload-id` — the placeholder id this file's three lifecycle
 *   helpers search the document for; never meaningful once uploading clears.
 *
 * The node's registered name is left untouched (`"image"`, inherited from
 * the base extension) so `insertContent({ type: "image", ... })` keeps
 * working with the standard node type string — this is also why `InlineImage`
 * must be the ONLY image extension registered in the composer's
 * `extensions` array; registering the base `Image` alongside it would be a
 * duplicate-name error.
 *
 * `renderHTML` stays structurally IDENTICAL to the base extension's plain
 * `<img>` output whenever the uploading marker is absent — the wrapper
 * below only appears while a placeholder is mid-upload, because UI-SPEC
 * §8.2's bottom-right spinner badge needs a real wrapper element to anchor
 * to (an `<img>` itself can't host a badge with its own background/shadow
 * independent of the image's own `object-fit` box).
 */
export const InlineImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      [UPLOADING_ATTR]: {
        default: null,
      },
      [UPLOAD_ID_ATTR]: {
        default: null,
      },
    };
  },

  renderHTML({ HTMLAttributes, node }) {
    const merged = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes);
    const isUploading = node.attrs[UPLOADING_ATTR] === "true";
    if (!isUploading) {
      return ["img", merged];
    }

    return [
      "span",
      { class: INLINE_IMAGE_UPLOADING_CLASS, "aria-busy": "true" },
      ["img", merged],
    ];
  },
});

let placeholderIdCounter = 0;

function nextPlaceholderId(): string {
  placeholderIdCounter += 1;
  return `inline-image-placeholder-${placeholderIdCounter}`;
}

interface FoundPlaceholder {
  pos: number;
  node: ProseMirrorNode;
}

/**
 * Walks the document once, returning the first `image` node carrying the
 * given placeholder id (or `null`). Shared by resolve/remove below — both
 * need the exact same "find the live placeholder" logic, and a document can
 * hold several placeholders at once (two overlapping pastes), so this must
 * match on `uploadId`, never "the first image node found".
 */
function findInlineImagePlaceholder(
  editor: Editor,
  uploadId: string
): FoundPlaceholder | null {
  let found: FoundPlaceholder | null = null;
  editor.state.doc.descendants((node, pos) => {
    if (found) return false;
    if (node.type.name === "image" && node.attrs[UPLOAD_ID_ATTR] === uploadId) {
      found = { pos, node };
      return false;
    }
    return true;
  });
  return found;
}

export interface InsertInlineImagePlaceholderParams {
  /** Local `URL.createObjectURL(file)` preview — never a data: URI (D-14). */
  src: string;
  /** Alt text — the source file's name. */
  alt: string;
  /**
   * Document position to insert at (FileHandler's `onDrop` supplies this,
   * computed via `posAtCoords` — D-13 rev., never recomputed by hand here).
   * Omitted for the paste path, which inserts at the current selection.
   */
  pos?: number;
}

/**
 * Inserts the placeholder node (imleç/drop konumu) and returns the
 * placeholder id the caller must hold onto for the later resolve/remove
 * call — or `null` if the editor is already destroyed (UI-SPEC §8's
 * lifecycle silently no-ops past teardown, it never throws).
 */
export function insertInlineImagePlaceholder(
  editor: Editor,
  params: InsertInlineImagePlaceholderParams
): string | null {
  if (editor.isDestroyed) return null;

  const uploadId = nextPlaceholderId();
  const attrs = {
    src: params.src,
    alt: params.alt,
    [UPLOADING_ATTR]: "true",
    [UPLOAD_ID_ATTR]: uploadId,
  };

  const chain = editor.chain().focus();
  if (typeof params.pos === "number") {
    chain.insertContentAt(params.pos, { type: "image", attrs });
  } else {
    chain.insertContent({ type: "image", attrs });
  }
  chain.run();

  return uploadId;
}

/**
 * Swaps the placeholder's `src` for the real, uploaded `objectUrl` and
 * clears both marker attributes in a SINGLE transaction (UI-SPEC §8.3) — no
 * `.focus()` call here, unlike insertion: resolving happens on a network
 * response that can land while the agent has since clicked elsewhere, and
 * stealing focus back would be a jarring surprise. Returns `false` (no-op)
 * if the placeholder is gone (removed by the agent while uploading) or the
 * editor is destroyed — never throws.
 */
export function resolveInlineImagePlaceholder(
  editor: Editor,
  uploadId: string,
  objectUrl: string
): boolean {
  if (editor.isDestroyed) return false;
  const found = findInlineImagePlaceholder(editor, uploadId);
  if (!found) return false;

  editor
    .chain()
    .command(({ tr }) => {
      tr.setNodeMarkup(found.pos, undefined, {
        ...found.node.attrs,
        src: objectUrl,
        [UPLOADING_ATTR]: null,
        [UPLOAD_ID_ATTR]: null,
      });
      return true;
    })
    .run();

  return true;
}

/**
 * Deletes the placeholder node entirely (UI-SPEC §8.4 — failure removes the
 * placeholder with NO retry affordance, deliberately distinct from D-07's
 * attachment-chip retry). No-op (returns `false`) if the placeholder is
 * already gone or the editor is destroyed — never throws.
 */
export function removeInlineImagePlaceholder(
  editor: Editor,
  uploadId: string
): boolean {
  if (editor.isDestroyed) return false;
  const found = findInlineImagePlaceholder(editor, uploadId);
  if (!found) return false;

  editor
    .chain()
    .command(({ tr }) => {
      tr.delete(found.pos, found.pos + found.node.nodeSize);
      return true;
    })
    .run();

  return true;
}
