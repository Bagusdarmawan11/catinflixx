import jwt from "jsonwebtoken";
import { AUTH_CONFIG } from "@/config";

export interface JWTPayload {
  userId: number;
  email: string;
  name: string;
}

export function signToken(payload: JWTPayload): string {
  if (!AUTH_CONFIG.jwtSecret) {
    throw new Error("JWT_SECRET is not configured");
  }
  return jwt.sign(payload, AUTH_CONFIG.jwtSecret, {
    expiresIn: AUTH_CONFIG.jwtExpiresIn,
  });
}

export function verifyToken(token: string): JWTPayload | null {
  try {
    if (!AUTH_CONFIG.jwtSecret) {
      throw new Error("JWT_SECRET is not configured");
    }
    const decoded = jwt.verify(token, AUTH_CONFIG.jwtSecret) as JWTPayload;
    return decoded;
  } catch {
    return null;
  }
}
