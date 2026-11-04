import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { SupabaseService } from "../supabase/supabase.service";
import { RealtimeGateway } from "./realtime.gateway";

@Injectable()
export class RealtimeBridgeService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RealtimeBridgeService.name);
  private channel: RealtimeChannel | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private stopped = false;

  constructor(
    private readonly supabase: SupabaseService,
    private readonly gateway: RealtimeGateway,
  ) {}

  async onModuleInit() {
    if (!this.supabase.configured) {
      this.logger.warn("Skipping notification bridge: Supabase is not configured");
      return;
    }
    await this.subscribe();
  }

  async onModuleDestroy() {
    this.stopped = true;
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    if (this.channel && this.supabase.configured) {
      await this.supabase.admin.removeChannel(this.channel);
      this.channel = null;
    }
  }

  private scheduleReconnect() {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.subscribe();
    }, 3000);
  }

  private async subscribe() {
    if (this.stopped) return;
    if (this.channel) {
      await this.supabase.admin.removeChannel(this.channel);
      this.channel = null;
    }

    this.channel = this.supabase.admin
      .channel(`nest-realtime-bridge-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "notifications" },
        (payload) => {
          const row = payload.new as { user_id?: string };
          if (row?.user_id) {
            this.gateway.emitNotification(row.user_id, payload.new);
          }
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "tasks" },
        (payload) => {
          const next = payload.new as { status?: string } | undefined;
          const prev = payload.old as { status?: string } | undefined;
          if (payload.eventType === "UPDATE" && next?.status === prev?.status) {
            return;
          }
          this.gateway.emitTask({
            event: payload.eventType,
            task: payload.new ?? payload.old,
          });
        },
      );

    await this.channel.subscribe((status) => {
      this.logger.log(`realtime bridge: ${status}`);
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED") {
        this.scheduleReconnect();
      }
    });
  }
}
