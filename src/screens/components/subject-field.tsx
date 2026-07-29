import { observer } from "mobx-react-lite";

import { Input } from "@/components/ui/input";
import { useStore } from "@/contexts/store-context";

/**
 * Konu alanı (COMP-03). Prefill'in kendisi (D-08/D-09) `ComposeScreen`
 * mount effect'inde `compose.initSubject(...)` ile yapılır — bu bileşen
 * yalnızca gösterir/serbestçe düzenlenmesine izin verir (`compose.setSubject`,
 * her zaman üzerine yazar). Boş bırakılırsa Gönder'i ENGELLEMEYEN
 * (non-blocking, D-10) uyarı metni altında gösterilir.
 */
export const SubjectField = observer(() => {
  const compose = useStore().compose;
  const isEmpty = compose.subject.trim() === "";

  return (
    <div className="flex min-w-0 flex-col border-b border-border bg-card">
      <label htmlFor="compose-subject" className="sr-only">
        Konu
      </label>
      <Input
        id="compose-subject"
        value={compose.subject}
        onChange={(event) => compose.setSubject(event.target.value)}
        className="h-12 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        placeholder="Konu"
        aria-describedby={isEmpty ? "compose-subject-help" : undefined}
      />
      {isEmpty && (
        <span id="compose-subject-help" className="sr-only">
          Konu boş — e-posta konusuz gönderilecek.
        </span>
      )}
    </div>
  );
});
