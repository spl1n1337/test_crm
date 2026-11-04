"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { io, type Socket } from "socket.io-client";
import { toast } from "sonner";
import { PresenceProvider } from "@/components/realtime/presence-context";
import { markNotificationsRead } from "@/lib/mark-notifications-read";
import { notificationHref, notificationLinkLabel } from "@/lib/notifications";
import { createClient } from "@/lib/supabase/client";
import type { AppNotification, Profile } from "@/lib/types";

type PresenceRow = { id: string };

function wsUrl() {
  return process.env.NEXT_PUBLIC_WS_URL || "http://localhost:3001";
}

export function RealtimeProvider({
  profile,
  children,
}: {
  profile: Profile;
  children?: React.ReactNode;
}) {
  const router = useRouter();
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());
  const value = useMemo(() => ({ onlineIds }), [onlineIds]);
  const seen = useRef(new Set<string>());

  useEffect(() => {
    let socket: Socket | null = null;
    let cancelled = false;
    let ping: number | undefined;
    let refreshTimer: number | undefined;

    function handleNotification(row: AppNotification) {
      if (!row?.id || seen.current.has(row.id)) return;
      seen.current.add(row.id);
      const href = notificationHref(row);
      toast(row.title, {
        description: row.body,
        action: {
          label: notificationLinkLabel(row),
          onClick: () => {
            void markNotificationsRead([row.id]);
            router.push(href);
          },
        },
      });
      window.dispatchEvent(new CustomEvent("crm:notification", { detail: row }));
    }

    async function connect() {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session?.access_token || cancelled) return;

      socket = io(wsUrl(), {
        auth: { token: session.access_token },
        transports: ["websocket", "polling"],
        reconnection: true,
      });

      socket.on("presence", (list: PresenceRow[]) => {
        setOnlineIds(new Set(list.map((row) => row.id)));
      });

      socket.on("notification", (row: AppNotification) => {
        handleNotification(row);
      });

      socket.on("task", (payload: { event?: string; task?: { id?: string; status?: string } }) => {
        if (!payload?.task?.id) return;
        window.dispatchEvent(new CustomEvent("crm:task", { detail: payload }));
        if (refreshTimer) window.clearTimeout(refreshTimer);
        refreshTimer = window.setTimeout(() => router.refresh(), 150);
      });

      ping = window.setInterval(() => socket?.emit("ping"), 25_000);
      socket.on("disconnect", () => {
        if (ping) window.clearInterval(ping);
      });
    }

    void connect();

    const { data: sub } = createClient().auth.onAuthStateChange((_event, session) => {
      if (session?.access_token && socket) {
        socket.auth = { token: session.access_token };
        socket.connect();
      }
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
      if (ping) window.clearInterval(ping);
      if (refreshTimer) window.clearTimeout(refreshTimer);
      socket?.disconnect();
    };
  }, [profile.id, router]);

  return <PresenceProvider onlineIds={value.onlineIds}>{children}</PresenceProvider>;
}
