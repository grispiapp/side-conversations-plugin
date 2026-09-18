/**
 * `ts.email_ccs` wire format (see `260918-fx7-API-CONTRACT.md`). Pure module
 * — no API calls, no React, no store access.
 */
export interface CcEntry {
  id: number | null;
  email: string | null;
}

function isEmptyOrNull(part: string): boolean {
  const trimmed = part.trim();
  return trimmed === "" || trimmed.toLowerCase() === "null";
}

function parseEntry(rawPart: string): CcEntry | null {
  const part = rawPart.trim();
  if (part === "") return null;

  if (!part.includes(":")) {
    const id = Number(part);
    return Number.isFinite(id) ? { id, email: null } : null;
  }

  const [rawId, rawEmail] = part.split(":");
  const id = rawId && !isEmptyOrNull(rawId) ? Number(rawId) : null;
  const email = rawEmail && !isEmptyOrNull(rawEmail) ? rawEmail.trim() : null;
  const resolvedId = id !== null && Number.isFinite(id) ? id : null;
  if (resolvedId === null && email === null) return null;
  return { id: resolvedId, email };
}

/** Reads `fieldMap["ts.email_ccs"].value` — never throws on malformed input. */
export function parseEmailCcsFieldValue(value: unknown): CcEntry[] {
  if (typeof value !== "string") return [];
  const entries = value
    .split(",")
    .map(parseEntry)
    .filter((entry): entry is CcEntry => entry !== null);
  return dedupeCcEntries(entries);
}

/** Writes the `id:email:phone` wire format. Empty list is `""` — a REAL
 * "clear all CCs" value, not the same as omitting the key entirely. */
export function serializeEmailCcs(entries: readonly CcEntry[]): string {
  return entries
    .filter((entry) => entry.id != null || entry.email != null)
    .map((entry) => (entry.id != null ? `${entry.id}:null:null` : `null:${entry.email}:null`))
    .join(",");
}

export function ccEntryIdentity(entry: CcEntry): string | null {
  if (entry.id != null) return String(entry.id);
  if (entry.email != null) return entry.email.trim().toLowerCase();
  return null;
}

export function dedupeCcEntries(entries: readonly CcEntry[]): CcEntry[] {
  const seen = new Set<string>();
  const result: CcEntry[] = [];
  for (const entry of entries) {
    const identity = ccEntryIdentity(entry);
    if (identity === null || seen.has(identity)) continue;
    seen.add(identity);
    result.push(entry);
  }
  return result;
}
