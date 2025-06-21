/**
 * Authentication utilities for the release server worker
 */

// Default auth secret, should be overridden by environment variables
const AUTH_SECRET = 'alpha-tester';

/**
 * Validates an authentication token against the configured secret
 * @param {string} token - The token to validate
 * @returns {boolean} - Whether the token is valid
 */
export function validateAuthToken(token) {
  return token === (env.AUTH_SECRET || AUTH_SECRET);
}

/**
 * Extracts a bearer token from an Authorization header
 * @param {string|null} authHeader - The Authorization header value
 * @returns {string|null} - The extracted token, or null if not found
 */
export function extractBearerToken(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.substring(7);
}

// CORS headers for cross-origin requests
export const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

/**
 * Handle OPTIONS requests for CORS preflight
 * @returns {Response} - A 204 response with CORS headers
 */
export function handleOptions() {
  return new Response(null, {
    status: 204,
    headers: CORS_HEADERS
  });
} 