import { Editor } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";

import {
  INLINE_IMAGE_UPLOADING_CLASS,
  InlineImage,
  insertInlineImagePlaceholder,
  removeInlineImagePlaceholder,
  resolveInlineImagePlaceholder,
} from "../inline-image-extension";

/**
 * Direct-`Editor`-instance harness (not the composer's React tree) — the
 * placeholder lifecycle is pure Tiptap/ProseMirror document manipulation,
 * independent of how the editor is mounted. A standalone `Editor` from
 * `@tiptap/core` (the exact class `rich-text-composer.tsx`'s `useEditor`
 * wraps) exercises the SAME `insertContent`/transaction machinery with far
 * less setup than rendering the full composer component tree.
 */
function makeEditor(): Editor {
  return new Editor({
    // `inline: true` matches `rich-text-composer.tsx`'s own configuration —
    // required so a second placeholder inserted right after a first one
    // never lands as a `NodeSelection`-replacing insert (see that file's
    // `InlineImage.configure` doc-comment for the full explanation).
    extensions: [StarterKit, InlineImage.configure({ inline: true })],
    content: "<p></p>",
  });
}

function imageNodes(editor: Editor): { pos: number; attrs: Record<string, unknown> }[] {
  const found: { pos: number; attrs: Record<string, unknown> }[] = [];
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "image") found.push({ pos, attrs: node.attrs });
  });
  return found;
}

describe("inline-image-extension placeholder lifecycle (UI-SPEC §8)", () => {
  it("insertInlineImagePlaceholder adds exactly one image node carrying the returned id as its data-upload-id attribute", () => {
    const editor = makeEditor();

    const uploadId = insertInlineImagePlaceholder(editor, {
      src: "blob:local-preview-1",
      alt: "shot.png",
    });

    expect(uploadId).not.toBeNull();
    const nodes = imageNodes(editor);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].attrs["data-upload-id"]).toBe(uploadId);
    expect(nodes[0].attrs["data-uploading"]).toBe("true");
    expect(nodes[0].attrs.src).toBe("blob:local-preview-1");
    expect(nodes[0].attrs.alt).toBe("shot.png");

    editor.destroy();
  });

  it("resolveInlineImagePlaceholder swaps src to the resolved objectUrl and clears BOTH marker attributes in one call", () => {
    const editor = makeEditor();
    const uploadId = insertInlineImagePlaceholder(editor, {
      src: "blob:local-preview-1",
      alt: "shot.png",
    }) as string;

    const applied = resolveInlineImagePlaceholder(
      editor,
      uploadId,
      "https://usercontent.grispi.net/final-1"
    );

    expect(applied).toBe(true);
    const nodes = imageNodes(editor);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].attrs.src).toBe("https://usercontent.grispi.net/final-1");
    expect(nodes[0].attrs["data-uploading"]).toBeNull();
    expect(nodes[0].attrs["data-upload-id"]).toBeNull();

    editor.destroy();
  });

  it("removeInlineImagePlaceholder deletes the node from the document entirely (no retry residue, UI-SPEC §8.4)", () => {
    const editor = makeEditor();
    const uploadId = insertInlineImagePlaceholder(editor, {
      src: "blob:local-preview-1",
      alt: "shot.png",
    }) as string;

    const removed = removeInlineImagePlaceholder(editor, uploadId);

    expect(removed).toBe(true);
    expect(imageNodes(editor)).toHaveLength(0);

    editor.destroy();
  });

  it("resolve/remove are safe no-ops for an unknown placeholder id — return false, never throw, never touch the document", () => {
    const editor = makeEditor();
    insertInlineImagePlaceholder(editor, {
      src: "blob:local-preview-1",
      alt: "shot.png",
    });
    const before = editor.getHTML();

    expect(() =>
      resolveInlineImagePlaceholder(editor, "unknown-id", "https://x")
    ).not.toThrow();
    expect(
      resolveInlineImagePlaceholder(editor, "unknown-id", "https://x")
    ).toBe(false);
    expect(() => removeInlineImagePlaceholder(editor, "unknown-id")).not.toThrow();
    expect(removeInlineImagePlaceholder(editor, "unknown-id")).toBe(false);
    expect(editor.getHTML()).toBe(before);

    editor.destroy();
  });

  it("resolving/removing one of two concurrent placeholders never affects the other (two overlapping pastes)", () => {
    const editor = makeEditor();
    const idA = insertInlineImagePlaceholder(editor, {
      src: "blob:a",
      alt: "a.png",
    }) as string;
    const idB = insertInlineImagePlaceholder(editor, {
      src: "blob:b",
      alt: "b.png",
    }) as string;

    resolveInlineImagePlaceholder(
      editor,
      idA,
      "https://usercontent.grispi.net/a-final"
    );

    const nodes = imageNodes(editor);
    expect(nodes).toHaveLength(2);
    const resolvedA = nodes.find(
      (node) => node.attrs.src === "https://usercontent.grispi.net/a-final"
    );
    const stillPendingB = nodes.find((node) => node.attrs.src === "blob:b");

    expect(resolvedA).toBeDefined();
    expect(resolvedA?.attrs["data-upload-id"]).toBeNull();
    expect(stillPendingB).toBeDefined();
    expect(stillPendingB?.attrs["data-upload-id"]).toBe(idB);
    expect(stillPendingB?.attrs["data-uploading"]).toBe("true");

    editor.destroy();
  });

  it("renders the uploading wrapper class in the DOM only while the marker is present, never once resolved", () => {
    const editor = makeEditor();
    const uploadId = insertInlineImagePlaceholder(editor, {
      src: "blob:local-preview-1",
      alt: "shot.png",
    }) as string;

    expect(editor.getHTML()).toContain(INLINE_IMAGE_UPLOADING_CLASS);

    resolveInlineImagePlaceholder(
      editor,
      uploadId,
      "https://usercontent.grispi.net/final-1"
    );

    expect(editor.getHTML()).not.toContain(INLINE_IMAGE_UPLOADING_CLASS);

    editor.destroy();
  });

  it("all three lifecycle helpers silently no-op on a destroyed editor instance — never throw", () => {
    const editor = makeEditor();
    editor.destroy();

    expect(
      insertInlineImagePlaceholder(editor, { src: "blob:x", alt: "x" })
    ).toBeNull();
    expect(resolveInlineImagePlaceholder(editor, "any", "https://x")).toBe(
      false
    );
    expect(removeInlineImagePlaceholder(editor, "any")).toBe(false);
  });
});
