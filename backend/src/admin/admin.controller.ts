import { Body, Controller, ForbiddenException, Get, Param, Post, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { CurrentUser } from "../auth/current-user.decorator";
import { USER_ROLES, type Profile, type UserRole } from "../common/types";
import { PresenceService } from "../realtime/presence.service";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { SupabaseService } from "../supabase/supabase.service";

@Controller("admin")
@UseGuards(AuthGuard)
export class AdminController {
  constructor(
    private readonly presence: PresenceService,
    private readonly gateway: RealtimeGateway,
    private readonly supabase: SupabaseService,
  ) {}

  @Get("online")
  online(@CurrentUser() profile: Profile) {
    this.ensureAdmin(profile);
    return this.presence.list();
  }

  @Get("staff")
  async staff(@CurrentUser() profile: Profile) {
    this.ensureAdmin(profile);
    const { data } = await this.supabase.admin.auth.admin.listUsers({ page: 1, perPage: 200 });
    return (data.users ?? []).map((user) => {
      const meta = (user.user_metadata ?? {}) as { is_approved?: boolean; requested_role?: UserRole };
      return {
        id: user.id,
        email: user.email,
        is_approved: meta.is_approved !== false,
        requested_role: meta.requested_role ?? "executor",
      };
    });
  }

  @Post("staff/:id/approve")
  async approve(
    @CurrentUser() profile: Profile,
    @Param("id") id: string,
    @Body() body: { role?: string },
  ) {
    this.ensureAdmin(profile);
    const role = (USER_ROLES as readonly string[]).includes(body?.role ?? "")
      ? (body.role as UserRole)
      : "executor";

    const { data } = await this.supabase.admin.auth.admin.getUserById(id);
    if (!data.user) {
      throw new ForbiddenException("Пользователь не найден");
    }

    await this.supabase.admin.auth.admin.updateUserById(id, {
      user_metadata: {
        ...(data.user.user_metadata ?? {}),
        is_approved: true,
        requested_role: role,
      },
    });

    const withColumns = await this.supabase.admin
      .from("profiles")
      .update({ role, is_approved: true, requested_role: role })
      .eq("id", id);
    if (withColumns.error) {
      await this.supabase.admin.from("profiles").update({ role }).eq("id", id);
    }

    return { ok: true, role };
  }

  @Post("staff/:id/kick")
  kick(@CurrentUser() profile: Profile, @Param("id") id: string) {
    this.ensureAdmin(profile);
    this.gateway.kickUser(id);
    return { ok: true };
  }

  private ensureAdmin(profile: Profile) {
    if (profile.role !== "admin") {
      throw new ForbiddenException("Только администратор");
    }
  }
}
