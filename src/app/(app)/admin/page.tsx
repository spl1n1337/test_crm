import { PageHeader } from "@/components/layout/page-header";
import { AdminPanel } from "@/components/admin/admin-panel";
import { requireAdmin } from "@/lib/require-user";
import type { Profile, Task, TaskStatus } from "@/lib/types";

export default async function AdminPage() {
  const { supabase, profile } = await requireAdmin();

  const [{ data: staff }, { data: tasks }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at"),
    supabase
      .from("tasks")
      .select("id, title, status, updated_at, assignee_id, object:objects(name)")
      .order("updated_at", { ascending: false }),
  ]);

  return (
    <>
      <PageHeader
        title="Админка"
        description="Подтверждение регистраций, роли (включая администратора), онлайн и блокировка"
      />
      <AdminPanel
        me={profile}
        staff={(staff as Profile[]) ?? []}
        tasks={
          ((tasks as Array<
            Pick<Task, "id" | "title" | "status" | "updated_at" | "assignee_id"> & {
              object: { name: string } | null;
            }
          > | null) ?? []) as Array<{
            id: string;
            title: string;
            status: TaskStatus;
            updated_at: string;
            assignee_id: string;
            object: { name: string } | null;
          }>
        }
      />
    </>
  );
}
