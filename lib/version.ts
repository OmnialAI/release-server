import fs from "fs";
import path from "path";
import semver from "semver";
import { promisify } from "util";
import { localStoragePath } from "./storage";

export interface ReleaseInfo {
  version: string;
  target: string;
  arch: string;
  format: string;
  url: string;
  signature: string;
  notes: string;
  date: string;
}

export function isNewer(currentVersion: string, newVersion: string): boolean {
  return semver.gt(newVersion, currentVersion);
}

export async function getLatestVersion(
  target: string,
  arch: string,
  currentVersion: string,
): Promise<ReleaseInfo | null> {
  try {
    // In a real implementation, you would query a database or scan your storage
    // This is a simplified example using the file system
    const releasesDir = path.join(
      localStoragePath,
      "desktop",
      "alpha",
      target,
      arch,
    );

    if (!fs.existsSync(releasesDir)) {
      return null;
    }

    // Get all tauri format directories (these contain the actual update files)
    const formats = ["tauri"]; // We only care about tauri format for updates
    let latestVersion: string | null = null;

    for (const format of formats) {
      const formatDir = path.join(releasesDir, format);
      if (!fs.existsSync(formatDir)) continue;

      const versions = await promisify(fs.readdir)(formatDir);

      // Find the latest version that is newer than currentVersion
      for (const version of versions) {
        if (
          isNewer(currentVersion, version) &&
          (!latestVersion || isNewer(latestVersion, version))
        ) {
          latestVersion = version;
        }
      }
    }

    if (!latestVersion) {
      return null;
    }

    // Get the file path for the latest version
    const filePath = `desktop/alpha/${target}/${arch}/tauri/${latestVersion}`;
    const fileName = await getUpdateFileName(filePath);

    if (!fileName) {
      return null;
    }

    const fullFilePath = `${filePath}/${fileName}`;

    // Get metadata
    const metadataPath = path.join(
      localStoragePath,
      `${fullFilePath}.meta.json`,
    );
    if (!fs.existsSync(metadataPath)) {
      return null;
    }

    const metadataContent = await promisify(fs.readFile)(metadataPath, "utf8");
    const metadata = JSON.parse(metadataContent);

    return {
      version: latestVersion,
      target,
      arch,
      format: "tauri",
      url: `/api/download/${encodeURIComponent(fullFilePath)}`,
      signature: metadata.signature,
      notes: metadata.notes,
      date: metadata.publishDate,
    };
  } catch (error) {
    console.error("Error getting latest version:", error);
    return null;
  }
}

async function getUpdateFileName(dirPath: string): Promise<string | null> {
  try {
    const fullPath = path.join(localStoragePath, dirPath);
    if (!fs.existsSync(fullPath)) {
      return null;
    }

    const files = await promisify(fs.readdir)(fullPath);
    // Find the .tar.gz file (tauri update file)
    const updateFile = files.find((file) => file.endsWith(".app.tar.gz"));
    return updateFile || null;
  } catch (error) {
    console.error("Error getting update file name:", error);
    return null;
  }
}
