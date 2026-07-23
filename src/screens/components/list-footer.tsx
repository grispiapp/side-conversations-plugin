import { ReloadIcon } from "@radix-ui/react-icons";
import { FC } from "react";

import { Button } from "@/components/ui/button";

/**
 * "Daha fazla yükle" pagination footer (D-12). Renders nothing when there is
 * no further page. While loading, the visible content swaps to a spinner
 * icon only — the accessible name (`aria-label`) stays constant so the
 * button never loses its name mid-interaction (D-14 + UI checker note), and
 * the fixed-width icon avoids a layout jump.
 */
export const ListFooter: FC<{
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
}> = ({ hasMore, loading, onLoadMore }) => {
  if (!hasMore) return null;

  return (
    <Button
      variant="outline"
      size="sm"
      className="mt-2 w-full"
      aria-label="Daha fazla yükle"
      disabled={loading}
      onClick={onLoadMore}
    >
      {loading ? (
        <ReloadIcon className="size-4 animate-spin" />
      ) : (
        "Daha fazla yükle"
      )}
    </Button>
  );
};
