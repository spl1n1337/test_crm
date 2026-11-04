import { Body, Controller, Post, Req, UseGuards } from "@nestjs/common";
import type { AuthedRequest } from "./auth.guard";
import { AuthGuard } from "./auth.guard";
import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post("register")
  register(@Body() body: unknown) {
    return this.auth.register(body);
  }

  @Post("confirm")
  confirm(@Body() body: { token?: string }) {
    return this.auth.confirm(body?.token);
  }

  @Post("forgot")
  forgot(@Body() body: unknown) {
    return this.auth.forgotPassword(body);
  }

  @Post("reset")
  reset(@Body() body: unknown) {
    return this.auth.resetPassword(body);
  }

  @Post("password-change")
  @UseGuards(AuthGuard)
  passwordChange(@Req() request: AuthedRequest, @Body() body: unknown) {
    return this.auth.requestPasswordChange(request.accessToken, body);
  }

  @Post("password-change/confirm")
  confirmPasswordChange(@Body() body: { token?: string }) {
    return this.auth.confirmPasswordChange(body?.token);
  }
}
