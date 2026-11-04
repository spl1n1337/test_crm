import { Controller, Get, UseGuards } from "@nestjs/common";
import { AuthGuard } from "../auth/auth.guard";
import { PresenceService } from "./presence.service";

@Controller("presence")
@UseGuards(AuthGuard)
export class RealtimeController {
  constructor(private readonly presence: PresenceService) {}

  @Get()
  list() {
    return this.presence.list();
  }
}
