import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { ObjectDeleteButton } from "@/components/objects/object-delete-button";
import { requireUser } from "@/lib/require-user";
import { isStaff } from "@/lib/status-machine";
import { formatDateTime } from "@/lib/utils";
import type { Profile, Task } from "@/lib/types";

export default async function ObjectCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();
  const staff = isStaff(profile.role);

  const { data: object } = await supabase.from("objects").select("*").eq("id", id).maybeSingle();
  if (!object) notFound();

  const { data: tasks } = await supabase
    .from("tasks")
    .select("*, assignee:profiles!assignee_id(id, full_name, email)")
    .eq("object_id", id)
    .order("created_at", { ascending: false });

  const rows = (tasks as Array<Task & { assignee: Pick<Profile, "id" | "full_name" | "email"> | null }> | null) ?? [];

  return (
    <>
      <PageHeader
        title={object.name}
        description={object.address}
        actions={
          staff ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/objects/${id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  Изменить
                </Link>
              </Button>
              <Button asChild>
                <Link href={`/tasks/new?objectId=${id}`}>
                  <Plus className="h-4 w-4" />
                  Задача
                </Link>
              </Button>
              <ObjectDeleteButton objectId={id} />
            </>
          ) : null
        }
      />

      {rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            Задач по объекту пока нет
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-card">
          <ul className="divide-y">
            {rows.map((task) => (
              <li key={task.id}>
                <Link href={`/tasks/${task.id}`} className="flex flex-col gap-2 px-4 py-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.assignee?.full_name || task.assignee?.email || "Исполнитель"}
                      {task.deadline ? ` · до ${formatDateTime(task.deadline)}` : ""}
                    </p>
                  </div>
                  <StatusBadge status={task.status} taskId={task.id} />
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}
