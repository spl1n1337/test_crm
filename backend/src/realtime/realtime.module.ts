import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PresenceService } from "./presence.service";
import { RealtimeController } from "./realtime.controller";
import { RealtimeGateway } from "./realtime.gateway";
import { RealtimeBridgeService } from "./realtime-bridge.service";

@Module({
  imports: [AuthModule],
  controllers: [RealtimeController],
  providers: [PresenceService, RealtimeGateway, RealtimeBridgeService],
  exports: [RealtimeGateway, PresenceService],
})
export class RealtimeModule {}
