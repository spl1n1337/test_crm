import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { TaskForm } from "@/components/tasks/task-form";
import { requireStaff } from "@/lib/require-user";
import type { ConstructionObject, Profile, Task } from "@/lib/types";

export default async function EditTaskPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await requireStaff();

  const [{ data: task }, { data: objects }, { data: executors }] = await Promise.all([
    supabase.from("tasks").select("*").eq("id", id).maybeSingle(),
    supabase.from("objects").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "executor").eq("is_blocked", false).order("full_name"),
  ]);

  if (!task) notFound();

  return (
    <>
      <PageHeader title="Редактирование задачи" />
      <TaskForm
        task={task as Task}
        objects={(objects as Pick<ConstructionObject, "id" | "name">[]) ?? []}
        executors={(executors as Pick<Profile, "id" | "full_name" | "email">[]) ?? []}
      />
    </>
  );
}
