import { observer } from "mobx-react-lite";

import {
  Screen,
  ScreenContent,
  ScreenHeader,
  ScreenTitle,
} from "@/components/ui/screen";
import { useStore } from "@/contexts/store-context";

import { MessageBubble } from "./components/message-bubble";

/**
 * Gerçek minimal chat kabuğu (COMP-04, D-14). Başlık `ActiveConversationStore`
 * içindeki `recipientLabel`/`subject`'ten okunur — sunucudan yeniden fetch
 * YOK (Pitfall #6): bunlar compose'daki client-side echo, `ConversationRow`
 * ile aynı `·` meta-separatör konvansiyonuyla `line-clamp-1` truncated.
 * Balon listesi generic bir dikey liste — "tam bir çocuk" hardcode değil,
 * Faz 3'ün gelen mesajları buraya ekleyeceği seam korunuyor.
 */
export const ChatScreen = observer(() => {
  const activeConversation = useStore().activeConversation;
  const panelNav = useStore().panelNavigation;

  return (
    <Screen>
      <ScreenHeader
        onBack={() => panelNav.confirmDiscardAndReturnToList()}
      >
        <ScreenTitle className="line-clamp-1">
          {activeConversation.recipientLabel} · {activeConversation.subject}
        </ScreenTitle>
      </ScreenHeader>
      <ScreenContent className="pt-6">
        <div className="flex flex-col gap-2 px-4">
          {activeConversation.messages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              onRetry={(id) => activeConversation.retry(id)}
            />
          ))}
        </div>
      </ScreenContent>
    </Screen>
  );
});
