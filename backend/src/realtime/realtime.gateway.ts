import { Logger } from "@nestjs/common";
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { SupabaseService } from "../supabase/supabase.service";
import type { Profile } from "../common/types";
import { PresenceService } from "./presence.service";

@WebSocketGateway({
  cors: { origin: true, credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(RealtimeGateway.name);

  constructor(
    private readonly supabase: SupabaseService,
    private readonly presence: PresenceService,
  ) {}

  async handleConnection(client: Socket) {
    const token =
      (client.handshake.auth?.token as string | undefined) ||
      client.handshake.headers.authorization?.replace("Bearer ", "");

    if (!token) {
      client.disconnect();
      return;
    }

    const { data, error } = await this.supabase.admin.auth.getUser(token);
    if (error || !data.user) {
      client.disconnect();
      return;
    }

    const { data: profile } = await this.supabase.admin
      .from("profiles")
      .select("*")
      .eq("id", data.user.id)
      .maybeSingle();

    if (!profile || profile.is_blocked) {
      client.disconnect();
      return;
    }

    client.data.userId = profile.id;
    client.join(`user:${profile.id}`);
    this.presence.add(client.id, profile as Profile);
    this.server.emit("presence", this.presence.list());
    this.logger.debug(`connected ${profile.email}`);
  }

  handleDisconnect(client: Socket) {
    this.presence.remove(client.id, client.data.userId as string | undefined);
    this.server.emit("presence", this.presence.list());
  }

  @SubscribeMessage("ping")
  ping(@ConnectedSocket() client: Socket, @MessageBody() _body: unknown) {
    client.emit("pong", { at: new Date().toISOString() });
  }

  emitNotification(userId: string, payload: unknown) {
    this.server.to(`user:${userId}`).emit("notification", payload);
  }

  emitTask(payload: unknown) {
    this.server.emit("task", payload);
  }

  kickUser(userId: string) {
    this.presence.kick(userId);
    this.server.in(`user:${userId}`).disconnectSockets(true);
    this.server.emit("presence", this.presence.list());
  }
}
