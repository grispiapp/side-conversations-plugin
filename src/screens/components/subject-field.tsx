import { observer } from "mobx-react-lite";

import { Input } from "@/components/ui/input";
import { useStore } from "@/contexts/store-context";

/**
 * Subject field (COMP-03). ComposeScreen initializes the full value once.
 * The parent ticket key remains part of the submitted subject but is rendered
 * as an immutable visual prefix, separate from the editable subject text.
 */
function splitSubjectPrefix(subject: string): {
  prefix: string;
  editableValue: string;
} {
  const match = subject.match(/^(\[[^\]\r\n]+\])(?:\s+(.*))?$/s);
  if (!match) return { prefix: "", editableValue: subject };
  return {
    prefix: match[1],
    editableValue: match[2] ?? "",
  };
}

export const SubjectField = observer(() => {
  const compose = useStore().compose;
  const { prefix, editableValue } = splitSubjectPrefix(compose.subject);
  const isEmpty = editableValue.trim() === "";
  const describedBy = [
    prefix ? "compose-subject-prefix" : "",
    isEmpty ? "compose-subject-help" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex min-w-0 items-stretch border-b border-border bg-card">
      <label htmlFor="compose-subject" className="sr-only">
        Konu
      </label>
      {prefix && (
        <span
          id="compose-subject-prefix"
          aria-label={`Konu ön eki ${prefix}, değiştirilemez`}
          className="flex h-12 shrink-0 items-center border-r border-border bg-muted/30 px-4 text-sm font-medium text-muted-foreground"
        >
          {prefix}
        </span>
      )}
      <Input
        id="compose-subject"
        value={editableValue}
        onChange={(event) =>
          compose.setSubject(
            prefix
              ? `${prefix}${event.target.value ? ` ${event.target.value}` : ""}`
              : event.target.value
          )
        }
        className="h-12 min-w-0 flex-1 rounded-none border-0 bg-transparent px-4 shadow-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
        placeholder="Konu"
        autoComplete="off"
        aria-describedby={describedBy || undefined}
      />
      {isEmpty && (
        <span id="compose-subject-help" className="sr-only">
          Konu metni boş; yalnızca ana talep ön eki gönderilecek.
        </span>
      )}
    </div>
  );
});
