import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { promisify } from "util";


// R2 configuration
const s3Client = new S3Client({
        region: "auto",
        endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
        credentials: {
          accessKeyId: process.env.R2_ACCESS_KEY_ID || "",
          secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || "",
        },
      })

const s3BucketName = process.env.R2_BUCKET_NAME || "release-server-bucket";


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
    return await storeFileS3(filePath, fileBuffer, metadata);
  } catch (error) {
    console.error("Error storing file:", error);
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
    console.error("Error storing file in R2:", error);
    return false;
  }
}

export async function getFileUrl(filePath: string): Promise<string> {
  // Extract path components
  const pathParts = filePath.split('/');
  if (pathParts.length < 4) {
    throw new Error("Invalid file path format");
  }
  
  const target = pathParts[0];
  const arch = pathParts[1];
  const version = pathParts[2];
  const filename = pathParts[pathParts.length - 1];
  
  // Generate a URL using the new route structure
  return `${process.env.BASE_URL || ""}/api/download/${target}/${arch}/${version}/${filename}`;
}

export async function fileExists(filePath: string): Promise<boolean> {
  try {
    // Implementation for R2 storage check
    const command = new GetObjectCommand({
      Bucket: s3BucketName,
      Key: filePath,
    });
    
    try {
      await s3Client.send(command);
      return true;
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        return false;
      }
      throw error;
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
    // Get metadata from R2
    const command = new GetObjectCommand({
      Bucket: s3BucketName,
      Key: filePath,
    });
    
    const response = await s3Client.send(command);
    const metadata = response.Metadata;
    
    if (!metadata) {
      return null;
    }
    
    return {
      signature: metadata.signature || '',
      publishDate: metadata.publishdate || new Date().toISOString(),
      notes: metadata.notes ? Buffer.from(metadata.notes, 'base64').toString() : '',
    };
  } catch (error) {
    console.error("Error getting metadata:", error);
    return null;
  }
}

export async function getFileStream(filePath: string) {
  if (!s3Client) throw new Error("R2 client not initialized");

  const command = new GetObjectCommand({
    Bucket: s3BucketName,
    Key: filePath,
  });

  const response = await s3Client.send(command);
  return response.Body;
}
