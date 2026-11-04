import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/page-header";
import { StatusBadge } from "@/components/status-badge";
import { requireUser } from "@/lib/require-user";
import { isStaff } from "@/lib/status-machine";
import type { Task, TaskStatus } from "@/lib/types";

type ObjectRow = {
  id: string;
  name: string;
  address: string;
  tasks: Pick<Task, "id" | "status" | "title">[] | null;
};

export default async function ObjectsPage() {
  const { supabase, profile } = await requireUser();
  const { data } = await supabase
    .from("objects")
    .select("id, name, address, tasks(id, status, title)")
    .order("created_at", { ascending: false });

  const objects = (data as ObjectRow[] | null) ?? [];
  const staff = isStaff(profile.role);

  return (
    <>
      <PageHeader
        title="Объекты"
        description={
          staff
            ? "Все стройки и задачи по ним"
            : "Стройки, где вам назначены задачи"
        }
        actions={
          staff ? (
            <Button asChild>
              <Link href="/objects/new">
                <Plus className="h-4 w-4" />
                Новый объект
              </Link>
            </Button>
          ) : null
        }
      />

      {objects.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            {staff ? "Объектов пока нет — создайте первый." : "У вас пока нет задач на объектах."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {objects.map((object) => {
            const tasks = object.tasks ?? [];
            const counts = tasks.reduce<Record<string, number>>((acc, task) => {
              acc[task.status] = (acc[task.status] ?? 0) + 1;
              return acc;
            }, {});
            return (
              <Link key={object.id} href={`/objects/${object.id}`}>
                <Card className="h-full transition hover:border-primary/40">
                  <CardHeader>
                    <CardTitle className="text-lg">{object.name}</CardTitle>
                    <p className="text-sm text-muted-foreground">{object.address}</p>
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    <span className="text-sm text-muted-foreground">{tasks.length} задач</span>
                    {(Object.keys(counts) as TaskStatus[]).map((status) => (
                      <StatusBadge key={status} status={status} />
                    ))}
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
