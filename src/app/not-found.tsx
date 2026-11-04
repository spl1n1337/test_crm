import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Страница не найдена</h1>
      <Button asChild>
        <Link href="/objects">К объектам</Link>
      </Button>
    </div>
  );
}
