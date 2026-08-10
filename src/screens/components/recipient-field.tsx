import { Cross2Icon, EnvelopeClosedIcon } from "@radix-ui/react-icons";
import { observer } from "mobx-react-lite";
import { FocusEvent, KeyboardEvent, useEffect, useRef, useState } from "react";

import { Input } from "@/components/ui/input";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";
import { isValidEmail } from "@/lib/side-conversation";
import { cn } from "@/lib/utils";
import { useCustomersQuery } from "@/query/side-conversation-queries";

/**
 * Recipient autocomplete (COMP-02, D-04/05/06/07). No combobox analogue
 * exists in this codebase (02-PATTERNS.md), so it uses the Input primitive
 * and a full-width inline results surface. ComposeStore owns the typed and
 * selected values; the tenant-scoped Query hook owns debounced remote state.
 */
export const RecipientField = observer(() => {
  const { tenantId } = useGrispi();
  const compose = useStore().compose;
  const customerQuery = useCustomersQuery(tenantId, compose.query);
  const results = customerQuery.customers;
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const [popupOpen, setPopupOpen] = useState(true);
  const fieldRef = useRef<HTMLDivElement>(null);
  const popupId = "compose-recipient-popup";
  const listboxId = "compose-recipient-options";
  const helpId = "compose-recipient-help";

  // Reset keyboard highlight whenever the result set changes underneath it
  // (new search settled, or the panel closed) — an index into a stale array
  // is worse than no highlight at all.
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [results]);

  const trimmedQuery = compose.query.trim();
  const panelOpen =
    popupOpen && !compose.recipientLabel && trimmedQuery.length >= 3;
  const searchLoading =
    customerQuery.isDebouncing ||
    customerQuery.isPending ||
    customerQuery.isFetching;
  const searchError = panelOpen && !searchLoading && customerQuery.isError;
  const searchSettled = panelOpen && !searchLoading && !searchError;
  const selectableResults = results.filter(
    (result) => result.email !== null && isValidEmail(result.email)
  );
  const showFreeEmailRow =
    searchSettled &&
    isValidEmail(trimmedQuery) &&
    !results.some(
      (result) => result.email?.toLowerCase() === trimmedQuery.toLowerCase()
    );
  const selectableCount = selectableResults.length + (showFreeEmailRow ? 1 : 0);
  const hasResultOptions =
    searchSettled && (results.length > 0 || showFreeEmailRow);

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === "Escape" && panelOpen) {
      event.preventDefault();
      setHighlightedIndex(-1);
      setPopupOpen(false);
      return;
    }
    if (!searchSettled || selectableCount === 0) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.min(index + 1, selectableCount - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      if (highlightedIndex < selectableResults.length) {
        compose.selectRecipient(selectableResults[highlightedIndex]);
      } else {
        compose.selectFreeEmail(trimmedQuery);
      }
    }
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>): void {
    const nextFocus = event.relatedTarget as Node | null;
    if (nextFocus && fieldRef.current?.contains(nextFocus)) return;
    setHighlightedIndex(-1);
    setPopupOpen(false);
  }

  // D-06/D-04: after the current Query key settles empty, a valid address
  // becomes the free-email option. Invalid values receive localized generic
  // validation copy; raw remote errors are never rendered.
  const showInvalidWarning =
    searchSettled &&
    results.length === 0 &&
    !showFreeEmailRow &&
    trimmedQuery.includes("@") &&
    !isValidEmail(trimmedQuery);
  const showNoResults =
    searchSettled &&
    results.length === 0 &&
    !showFreeEmailRow &&
    !showInvalidWarning;

  return (
    <div
      ref={fieldRef}
      className="relative z-10 flex min-w-0 flex-col border-b border-border bg-card"
      onBlur={handleBlur}
    >
      <label htmlFor="compose-recipient" className="sr-only">
        Alıcı
      </label>
      {compose.recipientLabel ? (
        <div className="flex min-h-12 min-w-0 items-center gap-3 px-4 text-sm">
          <span
            aria-hidden="true"
            className="w-12 shrink-0 text-muted-foreground"
          >
            Kime
          </span>
          <span className="min-w-0 flex-1 truncate text-left">
            {compose.recipientLabel}
          </span>
          <button
            type="button"
            aria-label="Alıcıyı değiştir"
            className="-mr-2 flex size-9 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            onClick={() => {
              compose.selectFreeEmail("");
              compose.setQuery("");
            }}
          >
            <Cross2Icon className="size-3.5" />
          </button>
        </div>
      ) : (
        <Input
          id="compose-recipient"
          value={compose.query}
          onChange={(event) => {
            compose.setQuery(event.target.value);
            setPopupOpen(true);
          }}
          onFocus={() => setPopupOpen(true)}
          onKeyDown={handleKeyDown}
          className="h-12 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
          placeholder="Alıcı ara veya e-posta yaz…"
          // Browser autofill only — our own listbox below is unaffected.
          // Its dropdown otherwise covers the listbox and fights
          // aria-activedescendant.
          autoComplete="off"
          role="combobox"
          aria-expanded={hasResultOptions}
          aria-controls={hasResultOptions ? listboxId : undefined}
          aria-activedescendant={
            hasResultOptions && highlightedIndex >= 0
              ? `compose-recipient-option-${highlightedIndex}`
              : undefined
          }
          aria-describedby={helpId}
          aria-autocomplete="list"
          aria-haspopup={hasResultOptions ? "listbox" : undefined}
        />
      )}
      <span id={helpId} className="sr-only">
        Müşteri seçin veya geçerli bir e-posta adresi girin.
      </span>

      {panelOpen && (
        <div
          id={popupId}
          role="region"
          aria-label="Alıcı arama"
          className="absolute inset-x-0 top-full z-30 max-h-[calc(100vh-var(--panel-header-height)-3rem)] overflow-y-auto border-b border-border bg-card shadow-xl shadow-slate-950/10"
        >
          {searchLoading && (
            <div
              role="status"
              className="px-4 py-4 text-sm text-muted-foreground"
            >
              Aranıyor…
            </div>
          )}

          {searchError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-3 px-4 py-3 text-sm text-destructive"
            >
              <span>Alıcılar aranamadı.</span>
              <button
                type="button"
                className="min-h-11 shrink-0 rounded px-2 font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                onClick={() => void customerQuery.refetch()}
              >
                Yeniden dene
              </button>
            </div>
          )}

          {hasResultOptions && (
            <div id={listboxId} role="listbox" aria-label="Alıcı seçenekleri">
              {results.map((vm) => {
                const selectableIndex = selectableResults.indexOf(vm);
                const selectable = selectableIndex >= 0;

                if (!selectable) {
                  return (
                    <div
                      key={vm.id}
                      role="option"
                      aria-selected="false"
                      aria-disabled="true"
                      className="flex min-h-14 w-full cursor-not-allowed flex-col items-start justify-center gap-0.5 border-b border-border bg-muted/20 px-4 py-2.5 text-left text-muted-foreground last:border-b-0"
                    >
                      {vm.name && (
                        <span className="text-sm font-medium">{vm.name}</span>
                      )}
                      <span className="text-xs">E-posta adresi bulunmuyor</span>
                    </div>
                  );
                }

                return (
                  <button
                    key={vm.id}
                    id={`compose-recipient-option-${selectableIndex}`}
                    type="button"
                    role="option"
                    aria-selected={selectableIndex === highlightedIndex}
                    className={cn(
                      "flex min-h-14 w-full flex-col items-start justify-center gap-0.5 border-b border-border px-4 py-2.5 text-left last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                      selectableIndex === highlightedIndex
                        ? "bg-accent"
                        : "hover:bg-accent"
                    )}
                    onClick={() => compose.selectRecipient(vm)}
                  >
                    {vm.name && (
                      <span className="text-sm font-medium">{vm.name}</span>
                    )}
                    <span className="max-w-full truncate text-xs text-muted-foreground">
                      {vm.email}
                    </span>
                  </button>
                );
              })}

              {showFreeEmailRow && (
                <button
                  id={`compose-recipient-option-${selectableResults.length}`}
                  type="button"
                  role="option"
                  aria-selected={highlightedIndex === selectableResults.length}
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 border-b border-border px-4 py-2.5 text-left text-sm text-primary last:border-b-0 hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    highlightedIndex === selectableResults.length && "bg-accent"
                  )}
                  onClick={() => compose.selectFreeEmail(trimmedQuery)}
                >
                  <EnvelopeClosedIcon className="size-4 shrink-0" />
                  <span className="truncate">
                    {trimmedQuery} adresini kullan
                  </span>
                </button>
              )}
            </div>
          )}

          {showNoResults && (
            <div
              role="status"
              className="px-4 py-6 text-center text-sm text-muted-foreground"
            >
              Sonuç bulunamadı
            </div>
          )}

          {showInvalidWarning && (
            <div role="alert" className="px-4 py-3 text-sm text-destructive">
              Geçerli bir e-posta adresi girin.
            </div>
          )}
        </div>
      )}
    </div>
  );
});
