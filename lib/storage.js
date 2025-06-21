/**
 * Storage utilities for the release server worker
 */

import { S3Client, ListObjectsV2Command, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';

// Create S3 client for R2
export function createS3Client() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID || '',
      secretAccessKey: env.R2_SECRET_ACCESS_KEY || '',
    },
  });
}

// Get bucket name from environment variables
export function getBucketName() {
  return env.R2_BUCKET_NAME || 'release-server-bucket';
}

/**
 * Get the filename of an update file in a directory
 * @param {string} dirPath - The directory path to search in
 * @returns {Promise<string|null>} - The filename, or null if not found
 */
export async function getUpdateFileName(dirPath) {
  try {
    const s3Client = createS3Client();
    const bucketName = getBucketName();
    
    // List objects in the R2 bucket with the appropriate prefix
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: dirPath + '/'
    });
    
    const response = await s3Client.send(command);
    
    if (!response.Contents || response.Contents.length === 0) {
      return null;
    }
    
    // Return any file found in the directory
    const updateFile = response.Contents
      .map(item => item.Key?.split('/').pop() || '')
      .find(file => file !== '');
      
    return updateFile || null;
  } catch (error) {
    console.error("Error getting update file name:", error);
    return null;
  }
}

/**
 * Upload a file to storage
 * @param {string} filePath - The path to store the file at
 * @param {ArrayBuffer} fileContent - The file content
 * @param {string} contentType - The content type of the file
 * @param {Object} metadata - Metadata to store with the file
 * @returns {Promise<boolean>} - Whether the upload was successful
 */
export async function uploadFile(filePath, fileContent, contentType, metadata = {}) {
  try {
    const s3Client = createS3Client();
    const bucketName = getBucketName();
    
    const command = new PutObjectCommand({
      Bucket: bucketName,
      Key: filePath,
      Body: fileContent,
      ContentType: contentType,
      Metadata: metadata
    });
    
    await s3Client.send(command);
    return true;
  } catch (error) {
    console.error("Error uploading file:", error);
    return false;
  }
}

/**
 * Get a file from storage
 * @param {string} filePath - The path of the file to get
 * @returns {Promise<Object|null>} - The file response, or null if not found
 */
export async function getFile(filePath) {
  try {
    const s3Client = createS3Client();
    const bucketName = getBucketName();
    
    const command = new GetObjectCommand({
      Bucket: bucketName,
      Key: filePath
    });
    
    return await s3Client.send(command);
  } catch (error) {
    console.error("Error getting file:", error);
    return null;
  }
}

/**
 * List directories in a path
 * @param {string} prefix - The prefix to list directories for
 * @returns {Promise<string[]>} - Array of directory names
 */
export async function listDirectories(prefix) {
  try {
    const s3Client = createS3Client();
    const bucketName = getBucketName();
    
    const command = new ListObjectsV2Command({
      Bucket: bucketName,
      Prefix: prefix,
      Delimiter: '/'
    });
    
    const response = await s3Client.send(command);
    
    if (!response.CommonPrefixes || response.CommonPrefixes.length === 0) {
      return [];
    }
    
    // Extract directory names from the prefixes
    return response.CommonPrefixes
      .map(prefix => prefix.Prefix?.split('/').filter(Boolean).pop() || '')
      .filter(Boolean);
  } catch (error) {
    console.error("Error listing directories:", error);
    return [];
  }
} 