import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

import { appEnv } from "../../config/env";
import { verifyAlphaAccessToken } from "./alpha-auth";
import type { AlphaRequest } from "./current-alpha-user.decorator";

@Injectable()
export class AlphaAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<
      AlphaRequest & {
        headers: Record<string, string | undefined>;
        query?: Record<string, string | string[] | undefined>;
      }
    >();
    const authorization = request.headers.authorization;
    // TODO: Replace long-lived query access_token media auth with short-lived signed media URLs.
    const queryToken = request.query?.access_token;
    const token = authorization?.startsWith("Bearer ")
      ? authorization.slice("Bearer ".length)
      : Array.isArray(queryToken)
        ? queryToken[0] ?? null
        : queryToken ?? null;

    if (!token) {
      throw new UnauthorizedException("Missing bearer token");
    }

    try {
      request.alphaUser = verifyAlphaAccessToken({
        token,
        secret: appEnv.JWT_SECRET
      });

      return true;
    } catch {
      throw new UnauthorizedException("Invalid bearer token");
    }
  }
}
