import { redirect } from "next/navigation";
import { isAwaitingApproval } from "@/lib/approval";
import { createClient } from "@/lib/supabase/server";
import { isStaff } from "@/lib/status-machine";
import type { Profile } from "@/lib/types";

export async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) redirect("/login");
  if (profile.is_blocked) redirect("/blocked");
  if (isAwaitingApproval(profile, user.user_metadata as { is_approved?: boolean })) redirect("/pending");

  return { supabase, user, profile: profile as Profile };
}

export async function requireStaff() {
  const session = await requireUser();
  if (!isStaff(session.profile.role)) redirect("/objects");
  return session;
}

export async function requireAdmin() {
  const session = await requireUser();
  if (session.profile.role !== "admin") redirect("/objects");
  return session;
}
