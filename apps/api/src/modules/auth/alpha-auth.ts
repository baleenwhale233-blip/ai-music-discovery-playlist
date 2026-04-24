import { createHmac, timingSafeEqual } from "node:crypto";

export type AlphaLoginInput = {
  phoneOrEmail?: string;
  phoneNumber?: string;
  code: string;
  inviteCode?: string;
};

export type AlphaAuthEnv = {
  alphaLoginCode: string;
  alphaInviteCode: string;
};

export type AlphaAccessTokenPayload = {
  userId: string;
  phoneOrEmail: string;
  exp: number;
};

function base64UrlEncode(input: string) {
  return Buffer.from(input, "utf8").toString("base64url");
}

function base64UrlDecode(input: string) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function signValue(input: { payload: string; secret: string }) {
  return createHmac("sha256", input.secret).update(input.payload).digest("base64url");
}

export function normalizeAlphaIdentifier(input: string) {
  const normalized = input.trim();

  if (!normalized) {
    throw new Error("phoneOrEmail is required");
  }

  return normalized.includes("@") ? normalized.toLowerCase() : normalized;
}

export function validateAlphaLoginInput(input: AlphaLoginInput, env: AlphaAuthEnv) {
  if (input.inviteCode !== env.alphaInviteCode) {
    throw new Error("Invalid alpha invite code");
  }

  if (input.code !== env.alphaLoginCode) {
    throw new Error("Invalid alpha login code");
  }

  return {
    phoneOrEmail: normalizeAlphaIdentifier(input.phoneOrEmail ?? input.phoneNumber ?? "")
  };
}

export function signAlphaAccessToken(input: {
  secret: string;
  userId: string;
  phoneOrEmail: string;
  expiresInSeconds: number;
  nowMs?: number;
}) {
  const exp = Math.floor((input.nowMs ?? Date.now()) / 1000) + input.expiresInSeconds;
  const payload = base64UrlEncode(
    JSON.stringify({
      userId: input.userId,
      phoneOrEmail: input.phoneOrEmail,
      exp
    } satisfies AlphaAccessTokenPayload),
  );
  const signature = signValue({
    payload,
    secret: input.secret
  });

  return `alpha.${payload}.${signature}`;
}

export function verifyAlphaAccessToken(input: { token: string; secret: string; nowMs?: number }) {
  const [prefix, payload, signature] = input.token.split(".");

  if (prefix !== "alpha" || !payload || !signature) {
    throw new Error("Invalid access token");
  }

  const expectedSignature = signValue({
    payload,
    secret: input.secret
  });
  const actual = Buffer.from(signature);
  const expected = Buffer.from(expectedSignature);

  if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
    throw new Error("Invalid access token");
  }

  const parsed = JSON.parse(base64UrlDecode(payload)) as AlphaAccessTokenPayload;
  const nowSeconds = Math.floor((input.nowMs ?? Date.now()) / 1000);

  if (!parsed.userId || !parsed.phoneOrEmail || parsed.exp <= nowSeconds) {
    throw new Error("Expired access token");
  }

  return parsed;
}
