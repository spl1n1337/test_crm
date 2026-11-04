"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABELS } from "@/lib/status-machine";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export default function PendingPage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) {
        router.replace("/login");
        return;
      }
      const { data: row } = await supabase.from("profiles").select("*").eq("id", data.user.id).maybeSingle();
      const meta = data.user.user_metadata as { is_approved?: boolean; requested_role?: Profile["requested_role"] };
      if (row) {
        setProfile({
          ...(row as Profile),
          requested_role: meta.requested_role ?? (row as Profile).requested_role,
          is_approved: meta.is_approved ?? (row as Profile).is_approved,
        });
      }
      if (meta.is_approved !== false && (row as Profile | null)?.is_approved !== false) {
        router.replace("/objects");
      }
    });
  }, [router]);

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ожидание подтверждения</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4 text-sm">
        <p>
          Почта подтверждена. Администратор ещё не открыл доступ
          {profile?.requested_role ? ` с ролью «${ROLE_LABELS[profile.requested_role]}»` : ""}.
        </p>
        <p className="text-muted-foreground">Когда роль подтвердят, обновите страницу или войдите снова.</p>
        <Button className="w-full" variant="outline" onClick={() => void signOut()}>
          Выйти
        </Button>
      </CardContent>
    </Card>
  );
}
