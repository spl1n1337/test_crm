import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Providers } from "@/components/providers";
import { isAwaitingApproval } from "@/lib/approval";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (!profile) redirect("/login");
  if (profile.is_blocked) redirect("/blocked");
  if (isAwaitingApproval(profile, user.user_metadata as { is_approved?: boolean })) redirect("/pending");

  return (
    <Providers profile={profile as Profile}>
      <AppShell profile={profile as Profile}>{children}</AppShell>
    </Providers>
  );
}
