/**
 * Version utilities for the release server worker
 */

import { getUpdateFileName, listDirectories, getFile } from './storage.js';

/**
 * Compare two version strings to determine if the new version is newer
 * @param {string} currentVersion - The current version
 * @param {string} newVersion - The version to compare against
 * @returns {boolean} - Whether the new version is newer
 */
export function isNewer(currentVersion, newVersion) {
  // Simple semver comparison
  const currentParts = currentVersion.split('.').map(Number);
  const newParts = newVersion.split('.').map(Number);
  
  for (let i = 0; i < Math.max(currentParts.length, newParts.length); i++) {
    const current = currentParts[i] || 0;
    const next = newParts[i] || 0;
    if (next > current) return true;
    if (next < current) return false;
  }
  
  return false;
}

/**
 * Get the latest version for a target and architecture
 * @param {string} target - The target platform
 * @param {string} arch - The target architecture
 * @param {string} currentVersion - The current version
 * @returns {Promise<Object|null>} - The latest version info, or null if no newer version
 */
export async function getLatestVersion(target, arch, currentVersion) {
  try {
    console.log(`Looking for updates for ${target}/${arch}/${currentVersion}`);
    
    // List directories for the target and architecture
    const prefix = `${target}/${arch}/`;
    const versions = await listDirectories(prefix);
    
    console.log('Available versions:', versions);
    
    if (!versions.length) {
      console.log('No versions found');
      return null;
    }
    
    // Find the latest version that is newer than currentVersion
    let latestVersion = null;
    
    for (const version of versions) {
      console.log(`Checking version ${version}`);
      if (
        isNewer(currentVersion, version) &&
        (!latestVersion || isNewer(latestVersion, version))
      ) {
        console.log(`Found newer version: ${version}`);
        latestVersion = version;
      }
    }
    
    if (!latestVersion) {
      console.log('No newer version found');
      return null;
    }
    
    console.log(`Latest version: ${latestVersion}`);
    
    // Get the file path for the latest version
    const filePath = `${target}/${arch}/${latestVersion}`;
    const fileName = await getUpdateFileName(filePath);
    
    if (!fileName) {
      console.log('No update file found');
      return null;
    }
    
    console.log(`Update file: ${fileName}`);
    const fullFilePath = `${filePath}/${fileName}`;
    
    // Get metadata from R2
    const fileResponse = await getFile(fullFilePath);
    
    if (!fileResponse) {
      return null;
    }
    
    const metadata = fileResponse.Metadata || {};
    
    return {
      version: latestVersion,
      target,
      arch,
      format: "tauri",
      url: `/api/download/${fullFilePath}`,
      signature: metadata.signature || '',
      notes: metadata.notes ? atob(metadata.notes) : '',
      date: metadata.publishdate || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error getting latest version:", error);
    return null;
  }
} 