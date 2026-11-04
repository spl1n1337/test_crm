"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function BlockedPage() {
  const router = useRouter();

  async function signOut() {
    await createClient().auth.signOut();
    router.replace("/login");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Доступ заблокирован</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Администратор закрыл вам вход в приложение. Если это ошибка — напишите руководителю.
        </p>
        <Button className="w-full" variant="outline" onClick={() => void signOut()}>
          Выйти
        </Button>
      </CardContent>
    </Card>
  );
}
