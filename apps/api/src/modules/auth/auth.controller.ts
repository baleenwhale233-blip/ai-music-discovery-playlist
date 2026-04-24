import { Body, Controller, HttpCode, Inject, Post } from "@nestjs/common";
import type {
  AuthRequestCodeInput,
  AuthVerifyCodeInput,
  AuthVerifyCodeResponse
} from "@ai-music-playlist/api-contract";

import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(@Inject(AuthService) private readonly authService: AuthService) {
    this.requestCode = this.requestCode.bind(this);
    this.verifyCode = this.verifyCode.bind(this);
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
}
