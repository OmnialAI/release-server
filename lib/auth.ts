import jwt from "jsonwebtoken";

const AUTH_SECRET = process.env.AUTH_SECRET || "alpha-tester";
const JWT_SECRET = process.env.JWT_SECRET || "default-secret-key-change-this";

export function validateAuthToken(token: string): boolean {
  // Simple token validation for the upload endpoint
  return token === AUTH_SECRET;
}

export function generateJWT(payload: Record<string, any>): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: "1h" });
}

export function verifyJWT(token: string): Record<string, any> | null {
  try {
    return jwt.verify(token, JWT_SECRET) as Record<string, any>;
  } catch (error) {
    console.error("JWT verification failed:", error);
    return null;
  }
}

export function extractBearerToken(authHeader?: string): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7); // Remove 'Bearer ' prefix
}
