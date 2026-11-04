"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Building2,
  ClipboardList,
  HardHat,
  LogOut,
  Shield,
  UserRound,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/layout/notification-bell";
import { ROLE_LABELS } from "@/lib/status-machine";
import { createClient } from "@/lib/supabase/client";
import { cn, getInitials } from "@/lib/utils";
import type { Profile } from "@/lib/types";

function navItems(role: Profile["role"]) {
  const items = [
    { href: "/objects", label: "Объекты", icon: Building2 },
    { href: "/my-tasks", label: "Мои задачи", icon: ClipboardList },
    { href: "/profile", label: "Профиль", icon: UserRound },
  ];
  if (role === "admin") {
    items.splice(2, 0, { href: "/admin", label: "Админка", icon: Shield });
  }
  return items;
}

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const items = navItems(profile.role);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[240px_1fr]">
      <aside className="hidden border-r bg-card md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <HardHat className="h-4 w-4" />
          </div>
          <div>
            <p className="font-semibold leading-none">СтройCRM</p>
            <p className="mt-1 text-xs text-muted-foreground">{ROLE_LABELS[profile.role]}</p>
          </div>
        </div>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium",
                  active ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t p-4">
          <Button variant="ghost" className="w-full justify-start gap-2" onClick={() => void signOut()}>
            <LogOut className="h-4 w-4" />
            Выйти
          </Button>
        </div>
      </aside>

      <div className="flex min-h-dvh flex-col pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b bg-background/90 px-4 py-3 backdrop-blur">
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">{profile.full_name || profile.email}</p>
            <p className="text-xs text-muted-foreground md:hidden">{ROLE_LABELS[profile.role]}</p>
          </div>
          <div className="flex items-center gap-2">
            <NotificationBell />
            <Link href="/profile">
              <Avatar className="h-9 w-9 border">
                <AvatarImage src={profile.avatar_url ?? undefined} alt="" />
                <AvatarFallback>{getInitials(profile.full_name, profile.email)}</AvatarFallback>
              </Avatar>
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-5">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur md:hidden">
        <ul className={cn("grid", items.length > 3 ? "grid-cols-4" : "grid-cols-3")}>
          {items.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-2 py-2.5 text-[11px]",
                    active ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
