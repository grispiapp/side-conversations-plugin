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
    <div className="flex min-w-0 flex-col gap-1.5">
      <label
        htmlFor="compose-subject"
        className="text-xs font-semibold text-foreground"
      >
        Konu
      </label>
      <Input
        id="compose-subject"
        value={compose.subject}
        onChange={(event) => compose.setSubject(event.target.value)}
        className="h-11"
        placeholder="Konu"
        aria-describedby={isEmpty ? "compose-subject-help" : undefined}
      />
      {isEmpty && (
        <span
          id="compose-subject-help"
          className="text-xs text-muted-foreground"
        >
          Konu boş — e-posta konusuz gönderilecek.
        </span>
      )}
    </div>
  );
});
