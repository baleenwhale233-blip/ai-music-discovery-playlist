import { Injectable } from "@nestjs/common";
import type {
  AuthRequestCodeInput,
  AuthVerifyCodeInput,
  AuthVerifyCodeResponse
} from "@ai-music-playlist/api-contract";

@Injectable()
export class AuthService {
  requestCode(payload: AuthRequestCodeInput) {
    return {
      accepted: true,
      phoneNumber: payload.phoneNumber,
      provider: "placeholder",
      nextStep: "wire real sms provider"
    };
  }

  verifyCode(payload: AuthVerifyCodeInput): AuthVerifyCodeResponse {
    return {
      accessToken: `placeholder-access-token:${payload.phoneNumber}`,
      refreshToken: `placeholder-refresh-token:${payload.scenario}`,
      expiresIn: 3600
    };
  }
}
