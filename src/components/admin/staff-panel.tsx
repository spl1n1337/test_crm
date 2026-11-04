"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PRESENCE_CHANNEL } from "@/lib/constants";
import { ROLE_LABELS } from "@/lib/status-machine";
import { createClient } from "@/lib/supabase/client";
import { getInitials } from "@/lib/utils";
import type { PresenceMeta, Profile, UserRole } from "@/lib/types";

export function StaffPanel({ staff, me }: { staff: Profile[]; me: Profile }) {
  const [rows, setRows] = useState(staff);
  const [online, setOnline] = useState<Record<string, PresenceMeta>>({});

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase.channel(PRESENCE_CHANNEL);

    const sync = () => {
      const state = channel.presenceState<PresenceMeta>();
      const next: Record<string, PresenceMeta> = {};
      for (const [key, list] of Object.entries(state)) {
        const meta = list[0];
        if (meta) next[meta.id ?? key] = meta;
      }
      setOnline(next);
    };

    channel.on("presence", { event: "sync" }, sync);
    void channel.subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const onlineCount = useMemo(() => Object.keys(online).length, [online]);

  async function setBlocked(userId: string, blocked: boolean) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_set_blocked", {
      p_user_id: userId,
      p_blocked: blocked,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated = (Array.isArray(data) ? data[0] : data) as Profile | undefined;
    if (updated) {
      setRows((current) => current.map((row) => (row.id === userId ? { ...row, ...updated } : row)));
    }
    toast.success(blocked ? "Доступ закрыт" : "Доступ открыт");
  }

  async function setRole(userId: string, role: UserRole) {
    const supabase = createClient();
    const { data, error } = await supabase.rpc("admin_set_role", {
      p_user_id: userId,
      p_role: role,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const updated = (Array.isArray(data) ? data[0] : data) as Profile | undefined;
    if (updated) {
      setRows((current) => current.map((row) => (row.id === userId ? { ...row, ...updated } : row)));
    }
    toast.success("Роль обновлена");
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-muted-foreground">Сейчас в сети: {onlineCount}</p>
      <div className="overflow-hidden rounded-xl border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Сотрудник</TableHead>
              <TableHead>Роль</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead className="text-right">Действия</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.map((person) => {
              const isOnline = Boolean(online[person.id]);
              return (
                <TableRow key={person.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs">
                        {getInitials(person.full_name, person.email)}
                      </span>
                      <div>
                        <p className="font-medium">{person.full_name || "Без имени"}</p>
                        <p className="text-xs text-muted-foreground">{person.email}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    {person.id === me.id ? (
                      ROLE_LABELS[person.role]
                    ) : (
                      <select
                        className="h-9 rounded-md border bg-background px-2 text-sm"
                        value={person.role}
                        onChange={(event) => void setRole(person.id, event.target.value as UserRole)}
                      >
                        <option value="executor">Исполнитель</option>
                        <option value="assigner">Постановщик</option>
                        <option value="admin">Администратор</option>
                      </select>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-2">
                      <Badge variant={isOnline ? "default" : "secondary"}>{isOnline ? "Онлайн" : "Офлайн"}</Badge>
                      {person.is_blocked ? <Badge variant="destructive">Блок</Badge> : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {person.id === me.id ? (
                      <span className="text-xs text-muted-foreground">это вы</span>
                    ) : (
                      <Button
                        size="sm"
                        variant={person.is_blocked ? "outline" : "destructive"}
                        onClick={() => void setBlocked(person.id, !person.is_blocked)}
                      >
                        {person.is_blocked ? "Разблокировать" : "Заблокировать"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
