import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { SupabaseService } from "../supabase/supabase.service";

@Injectable()
export class DeadlinesService {
  private readonly logger = new Logger(DeadlinesService.name);

  constructor(private readonly supabase: SupabaseService) {}

  @Cron("* * * * *")
  async tick() {
    if (!this.supabase.configured) return;
    await this.dispatch();
  }

  async dispatch() {
    const { data, error } = await this.supabase.admin.rpc("dispatch_deadline_notifications");
    if (error) {
      this.logger.error(error.message);
      throw error;
    }
    return { ok: true, dispatched: data ?? 0 };
  }
}
