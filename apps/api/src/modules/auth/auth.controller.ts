import { Body, Controller, Get, HttpCode, Inject, Post, UseGuards } from "@nestjs/common";
import type {
  AuthRequestCodeInput,
  AuthVerifyCodeInput,
  AuthVerifyCodeResponse
} from "@ai-music-playlist/api-contract";

import { AuthService } from "./auth.service";
import type { AlphaAccessTokenPayload } from "./alpha-auth";
import { AlphaAuthGuard } from "./alpha-auth.guard";
import { CurrentAlphaUser } from "./current-alpha-user.decorator";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {
    this.requestCode = this.requestCode.bind(this);
    this.verifyCode = this.verifyCode.bind(this);
    this.me = this.me.bind(this);
  }

  @Post("request-code")
  @HttpCode(202)
  requestCode(@Body() body: AuthRequestCodeInput) {
    return this.authService.requestCode(body);
  }

  @Post("verify-code")
  verifyCode(@Body() body: AuthVerifyCodeInput): Promise<AuthVerifyCodeResponse> {
    return this.authService.verifyCode(body);
  }

  @Get("me")
  @UseGuards(AlphaAuthGuard)
  me(@CurrentAlphaUser() user: AlphaAccessTokenPayload) {
    return this.authService.getMe(user.userId);
  }
}
