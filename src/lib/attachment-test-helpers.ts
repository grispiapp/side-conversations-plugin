/**
 * Test-only helpers for constructing `File`/clipboard-paste/drop events under
 * jsdom. NOT imported by any production source file — only from `__tests__/`
 * directories (04-PATTERNS.md §`src/lib/attachment-test-helpers.ts`).
 *
 * Extracted from the `Object.defineProperty(event, "clipboardData", ...)`
 * idiom already used inline in
 * `src/screens/components/__tests__/rich-text-composer.test.tsx` (jsdom's
 * real `ClipboardEvent`/`DataTransfer` don't support constructing arbitrary
 * `files`, so read-only DOM event properties are faked this way).
 *
 * `hasNativeDataTransfer` records, at test-run time, whether this jsdom
 * version supports `new DataTransfer()` + `items.add(file)` (04-VALIDATION.md
 * Wave 0 capability registration, RESEARCH.md A11). `makeDropEvent` uses a
 * real `DataTransfer` when available and falls back to a plain-object stub
 * otherwise, so drop tests built on top of this helper are resilient to
 * jsdom's historically inconsistent `DataTransfer` support across versions.
 */

/** Minimal shape drop/paste handlers read off `event.dataTransfer` / `event.clipboardData`. */
interface FakeFileTransfer {
  files: File[];
  /**
   * `react-dropzone`'s internal `isEvtWithFiles` check reads
   * `dataTransfer.types` BEFORE ever touching `.files` (04-05-PLAN.md's
   * drop-routing test coverage) — a real browser always populates `types`
   * for a file drag, but this stub's non-native fallback path (the only
   * path this repo's jsdom exercises, `hasNativeDataTransfer === false`)
   * left it `undefined`, which throws inside `Array.prototype.some.call`.
   * Always present on the fallback branch so `makeDropEvent`-driven drops
   * work with `useDropzone` the same way a real drag would.
   */
  types?: string[];
  /**
   * ProseMirror's OWN native drop handling (which runs before our
   * `editorProps.handleDrop` guard is ever consulted, see
   * `rich-text-composer.test.tsx`'s `stubElementFromPoint`) calls
   * `dataTransfer.getData(...)` unconditionally while building a fallback
   * text slice — always present (empty string) on the fallback branch so
   * that call doesn't throw.
   */
  getData?: (type: string) => string;
  /**
   * `rich-text-composer.tsx`'s own `onDragEnter` handler reads
   * `dataTransfer.items` to decide which drag overlay to show — per spec,
   * `dragenter`/`dragover` only ever expose `DataTransferItem`-shaped
   * objects (`kind`/`type`), never real `File`s (those are only readable
   * on drop). Only populated by the drag-lifecycle helpers below
   * (`makeDragEnterEvent`); `makeDropEvent` deliberately leaves this
   * `undefined`, matching a real drop event.
   */
  items?: Array<{ kind: string; type: string }>;
}

/** Pointer coordinates for the drag-lifecycle helpers below (UAT fix, D-13 rev. two-zone tracking). */
interface DragCoordinates {
  clientX?: number;
  clientY?: number;
}

/**
 * `dragenter` — carries `DataTransferItem`-shaped payload info (never real
 * `File`s, matching real browsers) plus the pointer position, so
 * `rich-text-composer.tsx`'s `onDragEnter` can both classify the payload
 * (all-images vs mixed) and prime `dragOverEditor` before any `dragover`
 * has fired.
 */
export function makeDragEnterEvent(
  files: File[],
  coords: DragCoordinates = {}
): Event {
  const event = new Event("dragenter", { bubbles: true, cancelable: true });
  const dataTransfer: FakeFileTransfer = {
    files: [],
    types: files.length > 0 ? ["Files"] : [],
    items: files.map((file) => ({ kind: "file", type: file.type })),
    getData: () => "",
  };
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  Object.defineProperty(event, "clientX", { value: coords.clientX ?? 0 });
  Object.defineProperty(event, "clientY", { value: coords.clientY ?? 0 });
  return event;
}

/**
 * `dragover` — used to move the pointer during an in-progress drag (the
 * two-zone active/dimmed emphasis swap). `types` always reports `["Files"]`
 * while a file drag is in progress, matching real browsers and satisfying
 * react-dropzone's own `isEvtWithFiles` gate on this callback.
 */
export function makeDragOverEvent(coords: DragCoordinates = {}): Event {
  const event = new Event("dragover", { bubbles: true, cancelable: true });
  const dataTransfer: FakeFileTransfer = {
    files: [],
    types: ["Files"],
    getData: () => "",
  };
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  Object.defineProperty(event, "clientX", { value: coords.clientX ?? 0 });
  Object.defineProperty(event, "clientY", { value: coords.clientY ?? 0 });
  return event;
}

/**
 * `dragleave` — `relatedTarget` is the standard signal for "did the pointer
 * leave the viewport entirely" (`null`) vs "moved to a sibling/child
 * element" (an `Element`). Defaults to `null` (window-boundary case);
 * pass an element to simulate an ordinary in-page leave.
 */
export function makeDragLeaveEvent(
  relatedTarget: EventTarget | null = null
): Event {
  const event = new Event("dragleave", { bubbles: true, cancelable: true });
  const dataTransfer: FakeFileTransfer = {
    files: [],
    types: ["Files"],
    getData: () => "",
  };
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  Object.defineProperty(event, "relatedTarget", { value: relatedTarget });
  return event;
}

/** `dragend` — fires on the drag source when the gesture ends for any reason (drop or cancel). */
export function makeDragEndEvent(): Event {
  return new Event("dragend", { bubbles: true, cancelable: true });
}

export function makeTestFile(name: string, size: number, type: string): File {
  return new File([new Uint8Array(size)], name, { type });
}

/**
 * Runtime capability probe: does this jsdom support constructing a real
 * `DataTransfer` and adding a `File` to it via `items.add`? Computed once at
 * module load; `04-01-SUMMARY.md` records the observed value for this repo's
 * pinned Jest/jsdom version.
 */
export const hasNativeDataTransfer: boolean = (() => {
  try {
    const dt = new DataTransfer();
    const probe = new File([new Uint8Array(1)], "probe.txt", {
      type: "text/plain",
    });
    dt.items.add(probe);
    return dt.files.length === 1;
  } catch {
    return false;
  }
})();

export function makeClipboardPasteEvent(files: File[], html?: string): Event {
  const event = new Event("paste", { bubbles: true, cancelable: true });
  const clipboardData: FakeFileTransfer = {
    files,
    getData: (type: string) => (type === "text/html" ? (html ?? "") : ""),
  };
  Object.defineProperty(event, "clipboardData", { value: clipboardData });
  return event;
}

export function makeDropEvent(files: File[]): Event {
  const event = new Event("drop", { bubbles: true, cancelable: true });
  let dataTransfer: DataTransfer | FakeFileTransfer;
  if (hasNativeDataTransfer) {
    const dt = new DataTransfer();
    files.forEach((file) => dt.items.add(file));
    dataTransfer = dt;
  } else {
    dataTransfer = {
      files,
      types: files.length > 0 ? ["Files"] : [],
      getData: () => "",
    };
  }
  Object.defineProperty(event, "dataTransfer", { value: dataTransfer });
  return event;
}
