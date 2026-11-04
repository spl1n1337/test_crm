import { createClient } from "@/lib/supabase/client";

export const NOTIFICATIONS_READ_EVENT = "crm:notifications-read";

export async function markNotificationsRead(ids?: string[] | null) {
  const supabase = createClient();
  const at = new Date().toISOString();
  const { error } = await supabase.rpc("mark_notifications_read", { p_ids: ids ?? null });
  if (error) {
    let query = supabase.from("notifications").update({ read_at: at }).is("read_at", null);
    if (ids?.length) query = query.in("id", ids);
    await query;
  }
  window.dispatchEvent(new CustomEvent(NOTIFICATIONS_READ_EVENT, { detail: { ids: ids ?? null, at } }));
}
