import semver from "semver";
import { GetObjectCommand, ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";

// R2 configuration
const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
  },
});

const s3BucketName = process.env.R2_BUCKET_NAME || "";

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
    // List objects in the R2 bucket with the appropriate prefix
    const prefix = `${target}/${arch}/`;
    
    const command = new ListObjectsV2Command({
      Bucket: s3BucketName,
      Prefix: prefix,
      Delimiter: '/'
    });
    
    const response = await s3Client.send(command);
    
    if (!response.CommonPrefixes || response.CommonPrefixes.length === 0) {
      return null;
    }
    
    // Extract version numbers from the prefixes
    const versions = response.CommonPrefixes
      .map(prefix => prefix.Prefix?.split('/').filter(Boolean).pop() || '')
      .filter(Boolean);
    
    // Find the latest version that is newer than currentVersion
    let latestVersion: string | null = null;
    
    for (const version of versions) {
      if (
        isNewer(currentVersion, version) &&
        (!latestVersion || isNewer(latestVersion, version))
      ) {
        latestVersion = version;
      }
    }
    
    if (!latestVersion) {
      return null;
    }
    
    // Get the file path for the latest version
    const filePath = `${target}/${arch}/${latestVersion}`;
    const fileName = await getUpdateFileName(filePath);
    
    if (!fileName) {
      return null;
    }
    
    const fullFilePath = `${filePath}/${fileName}`;
    
    // Get metadata from R2
    const metadataCommand = new GetObjectCommand({
      Bucket: s3BucketName,
      Key: fullFilePath
    });
    
    const metadataResponse = await s3Client.send(metadataCommand);
    const metadata = metadataResponse.Metadata || {};
    
    return {
      version: latestVersion,
      target,
      arch,
      format: "tauri",
      url: `/api/download/${target}/${arch}/${latestVersion}/${fileName}`,
      signature: metadata.signature || '',
      notes: metadata.notes ? Buffer.from(metadata.notes, 'base64').toString() : '',
      date: metadata.publishdate || new Date().toISOString(),
    };
  } catch (error) {
    console.error("Error getting latest version:", error);
    return null;
  }
}

async function getUpdateFileName(dirPath: string): Promise<string | null> {
  try {
    // List objects in the R2 bucket with the appropriate prefix
    const command = new ListObjectsV2Command({
      Bucket: s3BucketName,
      Prefix: dirPath + '/'
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Contents || response.Contents.length === 0) {
      return null;
    }
    
    // Find the .tar.gz file (tauri update file)
    const updateFile = response.Contents
      .map(item => item.Key?.split('/').pop() || '')
      .find(file => file.endsWith(".app.tar.gz"));
      
    return updateFile || null;
  } catch (error) {
    console.error("Error getting update file name:", error);
    return null;
  }
}
