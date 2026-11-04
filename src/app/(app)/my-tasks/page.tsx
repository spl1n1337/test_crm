import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/require-user";
import { formatDateTime } from "@/lib/utils";
import type { ConstructionObject, Task } from "@/lib/types";

export default async function MyTasksPage() {
  const { supabase, profile } = await requireUser();
  const { data } = await supabase
    .from("tasks")
    .select("*, object:objects(id, name)")
    .eq("assignee_id", profile.id)
    .order("created_at", { ascending: false });

  const tasks = (data as Array<Task & { object: Pick<ConstructionObject, "id" | "name"> | null }> | null) ?? [];

  return (
    <>
      <PageHeader title="Мои задачи" description="Только то, что назначено вам" />
      {tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Назначенных задач нет
          </CardContent>
        </Card>
      ) : (
        <ul className="space-y-3">
          {tasks.map((task) => (
            <li key={task.id}>
              <Link href={`/tasks/${task.id}`}>
                <Card className="transition hover:border-primary/40">
                  <CardContent className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="font-medium">{task.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {task.object?.name}
                        {task.deadline ? ` · до ${formatDateTime(task.deadline)}` : ""}
                      </p>
                    </div>
                    <StatusBadge status={task.status} taskId={task.id} />
                  </CardContent>
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
