import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthedRequest } from "./auth.guard";

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest<AuthedRequest>();
  return request.profile;
});
