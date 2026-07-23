import { Cross2Icon, EnvelopeClosedIcon } from "@radix-ui/react-icons";
import { observer } from "mobx-react-lite";
import { KeyboardEvent, useEffect, useState } from "react";

import { Input } from "@/components/ui/input";
import { useStore } from "@/contexts/store-context";
import { isValidEmail } from "@/lib/side-conversation";
import { cn } from "@/lib/utils";
import { CustomerVM } from "@/store/compose-store";

/**
 * Alıcı otomatik-tamamlama alanı (COMP-02, D-04/05/06/07). No combobox
 * analog exists in this codebase (02-PATTERNS.md) — built from the plain
 * `Input` primitive + a `cn()`-styled absolute dropdown panel, no Radix
 * Popover (explicitly rejected, RESEARCH.md "Alternatives Considered").
 * Entirely driven off `ComposeStore` (`query`/`searchStatus`/`results`/
 * `showFreeEmailRow`) — the panel's visibility itself derives from
 * `query.trim().length >= 3` locally rather than a store flag, matching the
 * store's own debounce gate (D-04) 1:1.
 */
export const RecipientField = observer(() => {
  const compose = useStore().compose;
  const [highlightedIndex, setHighlightedIndex] = useState(-1);

  // Reset keyboard highlight whenever the result set changes underneath it
  // (new search settled, or the panel closed) — an index into a stale array
  // is worse than no highlight at all.
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [compose.results]);

  const trimmedQuery = compose.query.trim();
  const panelOpen = !compose.recipientLabel && trimmedQuery.length >= 3;

  function handleKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (compose.searchStatus !== "results") return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setHighlightedIndex((index) =>
        Math.min(index + 1, compose.results.length - 1)
      );
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setHighlightedIndex((index) => Math.max(index - 1, 0));
    } else if (event.key === "Enter" && highlightedIndex >= 0) {
      event.preventDefault();
      compose.selectRecipient(compose.results[highlightedIndex]);
    }
  }

  // D-06/D-04: once results are empty, showFreeEmailRow reduces to
  // isValidEmail(trimmedQuery) exactly — kept as an explicit branch (rather
  // than folded into one condition) so the invalid-format warning stays
  // legible as its own state, matching the plan's stated behavior.
  const showInvalidWarning =
    compose.searchStatus === "no-results" &&
    !compose.showFreeEmailRow &&
    !isValidEmail(trimmedQuery);
  const showNoResults =
    compose.searchStatus === "no-results" &&
    !compose.showFreeEmailRow &&
    !showInvalidWarning;

  return (
    <div className="relative flex flex-col gap-1">
      {compose.recipientLabel ? (
        <div className="flex items-center justify-between rounded-md border border-input bg-card px-3 py-1.5 text-sm">
          <span className="truncate">{compose.recipientLabel}</span>
          <button
            type="button"
            aria-label="Alıcıyı değiştir"
            className="shrink-0 text-muted-foreground hover:text-foreground"
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
          value={compose.query}
          onChange={(event) => compose.setQuery(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="İsim veya e-posta ile ara…"
          role="combobox"
          aria-expanded={panelOpen}
        />
      )}

      {panelOpen && (
        <div
          role="listbox"
          className="absolute top-full z-10 mt-1 w-full rounded-md border bg-card shadow"
        >
          {compose.searchStatus === "loading" && (
            <div className="px-3 py-2 text-xs text-muted-foreground">
              Aranıyor…
            </div>
          )}

          {compose.searchStatus === "results" &&
            compose.results.map((vm: CustomerVM, index: number) => (
              <button
                key={vm.id}
                type="button"
                role="option"
                aria-selected={index === highlightedIndex}
                className={cn(
                  "flex w-full flex-col items-start gap-0.5 px-3 py-2 text-left",
                  index === highlightedIndex ? "bg-accent" : "hover:bg-accent"
                )}
                onClick={() => compose.selectRecipient(vm)}
              >
                {vm.name && <span className="text-sm font-normal">{vm.name}</span>}
                <span className="font-mono text-xs text-muted-foreground">
                  {vm.email}
                </span>
              </button>
            ))}

          {showNoResults && (
            <div className="px-3 py-2 text-center text-xs text-muted-foreground">
              Sonuç bulunamadı
            </div>
          )}

          {showInvalidWarning && (
            <div className="px-3 py-2 text-xs text-destructive">
              Geçerli bir e-posta adresi girin.
            </div>
          )}

          {compose.showFreeEmailRow && (
            <button
              type="button"
              className="flex w-full items-center gap-2 border-t px-3 py-2 text-left text-sm text-primary hover:bg-accent"
              onClick={() => compose.selectFreeEmail(trimmedQuery)}
            >
              <EnvelopeClosedIcon className="size-4 shrink-0" />
              <span className="truncate">{trimmedQuery} adresini kullan</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
});
