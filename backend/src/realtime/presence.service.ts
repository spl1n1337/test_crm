import { Injectable } from "@nestjs/common";
import type { Profile } from "../common/types";

export type PresenceUser = {
  id: string;
  full_name: string;
  email: string;
  role: Profile["role"];
  avatar_url: string | null;
  sockets: Set<string>;
};

@Injectable()
export class PresenceService {
  private readonly users = new Map<string, PresenceUser>();

  add(socketId: string, profile: Profile) {
    const current = this.users.get(profile.id);
    if (current) {
      current.sockets.add(socketId);
      current.full_name = profile.full_name;
      current.avatar_url = profile.avatar_url;
      current.role = profile.role;
      return;
    }
    this.users.set(profile.id, {
      id: profile.id,
      full_name: profile.full_name,
      email: profile.email,
      role: profile.role,
      avatar_url: profile.avatar_url,
      sockets: new Set([socketId]),
    });
  }

  remove(socketId: string, userId?: string) {
    if (userId) {
      const current = this.users.get(userId);
      if (!current) return;
      current.sockets.delete(socketId);
      if (current.sockets.size === 0) this.users.delete(userId);
      return;
    }
    for (const [id, user] of this.users) {
      user.sockets.delete(socketId);
      if (user.sockets.size === 0) this.users.delete(id);
    }
  }

  kick(userId: string) {
    this.users.delete(userId);
  }

  list() {
    return [...this.users.values()].map(({ sockets, ...user }) => ({
      ...user,
      online_at: new Date().toISOString(),
    }));
  }

  ids() {
    return [...this.users.keys()];
  }
}
