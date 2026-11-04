"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { markNotificationsRead, NOTIFICATIONS_READ_EVENT } from "@/lib/mark-notifications-read";
import { notificationHref, notificationLinkLabel } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification } from "@/lib/types";
import { cn, formatDateTime } from "@/lib/utils";

export function NotificationBell() {
  const [items, setItems] = useState<AppNotification[]>([]);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function load() {
      const { data } = await supabase
        .from("notifications")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(20);
      if (mounted) setItems((data as AppNotification[]) ?? []);
    }

    void load();

    const onLive = (event: Event) => {
      const row = (event as CustomEvent<AppNotification>).detail;
      if (!row?.id) {
        void load();
        return;
      }
      setItems((current) => [row, ...current.filter((item) => item.id !== row.id)].slice(0, 20));
    };

    const onRead = (event: Event) => {
      const detail = (event as CustomEvent<{ ids: string[] | null; at: string }>).detail;
      setItems((current) =>
        current.map((item) =>
          !item.read_at && (detail.ids == null || detail.ids.includes(item.id))
            ? { ...item, read_at: detail.at }
            : item,
        ),
      );
    };

    window.addEventListener("crm:notification", onLive);
    window.addEventListener(NOTIFICATIONS_READ_EVENT, onRead);

    return () => {
      mounted = false;
      window.removeEventListener("crm:notification", onLive);
      window.removeEventListener(NOTIFICATIONS_READ_EVENT, onRead);
    };
  }, []);

  const unread = items.filter((item) => !item.read_at).length;

  async function markAllRead() {
    const at = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, read_at: item.read_at ?? at })));
    await markNotificationsRead(null);
  }

  async function openItem(item: AppNotification) {
    if (!item.read_at) {
      const at = new Date().toISOString();
      setItems((current) => current.map((row) => (row.id === item.id ? { ...row, read_at: at } : row)));
      await markNotificationsRead([item.id]);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {unread > 0 ? (
            <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] text-primary-foreground">
              {unread}
            </span>
          ) : null}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel className="flex items-center justify-between">
          Уведомления
          {unread > 0 ? (
            <button className="text-xs font-normal text-primary" onClick={() => void markAllRead()}>
              Прочитать все
            </button>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Пока тихо</p>
        ) : (
          items.slice(0, 8).map((item) => (
            <DropdownMenuItem
              key={item.id}
              asChild
              className="flex-col items-start gap-0.5 py-2"
              onSelect={() => void openItem(item)}
            >
              <Link href={notificationHref(item)}>
                <span className={cn("font-medium", item.read_at && "text-muted-foreground")}>{item.title}</span>
                <span className="line-clamp-2 text-xs text-muted-foreground">{item.body}</span>
                <span className="text-[11px] text-primary">{notificationLinkLabel(item)}</span>
                <span className="text-[11px] text-muted-foreground">{formatDateTime(item.created_at)}</span>
              </Link>
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
