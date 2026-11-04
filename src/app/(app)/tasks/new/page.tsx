import { PageHeader } from "@/components/layout/page-header";
import { TaskForm } from "@/components/tasks/task-form";
import { requireStaff } from "@/lib/require-user";
import type { ConstructionObject, Profile } from "@/lib/types";

export default async function NewTaskPage({
  searchParams,
}: {
  searchParams: Promise<{ objectId?: string }>;
}) {
  const { objectId } = await searchParams;
  const { supabase } = await requireStaff();

  const [{ data: objects }, { data: executors }] = await Promise.all([
    supabase.from("objects").select("id, name").order("name"),
    supabase.from("profiles").select("id, full_name, email").eq("role", "executor").eq("is_blocked", false).order("full_name"),
  ]);

  return (
    <>
      <PageHeader title="Новая задача" description="Назначьте исполнителя и при необходимости срок" />
      <TaskForm
        objects={(objects as Pick<ConstructionObject, "id" | "name">[]) ?? []}
        executors={(executors as Pick<Profile, "id" | "full_name" | "email">[]) ?? []}
        defaultObjectId={objectId}
      />
    </>
  );
}
