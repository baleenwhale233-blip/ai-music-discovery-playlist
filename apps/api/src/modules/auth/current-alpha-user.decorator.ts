import { createParamDecorator, ExecutionContext } from "@nestjs/common";

import type { AlphaAccessTokenPayload } from "./alpha-auth";

export type AlphaRequest = Request & {
  alphaUser?: AlphaAccessTokenPayload;
};

export const CurrentAlphaUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext) => {
    const request = context.switchToHttp().getRequest<AlphaRequest>();

    return request.alphaUser;
  },
);
