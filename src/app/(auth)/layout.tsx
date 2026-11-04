import { Toaster } from "@/components/ui/sonner";
import { HardHat } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-[radial-gradient(circle_at_top,_#f6e7d0,_#f6f3ee_46%)]">
      <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-4 py-10">
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HardHat className="h-5 w-5" />
          </div>
          <div>
            <p className="text-lg font-semibold">СтройCRM</p>
            <p className="text-sm text-muted-foreground">Объекты и задачи</p>
          </div>
        </div>
        {children}
      </div>
      <Toaster position="top-center" richColors />
    </div>
  );
}
