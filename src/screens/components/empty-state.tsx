import { PlusIcon } from "@radix-ui/react-icons";
import { FC } from "react";

import { Button } from "@/components/ui/button";
import { useStore } from "@/contexts/store-context";

/**
 * Empty conversations list (LIST-04). The localized privacy sentence is the
 * feature's identity per CONTEXT.md and must always appear here. The CTA
 * now opens the compose screen (COMP-01, D-01) — same `Button`
 * element/classes as Phase 1's placeholder version, now enabled, so
 * there's no layout jump.
 */
export const EmptyState: FC = () => {
  const panelNavigation = useStore().panelNavigation;

  return (
    <section
      role="status"
      aria-label="Boş yan yazışma listesi"
      className="flex h-full min-w-0 flex-col items-center justify-center gap-3 py-8 text-center"
    >
      <h2 className="text-lg font-semibold">Henüz yan yazışma yok</h2>
      <p className="text-sm text-muted-foreground">
        Tedarikçi ya da başka bir ekiple, talep sahibinin görmediği ayrı bir
        e-posta akışı başlatın.
      </p>
      <p className="text-sm font-semibold text-foreground">
        Talep sahibi bu yazışmayı görmez.
      </p>
      <Button
        className="mt-2"
        aria-label="Yeni yazışma başlat"
        onClick={() => panelNavigation.openCompose()}
      >
        <PlusIcon className="mr-1 size-4" />
        Yeni yazışma başlat
      </Button>
    </section>
  );
};
