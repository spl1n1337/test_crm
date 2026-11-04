import Link from "next/link";
import { notFound } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { StatusActions } from "@/components/tasks/status-actions";
import { TaskAttachments } from "@/components/tasks/task-attachments";
import { TaskDeleteButton } from "@/components/tasks/task-delete-button";
import { TaskHistory } from "@/components/tasks/task-history";
import { requireUser } from "@/lib/require-user";
import { isStaff } from "@/lib/status-machine";
import { formatDateTime } from "@/lib/utils";
import type { ConstructionObject, Profile, Task, TaskAttachment, TaskStatusHistory } from "@/lib/types";

export default async function TaskCardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase, profile } = await requireUser();
  const staff = isStaff(profile.role);

  const { data: task } = await supabase
    .from("tasks")
    .select(
      "*, object:objects(id, name, address), assignee:profiles!assignee_id(id, full_name, email, avatar_url), author:profiles!author_id(id, full_name, email)",
    )
    .eq("id", id)
    .maybeSingle();

  if (!task) notFound();

  const [{ data: history }, { data: attachments }, { data: people }] = await Promise.all([
    supabase.from("task_status_history").select("*").eq("task_id", id).order("created_at", { ascending: true }),
    supabase.from("task_attachments").select("*").eq("task_id", id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("id, full_name, email"),
  ]);

  const row = task as Task & {
    object: Pick<ConstructionObject, "id" | "name" | "address"> | null;
    assignee: Pick<Profile, "id" | "full_name" | "email" | "avatar_url"> | null;
    author: Pick<Profile, "id" | "full_name" | "email"> | null;
  };

  return (
    <>
      <PageHeader
        title={row.title}
        description={row.object ? `${row.object.name} · ${row.object.address}` : "Задача"}
        actions={
          staff ? (
            <>
              <Button asChild variant="outline">
                <Link href={`/tasks/${id}/edit`}>
                  <Pencil className="h-4 w-4" />
                  Изменить
                </Link>
              </Button>
              <TaskDeleteButton taskId={id} objectId={row.object_id} />
            </>
          ) : null
        }
      />

      <div className="grid gap-4 lg:grid-cols-[1.4fr_0.8fr]">
        <div className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-base">Данные</CardTitle>
              <StatusBadge status={row.status} taskId={row.id} />
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <p className="whitespace-pre-wrap">{row.description || "Без описания"}</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <p>
                  <span className="text-muted-foreground">Исполнитель: </span>
                  {row.assignee?.full_name || row.assignee?.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Автор: </span>
                  {row.author?.full_name || row.author?.email}
                </p>
                <p>
                  <span className="text-muted-foreground">Создана: </span>
                  {formatDateTime(row.created_at)}
                </p>
                <p>
                  <span className="text-muted-foreground">Дедлайн: </span>
                  {formatDateTime(row.deadline)}
                </p>
              </div>
              {row.object ? (
                <Button asChild variant="link" className="h-auto px-0">
                  <Link href={`/objects/${row.object.id}`}>Открыть объект</Link>
                </Button>
              ) : null}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Действия</CardTitle>
            </CardHeader>
            <CardContent>
              <StatusActions task={row} profile={profile} />
            </CardContent>
          </Card>

          <TaskAttachments
            taskId={row.id}
            attachments={(attachments as TaskAttachment[]) ?? []}
            canUpload={staff || (profile.id === row.assignee_id && ["new", "in_progress", "rework"].includes(row.status))}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">История статусов</CardTitle>
          </CardHeader>
          <CardContent>
            <TaskHistory
              history={(history as TaskStatusHistory[]) ?? []}
              people={(people as Pick<Profile, "id" | "full_name" | "email">[]) ?? []}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
