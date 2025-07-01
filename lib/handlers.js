/**
 * API route handlers for the release server worker
 */

import { validateAuthToken, extractBearerToken, CORS_HEADERS } from './auth.js';
import { getLatestVersion } from './version.js';
import { getFile, uploadFile } from './storage.js';

// Default signature to use when no signature is available
const DEFAULT_SIGNATURE = "dW50cnVzdGVkIGNvbW1lbnQ6IG1pbmlzaWduIHB1YmxpYyBrZXk6IDlFQzBCQkEwM0U4NzA1NzkKUldSNUJZYytvTHZBbnVGUERLcityOVVObEY5L09tc25YdGtoNVh5Vll6WXdHN3R1MG4xTkh2cmwK";

/**
 * Generate a random passcode for downloads
 * @param {number} length - Length of the passcode
 * @returns {string} - Random passcode
 */
function generateRandomPasscode(length = 8) {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed similar looking characters
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

/**
 * Handle download passcode generation endpoint
 * @param {Request} request - The request object
 * @param {URL} url - The parsed URL
 * @returns {Promise<Response>} - The response
 */
export async function handleGenerateDownloadCode(request, url) {
  try {
    // Authenticate request
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);
    
    if (!token || !validateAuthToken(token)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Parse request body to get email
    let email;
    try {
      const body = await request.json();
      email = body.email;
      
      if (!email || typeof email !== 'string' || !email.includes('@')) {
        return new Response(JSON.stringify({ error: 'Valid email is required' }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
        });
      }
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Generate a random passcode
    const passcode = generateRandomPasscode(8);
    
    // Store in KV with expiration (24 hours = 86400 seconds)
    await env.DOWNLOAD_CODES.put(passcode, email, { expirationTtl: 86400 });
    
    return new Response(JSON.stringify({
      success: true,
      passcode: passcode,
      expires: 'in 24 hours'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

/**
 * Handle DMG download endpoint
 * @param {Request} request - The request object
 * @param {URL} url - The parsed URL
 * @returns {Promise<Response>} - The response
 */
export async function handleDmgDownload(request, url) {
  try {
    // Extract passcode from URL
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected format: api/dmg-download/[passcode]/[target]/[arch]
    // Version is no longer required in the URL
    if (pathParts.length < 4 || pathParts[0] !== 'api' || pathParts[1] !== 'dmg-download') {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    const passcode = pathParts[2];
    const target = pathParts[3];
    const arch = pathParts[4] || 'aarch64'; // Default to aarch64 if not specified
    
    // Validate passcode
    const email = await env.DOWNLOAD_CODES.get(passcode);
    
    if (!email) {
      return new Response(JSON.stringify({ error: 'Invalid or expired passcode' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Get the latest version for this target/arch
    const latestVersion = await getLatestVersion(target, arch, '0.0.0');
    if (!latestVersion) {
      return new Response(JSON.stringify({ error: 'No version available for this platform' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Construct the DMG file path with the latest version
    const filePath = `${target}/${arch}/${latestVersion.version}/Omnial.${latestVersion.version}.${arch}.dmg`;
    
    // Get the file from storage
    const response = await getFile(filePath);
    
    if (!response || !response.Body) {
      return new Response(JSON.stringify({ error: 'DMG file not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Stream the file back to the client
    const arrayBuffer = await response.Body.transformToByteArray();
    
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/x-apple-diskimage',
        'Content-Disposition': `attachment; filename="Omnial-${latestVersion.version}.dmg"`,
        ...CORS_HEADERS
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

/**
 * Handle version check endpoint
 * @param {Request} request - The request object
 * @param {URL} url - The parsed URL
 * @returns {Promise<Response>} - The response
 */
export async function handleVersionCheck(request, url) {
  try {
    // Authenticate request
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);
    
    if (!token || !validateAuthToken(token)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Extract parameters from URL
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected format: api/version/[target]/[arch]/[version]
    if (pathParts.length !== 5 || pathParts[0] !== 'api' || pathParts[1] !== 'version') {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    const target = pathParts[2];
    const arch = pathParts[3];
    const version = pathParts[4];
    
    // Validate parameters
    if (!target || !arch || !version) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Get the latest version
    const latestVersion = await getLatestVersion(target, arch, version);
    
    if (!latestVersion) {
      // Return response in Tauri-compatible format even when no updates are available
      const baseUrl = env.BASE_URL || url.origin;
      const currentDate = new Date().toISOString();
      const fileName = `Omnial.${version}.${arch}.app.tar.gz`;
      const platformKey = `${target}-${arch}`;
      
      return new Response(JSON.stringify({
        version: version,
        notes: "No updates available",
        pub_date: currentDate,
        platforms: {
          [platformKey]: {
            signature: DEFAULT_SIGNATURE,
            url: `${baseUrl}/api/download/${target}/${arch}/${version}/${fileName}`
          }
        }
      }), {
        status: 200,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Format response according to Tauri updater requirements
    const baseUrl = env.BASE_URL || url.origin;
    const platformKey = `${target}-${arch}`;
    
    // Extract filename from URL
    const urlParts = latestVersion.url.split('/');
    const fileName = urlParts[urlParts.length - 1];
    
    return new Response(JSON.stringify({
      version: latestVersion.version,
      notes: latestVersion.notes || `Release version ${latestVersion.version}`,
      pub_date: latestVersion.date,
      platforms: {
        [platformKey]: {
          signature: latestVersion.signature || DEFAULT_SIGNATURE,
          url: `${baseUrl}/api/download/${target}/${arch}/${latestVersion.version}/${fileName}`
        }
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

/**
 * Handle download endpoint
 * @param {Request} request - The request object
 * @param {URL} url - The parsed URL
 * @returns {Promise<Response>} - The response
 */
export async function handleDownload(request, url) {
  try {
    // Authenticate request
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);
    
    if (!token || !validateAuthToken(token)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Extract file path from URL
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected format: api/download/[target]/[arch]/[version]/[filename]
    if (pathParts.length < 5 || pathParts[0] !== 'api' || pathParts[1] !== 'download') {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Reconstruct the file path
    const filePath = pathParts.slice(2).join('/');
    
    // Get the file from storage
    const response = await getFile(filePath);
    
    if (!response || !response.Body) {
      return new Response(JSON.stringify({ error: 'File not found' }), {
        status: 404,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Stream the file back to the client
    const arrayBuffer = await response.Body.transformToByteArray();
    const contentType = response.ContentType || 'application/octet-stream';
    
    return new Response(arrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `attachment; filename="${pathParts[pathParts.length - 1]}"`,
        ...CORS_HEADERS
      }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
}

/**
 * Handle upload endpoint
 * @param {Request} request - The request object
 * @param {URL} url - The parsed URL
 * @returns {Promise<Response>} - The response
 */
export async function handleUpload(request, url) {
  try {
    // Authenticate request
    const authHeader = request.headers.get('authorization');
    const token = extractBearerToken(authHeader);
    
    if (!token || !validateAuthToken(token)) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Extract parameters from URL
    const pathParts = url.pathname.split('/').filter(Boolean);
    
    // Expected format: api/upload/[target]/[arch]/[version]
    if (pathParts.length !== 5 || pathParts[0] !== 'api' || pathParts[1] !== 'upload') {
      return new Response(JSON.stringify({ error: 'Invalid URL format' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    const target = pathParts[2];
    const arch = pathParts[3];
    const version = pathParts[4];
    
    // Validate parameters
    if (!target || !arch || !version) {
      return new Response(JSON.stringify({ error: 'Missing required parameters' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Check if this is a multipart/form-data request
    const contentType = request.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return new Response(JSON.stringify({ error: 'Expected multipart/form-data request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Parse the form data
    const formData = await request.formData();
    const file = formData.get('file');
    const signature = formData.get('signature') || '';
    const notes = formData.get('notes') || '';
    
    if (!file || !(file instanceof File)) {
      return new Response(JSON.stringify({ error: 'No file provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Create the file path
    const fileName = file.name;
    const filePath = `${target}/${arch}/${version}/${fileName}`;
    
    // Upload the file to storage
    const fileArrayBuffer = await file.arrayBuffer();
    
    const success = await uploadFile(filePath, fileArrayBuffer, file.type, {
      signature: signature,
      notes: btoa(notes),
      publishdate: new Date().toISOString(),
    });
    
    if (!success) {
      return new Response(JSON.stringify({ error: 'Failed to upload file' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
      });
    }
    
    // Generate the download URL
    const baseUrl = env.BASE_URL || url.origin;
    const downloadUrl = `${baseUrl}/api/download/${filePath}`;
    
    return new Response(JSON.stringify({
      success: true,
      url: downloadUrl,
      version,
      target,
      arch,
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...CORS_HEADERS }
    });
  }
} 