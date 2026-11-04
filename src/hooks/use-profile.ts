"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Profile } from "@/lib/types";

export function useProfile() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    let mounted = true;

    async function load() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (mounted) {
          setProfile(null);
          setLoading(false);
        }
        return;
      }
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).single();
      if (mounted) {
        setProfile((data as Profile) ?? null);
        setLoading(false);
      }
    }

    void load();
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      void load();
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { profile, loading };
}
