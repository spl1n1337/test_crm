"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

function ConfirmInner() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [state, setState] = useState<"loading" | "ok" | "error">("loading");
  const [message, setMessage] = useState("Подтверждаем почту…");

  useEffect(() => {
    if (!token) {
      setState("error");
      setMessage("В ссылке нет токена подтверждения.");
      return;
    }
    void fetch("/api/auth/confirm", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    })
      .then(async (response) => {
        const payload = (await response.json()) as { error?: string };
        if (!response.ok) {
          setState("error");
          setMessage(payload.error ?? "Не удалось подтвердить почту");
          return;
        }
        setState("ok");
        setMessage("Почта подтверждена. Войдите — доступ откроет администратор.");
      })
      .catch(() => {
        setState("error");
        setMessage("Сеть недоступна. Попробуйте ещё раз.");
      });
  }, [token]);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Подтверждение почты</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">{message}</p>
        {state !== "loading" ? (
          <Button asChild className="w-full">
            <Link href="/login">Перейти ко входу</Link>
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function ConfirmPage() {
  return (
    <Suspense>
      <ConfirmInner />
    </Suspense>
  );
}
