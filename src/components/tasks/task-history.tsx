import { formatDateTime } from "@/lib/utils";
import { STATUS_LABELS } from "@/lib/status-machine";
import type { Profile, TaskStatusHistory } from "@/lib/types";

export function TaskHistory({
  history,
  people,
}: {
  history: TaskStatusHistory[];
  people: Pick<Profile, "id" | "full_name" | "email">[];
}) {
  const names = new Map(people.map((person) => [person.id, person.full_name || person.email]));

  if (history.length === 0) {
    return <p className="text-sm text-muted-foreground">История пока пустая</p>;
  }

  return (
    <ol className="space-y-3">
      {history.map((item) => (
        <li key={item.id} className="relative border-l-2 border-border pl-4">
          <p className="text-sm font-medium">
            {item.from_status ? STATUS_LABELS[item.from_status] : "—"} → {STATUS_LABELS[item.to_status]}
          </p>
          <p className="text-xs text-muted-foreground">
            {names.get(item.changed_by) ?? "Сотрудник"} · {formatDateTime(item.created_at)}
          </p>
          {item.comment ? <p className="mt-1 text-sm">{item.comment}</p> : null}
        </li>
      ))}
    </ol>
  );
}
