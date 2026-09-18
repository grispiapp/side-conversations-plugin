import { Cross2Icon, EnvelopeClosedIcon } from "@radix-ui/react-icons";
import { FocusEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { useGrispi } from "@/contexts/grispi-context";
import { CcEntry, ccEntriesMatch, ccEntryIdentity } from "@/lib/email-ccs";
import { isValidEmail } from "@/lib/side-conversation";
import { cn } from "@/lib/utils";
import { useCustomersQuery } from "@/query/side-conversation-queries";

export interface CcFieldProps {
  entries: readonly CcEntry[];
  query: string;
  onQueryChange: (value: string) => void;
  onAdd: (entry: CcEntry) => void;
  onRemove: (identity: string) => void;
  /** a11y id prefix so compose/reply surfaces never collide. */
  idPrefix?: string;
  helperText?: string;
}

/** Prop-driven CC row (D-CC-5) — shared by compose and reply surfaces.
 * Mirrors RecipientField's autocomplete behavior; does not read a store. */
export function CcField({
  entries,
  query,
  onQueryChange,
  onAdd,
  onRemove,
  idPrefix = "cc",
  helperText,
}: CcFieldProps) {
  const { tenantId } = useGrispi();
  const customerQuery = useCustomersQuery(tenantId, query);
  const results = customerQuery.customers;
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [popupOpen, setPopupOpen] = useState(true);
  const fieldRef = useRef<HTMLDivElement>(null);
  const listboxId = `${idPrefix}-options`;
  const helpId = `${idPrefix}-help`;

  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  const trimmedQuery = query.trim();
  const panelOpen = popupOpen && trimmedQuery.length >= 3;
  const searchLoading =
    customerQuery.isDebouncing ||
    customerQuery.isPending ||
    customerQuery.isFetching;
  const searchSettled = panelOpen && !searchLoading && !customerQuery.isError;

  function isAlreadyAdded(entry: CcEntry): boolean {
    return (
      ccEntryIdentity(entry) !== null &&
      entries.some((existing) => ccEntriesMatch(existing, entry))
    );
  }

  const selectableResults = results.filter(
    (result) =>
      result.email !== null &&
      isValidEmail(result.email) &&
      !isAlreadyAdded({ id: result.id, email: result.email })
  );
  const showFreeEmailRow =
    searchSettled &&
    isValidEmail(trimmedQuery) &&
    !isAlreadyAdded({ id: null, email: trimmedQuery }) &&
    !results.some(
      (result) => result.email?.toLowerCase() === trimmedQuery.toLowerCase()
    );
  const selectableCount = selectableResults.length + (showFreeEmailRow ? 1 : 0);
  const hasResultOptions = searchSettled && selectableCount > 0;

  function addAndClear(entry: CcEntry): void {
    onAdd(entry);
    onQueryChange("");
    setHighlightedIndex(-1);
  }

  function tryAddFreeEmail(): void {
    if (!isValidEmail(trimmedQuery)) return;
    if (isAlreadyAdded({ id: null, email: trimmedQuery })) {
      onQueryChange("");
      return;
    }
    addAndClear({ id: null, email: trimmedQuery });
  }

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape" && panelOpen) {
      event.preventDefault();
      setHighlightedIndex(-1);
      setPopupOpen(false);
      return;
    }
    if (event.key === ",") {
      event.preventDefault();
      tryAddFreeEmail();
      return;
    }
    if (!searchSettled || selectableCount === 0) {
      if (event.key === "Enter") {
        event.preventDefault();
        tryAddFreeEmail();
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, selectableCount - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (highlightedIndex < 0) {
        tryAddFreeEmail();
      } else if (highlightedIndex < selectableResults.length) {
        const vm = selectableResults[highlightedIndex];
        addAndClear({ id: vm.id, email: vm.email });
      } else {
        tryAddFreeEmail();
      }
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    const nextFocus = event.relatedTarget as Node | null;
    if (nextFocus && fieldRef.current?.contains(nextFocus)) return;
    tryAddFreeEmail();
    setHighlightedIndex(-1);
    setPopupOpen(false);
  }

  return (
    <div
      ref={fieldRef}
      className="relative z-10 flex min-w-0 flex-col border-b border-border bg-card"
      onBlur={handleBlur}
    >
      <label htmlFor={`${idPrefix}-input`} className="sr-only">
        Cc
      </label>
      <div className="flex min-h-12 min-w-0 flex-wrap items-start gap-2 px-4 py-2 text-sm">
        <span
          aria-hidden="true"
          className="flex h-8 w-12 shrink-0 items-center text-muted-foreground"
        >
          Cc
        </span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
          {entries.map((entry) => {
            const identity = ccEntryIdentity(entry);
            if (identity === null) return null;
            const label = entry.email ?? `Kullanıcı #${entry.id}`;
            return (
              <span
                key={identity}
                className="flex h-8 min-w-0 max-w-full items-center gap-1 rounded-full border border-border bg-muted/40 pl-2.5 pr-1 text-xs"
              >
                <span className="min-w-0 truncate">{label}</span>
                <button
                  type="button"
                  aria-label={`${label} adresini Cc'den çıkar`}
                  className="flex size-6 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  onClick={() => onRemove(identity)}
                >
                  <Cross2Icon className="size-3" />
                </button>
              </span>
            );
          })}
          <input
            id={`${idPrefix}-input`}
            value={query}
            onChange={(event) => {
              onQueryChange(event.target.value);
              setPopupOpen(true);
            }}
            onFocus={() => setPopupOpen(true)}
            onKeyDown={handleKeyDown}
            className="h-8 min-w-[8rem] flex-1 border-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            placeholder={
              entries.length === 0 ? "Cc ekle veya e-posta yaz…" : ""
            }
            autoComplete="off"
            role="combobox"
            aria-expanded={hasResultOptions}
            aria-controls={hasResultOptions ? listboxId : undefined}
            aria-activedescendant={
              hasResultOptions && highlightedIndex >= 0
                ? `${idPrefix}-option-${highlightedIndex}`
                : undefined
            }
            aria-describedby={helpId}
            aria-autocomplete="list"
            aria-haspopup={hasResultOptions ? "listbox" : undefined}
          />
        </div>
      </div>
      <span id={helpId} className="sr-only">
        {helperText ??
          "Cc alıcısı seçin veya geçerli bir e-posta adresi girin."}
      </span>

      {panelOpen && hasResultOptions && (
        <div
          role="region"
          aria-label="Cc arama"
          className="absolute inset-x-0 top-full z-30 max-h-[calc(100vh-var(--panel-header-height)-3rem)] overflow-y-auto border-b border-border bg-card shadow-xl shadow-slate-950/10"
        >
          <div id={listboxId} role="listbox" aria-label="Cc seçenekleri">
            {selectableResults.map((vm, index) => (
              <button
                key={vm.id}
                id={`${idPrefix}-option-${index}`}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                className={cn(
                  "flex min-h-14 w-full flex-col items-start justify-center gap-0.5 border-b border-border px-4 py-2.5 text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  index === highlightedIndex ? "bg-accent" : "hover:bg-accent"
                )}
                onClick={() => addAndClear({ id: vm.id, email: vm.email })}
              >
                {vm.name && (
                  <span className="text-sm font-medium">{vm.name}</span>
                )}
                <span className="max-w-full truncate text-xs text-muted-foreground">
                  {vm.email}
                </span>
              </button>
            ))}

            {showFreeEmailRow && (
              <button
                id={`${idPrefix}-option-${selectableResults.length}`}
                type="button"
                role="option"
                aria-selected={highlightedIndex === selectableResults.length}
                className={cn(
                  "flex min-h-14 w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left text-sm text-primary last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  highlightedIndex === selectableResults.length && "bg-accent"
                )}
                onClick={() => tryAddFreeEmail()}
              >
                <EnvelopeClosedIcon className="size-4 shrink-0" />
                <span className="truncate">{trimmedQuery} adresini kullan</span>
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
