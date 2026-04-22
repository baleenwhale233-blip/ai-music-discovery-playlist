import { Body, Controller, HttpCode, Post } from "@nestjs/common";
import type {
  AuthRequestCodeInput,
  AuthVerifyCodeInput,
  AuthVerifyCodeResponse
} from "@ai-music-playlist/api-contract";

import { AuthService } from "./auth.service";

@Controller("auth")
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post("request-code")
  @HttpCode(202)
  requestCode(@Body() body: AuthRequestCodeInput) {
    return this.authService.requestCode(body);
  }

  @Post("verify-code")
  verifyCode(@Body() body: AuthVerifyCodeInput): AuthVerifyCodeResponse {
    return this.authService.verifyCode(body);
  }
}
