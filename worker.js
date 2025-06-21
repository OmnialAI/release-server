/**
 * Release Server Worker
 * 
 * A simplified implementation of the release server using Cloudflare Workers
 */

import { handleOptions } from './lib/auth.js';
import { handleVersionCheck, handleDownload, handleUpload } from './lib/handlers.js';

// Main handler function
export default {
  async fetch(request, env) {
    // Make environment variables available globally
    globalThis.env = env;
    
    const url = new URL(request.url);
    const method = request.method.toUpperCase();
    
    // Handle OPTIONS requests for CORS
    if (method === 'OPTIONS') {
      return handleOptions();
    }
    
    // Route requests based on path
    if (url.pathname.startsWith('/api/version/')) {
      return handleVersionCheck(request, url);
    } else if (url.pathname.startsWith('/api/download/')) {
      return handleDownload(request, url);
    } else if (url.pathname.startsWith('/api/upload/')) {
      return handleUpload(request, url);
    }
    
    // Default response for unknown routes
    return new Response('Release Server API', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}; 