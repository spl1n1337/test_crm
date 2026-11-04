import { Controller, Get, Headers, Query, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DeadlinesService } from "./deadlines.service";

@Controller("cron")
export class DeadlinesController {
  constructor(
    private readonly deadlines: DeadlinesService,
    private readonly config: ConfigService,
  ) {}

  @Get("deadlines")
  async run(
    @Headers("authorization") authorization?: string,
    @Query("secret") secret?: string,
  ) {
    const expected = this.config.get<string>("CRON_SECRET");
    const authorized =
      (expected && authorization === `Bearer ${expected}`) ||
      (expected && secret === expected) ||
      (!expected && this.config.get("NODE_ENV") !== "production");

    if (!authorized) {
      throw new UnauthorizedException();
    }

    return this.deadlines.dispatch();
  }
}
