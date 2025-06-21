const AUTH_SECRET = process.env.AUTH_SECRET || "alpha-tester";

export function validateAuthToken(token: string): boolean {
  return token === AUTH_SECRET;
}

export function extractBearerToken(authHeader?: string | null): string | null {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.substring(7);
}
