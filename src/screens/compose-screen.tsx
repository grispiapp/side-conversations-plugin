import { observer } from "mobx-react-lite";

import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useStore } from "@/contexts/store-context";

/**
 * Compose screen shell (COMP-01). This plan wires only the navigable
 * shell — RecipientField/SubjectField/MessageField/"Gönder" land in
 * Plan 03 (see 02-UI-SPEC.md "Compose screen anatomy"). `isDirty` is
 * hardcoded `false` until a real form exists: Plan 05 replaces this with
 * the actual dirty check against compose-store field state (D-02).
 */
export const ComposeScreen = observer(() => {
  const panelNav = useStore().panelNavigation;

  const isDirty = false;

  return (
    <Screen>
      <ScreenHeader onBack={() => panelNav.requestBack(isDirty)}>
        <ScreenTitle>Yeni Görüşme</ScreenTitle>
      </ScreenHeader>
      <ScreenContent>
        <div className="flex h-full flex-col gap-2 p-4">
          {/* RecipientField / SubjectField / MessageField / "Gönder" — Plan 03 */}
        </div>
      </ScreenContent>
    </Screen>
  );
});
