import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import fs, { createReadStream } from "fs";
import path from "path";
import { promisify } from "util";

// Load environment variables
const storageType = process.env.STORAGE_TYPE || "local";
export const localStoragePath = process.env.LOCAL_STORAGE_PATH || "./storage";

// S3 configuration
const s3Client =
  storageType === "s3"
    ? new S3Client({
        region: process.env.S3_REGION || "",
        endpoint: process.env.S3_ENDPOINT,
        credentials: {
          accessKeyId: process.env.S3_ACCESS_KEY || "",
          secretAccessKey: process.env.S3_SECRET_KEY || "",
        },
      })
    : null;

const s3BucketName = process.env.S3_BUCKET || "";

// Ensure local storage directory exists
if (storageType === "local") {
  try {
    if (!fs.existsSync(localStoragePath)) {
      fs.mkdirSync(localStoragePath, { recursive: true });
    }
  } catch (error) {
    console.error("Failed to create local storage directory:", error);
  }
}

export interface FileMetadata {
  signature: string;
  publishDate: string;
  notes: string;
}

export async function storeFile(
  filePath: string,
  fileBuffer: Buffer,
  metadata: FileMetadata,
): Promise<boolean> {
  try {
    if (storageType === "s3") {
      return await storeFileS3(filePath, fileBuffer, metadata);
    } else {
      return await storeFileLocal(filePath, fileBuffer, metadata);
    }
  } catch (error) {
    console.error("Error storing file:", error);
    return false;
  }
}

async function storeFileLocal(
  filePath: string,
  fileBuffer: Buffer,
  metadata: FileMetadata,
): Promise<boolean> {
  const fullPath = path.join(localStoragePath, filePath);
  const metadataPath = `${fullPath}.meta.json`;

  // Create directory if it doesn't exist
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  try {
    // Write file
    await promisify(fs.writeFile)(fullPath, fileBuffer);

    // Write metadata
    await promisify(fs.writeFile)(metadataPath, JSON.stringify(metadata));

    return true;
  } catch (error) {
    console.error("Error storing file locally:", error);
    return false;
  }
}

async function storeFileS3(
  filePath: string,
  fileBuffer: Buffer,
  metadata: FileMetadata,
): Promise<boolean> {
  if (!s3Client) return false;

  try {
    // Upload file
    await s3Client.send(
      new PutObjectCommand({
        Bucket: s3BucketName,
        Key: filePath,
        Body: fileBuffer,
        Metadata: {
          signature: metadata.signature,
          publishDate: metadata.publishDate,
          notes: Buffer.from(metadata.notes).toString("base64"),
        },
      }),
    );

    return true;
  } catch (error) {
    console.error("Error storing file in S3:", error);
    return false;
  }
}

export async function getFileUrl(filePath: string): Promise<string> {
  if (storageType === "s3") {
    // Generate a pre-signed URL for S3 (implementation depends on your setup)
    return `${process.env.S3_PUBLIC_URL || ""}/${filePath}`;
  } else {
    // For local storage, return a relative URL
    return `/api/download/${encodeURIComponent(filePath)}`;
  }
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    if (storageType === "s3") {
      // Implementation for S3 would depend on your specific needs
      return true; // Placeholder
    } else {
      const fullPath = path.join(localStoragePath, filePath);
      return fs.existsSync(fullPath);
    }
  } catch (error) {
    console.error("Error checking if file exists:", error);
    return false;
  }
}

export async function getMetadata(
  filePath: string,
): Promise<FileMetadata | null> {
  try {
    if (storageType === "s3") {
      // Implementation for S3 would depend on your specific needs
      return null; // Placeholder
    } else {
      const metadataPath = path.join(localStoragePath, `${filePath}.meta.json`);
      if (fs.existsSync(metadataPath)) {
        const data = await promisify(fs.readFile)(metadataPath, "utf8");
        return JSON.parse(data);
      }
      return null;
    }
  } catch (error) {
    console.error("Error getting metadata:", error);
    return null;
  }
}

export async function getFileStream(filePath: string) {
  if (storageType === "s3") {
    if (!s3Client) throw new Error("S3 client not initialized");

    const command = new GetObjectCommand({
      Bucket: s3BucketName,
      Key: filePath,
    });

    const response = await s3Client.send(command);
    return response.Body;
  } else {
    const fullPath = path.join(localStoragePath, filePath);
    return createReadStream(fullPath);
  }
}
