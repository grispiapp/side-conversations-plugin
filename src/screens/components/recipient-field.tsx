import { Cross2Icon, EnvelopeClosedIcon } from "@radix-ui/react-icons";
import { observer } from "mobx-react-lite";
import {
  FocusEvent,
  KeyboardEvent,
  useEffect,
  useRef,
  useState,
} from "react";

import { Input } from "@/components/ui/input";
import { useGrispi } from "@/contexts/grispi-context";
import { useStore } from "@/contexts/store-context";
import { isValidEmail } from "@/lib/side-conversation";
import { cn } from "@/lib/utils";
import { useCustomersQuery } from "@/query/side-conversation-queries";

/**
 * Alıcı otomatik-tamamlama alanı (COMP-02, D-04/05/06/07). No combobox
 * analog exists in this codebase (02-PATTERNS.md) — built from the plain
 * `Input` primitive + a `cn()`-styled absolute dropdown panel, no Radix
 * Popover (explicitly rejected, RESEARCH.md "Alternatives Considered").
 * Typed input and the selected recipient stay in ComposeStore; debounced
 * remote results/loading/error come from the tenant-scoped Query hook. The
 * panel remains locally derived from the current input, so a prior key can
 * never keep stale options visible.
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
  const showFreeEmailRow =
    searchSettled &&
    isValidEmail(trimmedQuery) &&
    !results.some(
      (result) => result.email.toLowerCase() === trimmedQuery.toLowerCase()
    );
  const selectableCount = results.length + (showFreeEmailRow ? 1 : 0);
  const hasSelectableOptions = searchSettled && selectableCount > 0;

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
      if (highlightedIndex < results.length) {
        compose.selectRecipient(results[highlightedIndex]);
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

  // D-06/D-04: once the current Query key settles empty, a valid address
  // becomes the free-email row; an invalid value gets only generic Turkish
  // validation copy. Raw remote errors are never rendered.
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
      className="relative flex min-w-0 flex-col gap-1"
      onBlur={handleBlur}
    >
      <label
        htmlFor="compose-recipient"
        className="text-xs font-semibold text-foreground"
      >
        Alıcı
      </label>
      {compose.recipientLabel ? (
        <div className="flex min-h-11 min-w-0 items-center justify-between rounded-md border border-input bg-card pl-3 text-sm shadow-sm">
          <span className="truncate">{compose.recipientLabel}</span>
          <button
            type="button"
            aria-label="Alıcıyı değiştir"
            className="flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
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
          className="h-11"
          placeholder="İsim veya e-posta ile ara…"
          role="combobox"
          aria-expanded={hasSelectableOptions}
          aria-controls={hasSelectableOptions ? listboxId : undefined}
          aria-activedescendant={
            hasSelectableOptions && highlightedIndex >= 0
              ? `compose-recipient-option-${highlightedIndex}`
              : undefined
          }
          aria-describedby={helpId}
          aria-autocomplete="list"
          aria-haspopup={hasSelectableOptions ? "listbox" : undefined}
        />
      )}
      <span id={helpId} className="text-xs text-muted-foreground">
        Müşteri seçin veya geçerli bir e-posta adresi girin.
      </span>

      {panelOpen && (
        <div
          id={popupId}
          role="region"
          aria-label="Alıcı arama"
          className="absolute top-full z-10 mt-1 w-full rounded-md border bg-card shadow"
        >
          {searchLoading && (
            <div
              role="status"
              className="px-3 py-2 text-xs text-muted-foreground"
            >
              Aranıyor…
            </div>
          )}

          {searchError && (
            <div
              role="alert"
              className="flex items-center justify-between gap-2 px-3 py-2 text-xs text-destructive"
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

          {hasSelectableOptions && (
            <div id={listboxId} role="listbox" aria-label="Alıcı seçenekleri">
              {results.map((vm, index: number) => (
                <button
                  key={vm.id}
                  id={`compose-recipient-option-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === highlightedIndex}
                  className={cn(
                    "flex min-h-11 w-full flex-col items-start justify-center gap-1 px-3 py-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    index === highlightedIndex ? "bg-accent" : "hover:bg-accent"
                  )}
                  onClick={() => compose.selectRecipient(vm)}
                >
                  {vm.name && (
                    <span className="text-sm font-normal">{vm.name}</span>
                  )}
                  <span className="font-mono text-xs text-muted-foreground">
                    {vm.email}
                  </span>
                </button>
              ))}

              {showFreeEmailRow && (
                <button
                  id={`compose-recipient-option-${results.length}`}
                  type="button"
                  role="option"
                  aria-selected={highlightedIndex === results.length}
                  className={cn(
                    "flex min-h-11 w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                    results.length > 0 && "border-t",
                    highlightedIndex === results.length && "bg-accent"
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
              className="px-3 py-2 text-center text-xs text-muted-foreground"
            >
              Sonuç bulunamadı
            </div>
          )}

          {showInvalidWarning && (
            <div role="alert" className="px-3 py-2 text-xs text-destructive">
              Geçerli bir e-posta adresi girin.
            </div>
          )}
        </div>
      )}
    </div>
  );
});
