import { Inject, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import type {
  AuthUser,
  AuthRequestCodeInput,
  AuthVerifyCodeInput,
  AuthVerifyCodeResponse
} from "@ai-music-playlist/api-contract";

import { appEnv } from "../../config/env";
import { PrismaService } from "../../platform/prisma/prisma.service";
import { normalizeAlphaIdentifier, signAlphaAccessToken, validateAlphaLoginInput } from "./alpha-auth";

@Injectable()
export class AuthService {
  constructor(@Inject(PrismaService) private readonly prisma: PrismaService) {}

  requestCode(payload: AuthRequestCodeInput) {
    const phoneOrEmail = normalizeAlphaIdentifier(payload.phoneOrEmail ?? payload.phoneNumber ?? "");

    return {
      accepted: true,
      phoneOrEmail,
      phoneNumber: payload.phoneNumber ?? phoneOrEmail,
      provider: "placeholder",
      nextStep: "use alpha invite code and placeholder login code"
    };
  }

  async verifyCode(payload: AuthVerifyCodeInput): Promise<AuthVerifyCodeResponse> {
    let login: ReturnType<typeof validateAlphaLoginInput>;

    try {
      login = validateAlphaLoginInput(payload, {
        alphaLoginCode: appEnv.ALPHA_LOGIN_CODE,
        alphaInviteCode: appEnv.ALPHA_INVITE_CODE
      });
    } catch (error) {
      throw new UnauthorizedException(error instanceof Error ? error.message : "Invalid alpha login");
    }

    let user: { id: string; phoneOrEmail: string; nickname: string };

    try {
      user = await this.prisma.user.upsert({
        where: {
          phoneOrEmail: login.phoneOrEmail
        },
        create: {
          phoneOrEmail: login.phoneOrEmail,
          nickname: login.phoneOrEmail.includes("@")
            ? login.phoneOrEmail.split("@")[0] ?? "Alpha User"
            : `用户${login.phoneOrEmail.slice(-4)}`,
          status: "ACTIVE"
        },
        update: {
          status: "ACTIVE"
        }
      });
    } catch (error) {
      if (this.isPrismaUnavailable(error)) {
        throw new ServiceUnavailableException("Database is unavailable. Start local Postgres before logging in.");
      }

      throw error;
    }
    const accessToken = signAlphaAccessToken({
      secret: appEnv.JWT_SECRET,
      userId: user.id,
      phoneOrEmail: user.phoneOrEmail,
      expiresInSeconds: appEnv.ACCESS_TOKEN_EXPIRES_IN_SECONDS
    });

    return {
      accessToken,
      refreshToken: accessToken,
      expiresIn: appEnv.ACCESS_TOKEN_EXPIRES_IN_SECONDS,
      user: {
        id: user.id,
        phoneOrEmail: user.phoneOrEmail,
        nickname: user.nickname
      }
    };
  }

  async getMe(userId: string): Promise<AuthUser> {
    const user = await this.prisma.user.findUnique({
      where: {
        id: userId
      }
    });

    if (!user) {
      throw new UnauthorizedException("Invalid alpha user");
    }

    return {
      id: user.id,
      phoneOrEmail: user.phoneOrEmail,
      nickname: user.nickname
    };
  }

  private isPrismaUnavailable(error: unknown) {
    if (!(error instanceof Error)) {
      return false;
    }

    return (
      error.name === "PrismaClientInitializationError" ||
      error.message.includes("Environment variable not found: DATABASE_URL") ||
      error.message.includes("Can't reach database server")
    );
  }
}
