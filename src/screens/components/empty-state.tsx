import { PlusIcon } from "@radix-ui/react-icons";
import { FC } from "react";

import { Button } from "@/components/ui/button";

/**
 * Empty conversations list (LIST-04). The privacy sentence
 * ("Talep sahibi bu yazışmayı görmez.") is the feature's identity per
 * CONTEXT.md's `<specifics>` and MUST always appear here. The "+" CTA is
 * visible but disabled (D-13) — Phase 2 only flips `disabled`, no layout
 * change — with a "Çok yakında" tooltip/aria-label.
 */
export const EmptyState: FC = () => {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-3 px-6 py-8 text-center">
      <h2 className="text-lg font-semibold">Henüz yan görüşme yok</h2>
      <p className="text-sm text-muted-foreground">
        Tedarikçi ya da başka bir ekiple, talep sahibinin görmediği ayrı bir
        e-posta akışı başlatın.
      </p>
      <p className="text-sm font-semibold text-primary">
        Talep sahibi bu yazışmayı görmez.
      </p>
      <Button
        className="mt-2"
        disabled
        aria-label="Çok yakında"
        title="Çok yakında"
      >
        <PlusIcon className="mr-1 size-4" />
        Yeni görüşme başlat
      </Button>
    </div>
  );
};
