"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StatusBadge } from "@/components/status-badge";
import { usePresence } from "@/components/realtime/presence-context";
import { ROLE_LABELS } from "@/lib/status-machine";
import { createClient } from "@/lib/supabase/client";
import { formatDateTime, getInitials } from "@/lib/utils";
import type { Profile, TaskStatus, UserRole } from "@/lib/types";

type TaskRow = {
  id: string;
  title: string;
  status: TaskStatus;
  updated_at: string;
  assignee_id: string;
  object: { name: string } | null;
};

export function AdminPanel({
  me,
  staff,
  tasks,
}: {
  me: Profile;
  staff: Profile[];
  tasks: TaskRow[];
}) {
  const router = useRouter();
  const { onlineIds } = usePresence();
  const [filter, setFilter] = useState<"accepted" | "all">("accepted");
  const [liveTasks, setLiveTasks] = useState(tasks);
  const [approvals, setApprovals] = useState<
    Map<string, { is_approved: boolean; requested_role: UserRole }>
  >(new Map());
  const names = useMemo(
    () => new Map(staff.map((person) => [person.id, person.full_name || person.email])),
    [staff],
  );

  useEffect(() => {
    setLiveTasks(tasks);
  }, [tasks]);

  useEffect(() => {
    function onTask(event: Event) {
      const row = (event as CustomEvent<{ task?: Partial<TaskRow> }>).detail?.task;
      const id = row?.id;
      const status = row?.status;
      if (!id || !status) return;
      const title = row.title;
      const updatedAt = row.updated_at ?? new Date().toISOString();
      const assigneeId = row.assignee_id ?? "";
      const object = row.object ?? null;
      setLiveTasks((current) => {
        const exists = current.some((task) => task.id === id);
        if (!exists) {
          return [
            {
              id,
              title: title ?? "Задача",
              status,
              updated_at: updatedAt,
              assignee_id: assigneeId,
              object,
            },
            ...current,
          ];
        }
        return current.map((task) =>
          task.id === id
            ? {
                ...task,
                status,
                title: title ?? task.title,
                updated_at: updatedAt,
              }
            : task,
        );
      });
    }
    window.addEventListener("crm:task", onTask);
    return () => window.removeEventListener("crm:task", onTask);
  }, []);

  useEffect(() => {
    void (async () => {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (!session?.access_token) return;
      const response = await fetch("/api/admin/staff", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (!response.ok) return;
      const rows = (await response.json()) as Array<{
        id: string;
        is_approved: boolean;
        requested_role: UserRole;
      }>;
      setApprovals(new Map(rows.map((row) => [row.id, row])));
    })();
  }, []);

  const mergedStaff = staff.map((person) => {
    const extra = approvals.get(person.id);
    return {
      ...person,
      is_approved: person.is_approved === false || extra?.is_approved === false ? false : person.is_approved ?? extra?.is_approved ?? true,
      requested_role: person.requested_role ?? extra?.requested_role ?? person.role,
    };
  });

  const visibleTasks = liveTasks.filter((task) => (filter === "all" ? true : task.status === "accepted"));
  const pending = mergedStaff.filter((person) => person.is_approved === false && !person.is_blocked);
  const others = mergedStaff.filter((person) => person.is_approved !== false);

  async function setBlocked(userId: string, blocked: boolean) {
    const { error } = await createClient().rpc("admin_set_blocked", {
      p_user_id: userId,
      p_blocked: blocked,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success(blocked ? "Доступ закрыт" : "Доступ открыт");
    if (blocked) {
      const {
        data: { session },
      } = await createClient().auth.getSession();
      if (session?.access_token) {
        await fetch(`/api/admin/staff/${userId}/kick`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
      }
    }
    router.refresh();
  }

  async function setRole(userId: string, role: UserRole, approved = false) {
    const rpc = await createClient().rpc("admin_set_role", {
      p_user_id: userId,
      p_role: role,
    });
    const {
      data: { session },
    } = await createClient().auth.getSession();
    if (session?.access_token) {
      const response = await fetch(`/api/admin/staff/${userId}/approve`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ role }),
      });
      if (!response.ok) {
        toast.error(rpc.error?.message ?? "Не удалось подтвердить сотрудника");
        return;
      }
    } else if (rpc.error) {
      toast.error(rpc.error.message);
      return;
    }
    setApprovals((current) => {
      const next = new Map(current);
      next.set(userId, { is_approved: true, requested_role: role });
      return next;
    });
    toast.success(approved ? "Доступ открыт" : "Роль обновлена");
    router.refresh();
  }

  function staffCard(person: Profile, awaiting: boolean) {
    const online = onlineIds.has(person.id);
    const selectRole = awaiting ? person.requested_role : person.role;
    return (
      <Card key={person.id}>
        <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <Avatar>
                <AvatarImage src={person.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{getInitials(person.full_name, person.email)}</AvatarFallback>
              </Avatar>
              <span
                className={`absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-card ${online ? "bg-emerald-500" : "bg-zinc-400"}`}
              />
            </div>
            <div>
              <p className="font-medium">{person.full_name || person.email}</p>
              <p className="text-sm text-muted-foreground">
                {person.email} · {online ? "онлайн" : "офлайн"}
                {awaiting
                  ? ` · запросил «${ROLE_LABELS[person.requested_role]}»`
                  : ` · ${ROLE_LABELS[person.role]}`}
                {person.is_blocked ? " · заблокирован" : ""}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {person.id === me.id ? (
              <span className="text-xs text-muted-foreground">это вы</span>
            ) : (
              <>
                {awaiting ? (
                  <Button onClick={() => void setRole(person.id, person.requested_role, true)}>
                    Подтвердить «{ROLE_LABELS[person.requested_role]}»
                  </Button>
                ) : null}
                <select
                  className="h-10 rounded-md border border-input bg-background px-2 text-sm"
                  value={selectRole}
                  onChange={(event) => void setRole(person.id, event.target.value as UserRole, awaiting)}
                >
                  <option value="admin">Администратор</option>
                  <option value="assigner">Постановщик</option>
                  <option value="executor">Исполнитель</option>
                </select>
                <Button
                  variant={person.is_blocked ? "default" : "destructive"}
                  onClick={() => void setBlocked(person.id, !person.is_blocked)}
                >
                  {person.is_blocked ? "Разблокировать" : "Заблокировать"}
                </Button>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Tabs defaultValue="staff">
      <TabsList className="mb-4">
        <TabsTrigger value="staff">Сотрудники{pending.length ? ` (${pending.length})` : ""}</TabsTrigger>
        <TabsTrigger value="tasks">Задачи</TabsTrigger>
      </TabsList>
      <TabsContent value="staff" className="space-y-6">
        {pending.length > 0 ? (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold">Ожидают подтверждения</h2>
            {pending.map((person) => staffCard(person, true))}
          </section>
        ) : null}
        <section className="space-y-3">
          {pending.length > 0 ? <h2 className="text-sm font-semibold">Все сотрудники</h2> : null}
          {others.map((person) => staffCard(person, false))}
        </section>
      </TabsContent>
      <TabsContent value="tasks">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">
              {filter === "accepted" ? "Выполненные задачи" : "Все задачи"}
            </CardTitle>
            <Button variant="outline" size="sm" onClick={() => setFilter(filter === "accepted" ? "all" : "accepted")}>
              {filter === "accepted" ? "Показать все" : "Только принятые"}
            </Button>
          </CardHeader>
          <CardContent className="space-y-3">
            {visibleTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">Пока пусто</p>
            ) : (
              visibleTasks.map((task) => (
                <Link key={task.id} href={`/tasks/${task.id}`} className="flex flex-col gap-1 rounded-lg border p-3 hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium">{task.title}</p>
                    <p className="text-sm text-muted-foreground">
                      {task.object?.name} · {names.get(task.assignee_id) ?? "Исполнитель"} · {formatDateTime(task.updated_at)}
                    </p>
                  </div>
                  <StatusBadge status={task.status} taskId={task.id} />
                </Link>
              ))
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
