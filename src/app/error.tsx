"use client";

import { Button } from "@/components/ui/button";

export default function ErrorPage({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 px-4 text-center">
      <h1 className="text-2xl font-semibold">Что-то пошло не так</h1>
      <p className="text-sm text-muted-foreground">Обновите страницу или вернитесь позже.</p>
      <Button onClick={reset}>Попробовать снова</Button>
    </div>
  );
}
