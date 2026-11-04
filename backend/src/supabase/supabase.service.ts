import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

@Injectable()
export class SupabaseService {
  private readonly logger = new Logger(SupabaseService.name);
  private readonly adminClient: SupabaseClient | null;

  constructor(private readonly config: ConfigService) {
    const url =
      this.config.get<string>("SUPABASE_URL") || this.config.get<string>("NEXT_PUBLIC_SUPABASE_URL") || "";
    const serviceKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY") || "";

    if (!url || !serviceKey) {
      this.logger.warn("Supabase keys are missing. Fill .env to enable API, auth and seed.");
      this.adminClient = null;
      return;
    }

    this.adminClient = createClient(url, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }

  get configured() {
    return this.adminClient !== null;
  }

  get admin() {
    if (!this.adminClient) {
      throw new Error("Supabase не настроен. Заполните SUPABASE_URL и SUPABASE_SERVICE_ROLE_KEY в .env");
    }
    return this.adminClient;
  }

  asUser(accessToken: string) {
    const url =
      this.config.get<string>("SUPABASE_URL") || this.config.get<string>("NEXT_PUBLIC_SUPABASE_URL") || "";
    const anon =
      this.config.get<string>("SUPABASE_ANON_KEY") || this.config.get<string>("NEXT_PUBLIC_SUPABASE_ANON_KEY") || "";
    if (!url || !anon) {
      throw new Error("Supabase не настроен. Заполните ключи в .env");
    }
    return createClient(url, anon, {
      global: { headers: { Authorization: `Bearer ${accessToken}` } },
      auth: { autoRefreshToken: false, persistSession: false },
    });
  }
}
