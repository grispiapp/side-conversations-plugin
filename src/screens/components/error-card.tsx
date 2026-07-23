import { ExclamationTriangleIcon } from "@radix-ui/react-icons";
import { FC } from "react";

import { Button } from "@/components/ui/button";
import { HttpError, NetworkError } from "@/grispi/client/http-handler";

/**
 * Layered error experience (CORE-03/D-11). Copy switches on error TYPE, not
 * on `error.body`/`status`/headers — those are NEVER rendered or logged to
 * the user (V7 — Info Disclosure, T-03-01). Full-width, destructive-tinted.
 *
 * WR-05 (01-04 gap closure): `error` is nullable because the store's `load()`
 * catch sets `status="error"` with `error=null` for a non-Network/Http
 * exception (T-01-04-03) — the ternary below already degrades any non-
 * NetworkError value, including `null`, to the generic Turkish copy.
 */
export const ErrorCard: FC<{
  error: NetworkError | HttpError | null;
  onRetry: () => void;
}> = ({ error, onRetry }) => {
  const message =
    error instanceof NetworkError
      ? "Bağlantı sorunu nedeniyle yan görüşmeler yüklenemedi."
      : "Yan görüşmeler şu anda yüklenemiyor. Lütfen daha sonra tekrar deneyin.";

  return (
    <div className="flex flex-col items-center gap-3 rounded-md bg-card px-6 py-6 text-center">
      <ExclamationTriangleIcon className="size-6 text-destructive" />
      <p className="text-sm text-muted-foreground">{message}</p>
      <Button variant="destructive" size="sm" onClick={onRetry}>
        Yeniden dene
      </Button>
    </div>
  );
};
