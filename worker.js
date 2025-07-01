/**
 * Release Server Worker
 * 
 * A simplified implementation of the release server using Cloudflare Workers
 */

import { handleOptions } from './lib/auth.js';
import { handleVersionCheck, handleDownload, handleUpload, handleGenerateDownloadCode, handleDmgDownload } from './lib/handlers.js';

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
    } else if (url.pathname.startsWith('/api/generate-download-code')) {
      return handleGenerateDownloadCode(request, url);
    } else if (url.pathname.startsWith('/api/dmg-download/')) {
      return handleDmgDownload(request, url);
    } else if (url.pathname.startsWith('/download/')) {
      // Redirect /download/ URLs to /api/download/ with appropriate path
      const fileName = url.pathname.replace('/download/', '');
      
      // Try to extract target, arch, and version from filename
      // Expected format: Omnial.0.3.1.aarch64.app.tar.gz
      const parts = fileName.split('.');
      let target = 'darwin';  // Default to darwin for /download/ URLs
      let arch = 'aarch64';   // Default to aarch64 for /download/ URLs
      let version = '0.0.0';
      
      // Try to parse version and arch from filename
      if (parts.length >= 3) {
        // Assuming version is the numeric part
        for (let i = 0; i < parts.length; i++) {
          if (/^\d+\.\d+\.\d+$/.test(parts[i])) {
            version = parts[i];
            if (i + 1 < parts.length) {
              // Next part is likely the architecture
              arch = parts[i + 1];
              break;
            }
          }
        }
      }
      
      console.log(`Redirecting /download/${fileName} to /api/download/${target}/${arch}/${version}/${fileName}`);
      
      // Redirect to the API download endpoint
      const redirectUrl = `/api/download/${target}/${arch}/${version}/${fileName}`;
      return Response.redirect(`${url.origin}${redirectUrl}`, 302);
    }
    
    // Default response for unknown routes
    return new Response('Release Server API', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  }
}; 