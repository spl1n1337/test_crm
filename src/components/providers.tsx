"use client";

import { Toaster } from "@/components/ui/sonner";
import { RealtimeProvider } from "@/components/realtime/realtime-provider";
import type { Profile } from "@/lib/types";

export function Providers({
  children,
  profile,
}: {
  children: React.ReactNode;
  profile: Profile | null;
}) {
  if (!profile) {
    return (
      <>
        {children}
        <Toaster position="top-right" richColors closeButton />
      </>
    );
  }

  return (
    <RealtimeProvider profile={profile}>
      {children}
      <Toaster position="top-right" richColors closeButton />
    </RealtimeProvider>
  );
}
