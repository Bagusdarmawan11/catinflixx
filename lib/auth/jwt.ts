import { SignJWT, jwtVerify } from "jose";
import { AUTH_CONFIG } from "@/config";

export interface JWTPayload {
  userId: number;
  email: string;
  name: string;
}

function getSecret(): Uint8Array {
  if (!AUTH_CONFIG.jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return new TextEncoder().encode(AUTH_CONFIG.jwtSecret);
}

export async function signToken(payload: JWTPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(AUTH_CONFIG.jwtExpiresIn)
    .sign(getSecret());
}

export async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    return {
      userId: payload.userId as number,
      email: payload.email as string,
      name: payload.name as string,
    };
  } catch {
    return null;
  }
}
