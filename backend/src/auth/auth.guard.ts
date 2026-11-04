import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request } from "express";
import { SupabaseService } from "../supabase/supabase.service";
import type { Profile } from "../common/types";

export type AuthedRequest = Request & {
  accessToken: string;
  profile: Profile;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly supabase: SupabaseService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<AuthedRequest>();
    const header = request.headers.authorization;
    const token = header?.startsWith("Bearer ") ? header.slice(7) : null;
    if (!token) {
      throw new UnauthorizedException("Нужна авторизация");
    }

    const { data, error } = await this.supabase.admin.auth.getUser(token);
    if (error || !data.user) {
      throw new UnauthorizedException("Сессия недействительна");
    }

    const { data: profile } = await this.supabase.admin
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile) {
      throw new UnauthorizedException("Профиль не найден");
    }
    if (profile.is_blocked) {
      throw new UnauthorizedException("Аккаунт заблокирован");
    }
    const metaApproved = (data.user.user_metadata as { is_approved?: boolean } | undefined)?.is_approved;
    if (profile.is_approved === false || metaApproved === false) {
      throw new UnauthorizedException("Аккаунт ещё не подтверждён администратором");
    }

    request.accessToken = token;
    request.profile = profile as Profile;
    return true;
  }
}
