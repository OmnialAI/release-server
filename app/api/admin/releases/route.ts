import { extractBearerToken, validateAuthToken } from "@/lib/auth";
import { ListObjectsV2Command, GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { NextRequest, NextResponse } from "next/server";

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

interface Release {
  version: string;
  target: string;
  arch: string;
  format: string;
  publishDate: string;
}

export async function GET(req: NextRequest) {
  try {
    // Validate authentication
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);

    if (!token || !validateAuthToken(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const releases = await listReleases();
    return NextResponse.json({ releases });
  } catch (error) {
    console.error("Error listing releases:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}

async function listReleases(): Promise<Release[]> {
  const releases: Release[] = [];

  try {
    // List all objects with the desktop/alpha prefix
    const command = new ListObjectsV2Command({
      Bucket: s3BucketName,
      Prefix: "desktop/alpha/",
      Delimiter: "/"
    });

    const response = await s3Client.send(command);
    
    // Process the common prefixes (targets)
    if (response.CommonPrefixes) {
      for (const targetPrefix of response.CommonPrefixes) {
        const target = targetPrefix.Prefix?.split('/')[2];
        if (!target) continue;

        // List architectures for this target
        const archCommand = new ListObjectsV2Command({
          Bucket: s3BucketName,
          Prefix: `desktop/alpha/${target}/`,
          Delimiter: "/"
        });

        const archResponse = await s3Client.send(archCommand);
        
        if (archResponse.CommonPrefixes) {
          for (const archPrefix of archResponse.CommonPrefixes) {
            const arch = archPrefix.Prefix?.split('/')[3];
            if (!arch) continue;

            // List formats for this architecture
            const formatCommand = new ListObjectsV2Command({
              Bucket: s3BucketName,
              Prefix: `desktop/alpha/${target}/${arch}/`,
              Delimiter: "/"
            });

            const formatResponse = await s3Client.send(formatCommand);
            
            if (formatResponse.CommonPrefixes) {
              for (const formatPrefix of formatResponse.CommonPrefixes) {
                const format = formatPrefix.Prefix?.split('/')[4];
                if (!format) continue;

                // List versions for this format
                const versionCommand = new ListObjectsV2Command({
                  Bucket: s3BucketName,
                  Prefix: `desktop/alpha/${target}/${arch}/${format}/`,
                  Delimiter: "/"
                });

                const versionResponse = await s3Client.send(versionCommand);
                
                if (versionResponse.CommonPrefixes) {
                  for (const versionPrefix of versionResponse.CommonPrefixes) {
                    const version = versionPrefix.Prefix?.split('/')[5];
                    if (!version) continue;

                    // Get files for this version
                    const fileCommand = new ListObjectsV2Command({
                      Bucket: s3BucketName,
                      Prefix: `desktop/alpha/${target}/${arch}/${format}/${version}/`,
                    });

                    const fileResponse = await s3Client.send(fileCommand);
                    
                    if (fileResponse.Contents && fileResponse.Contents.length > 0) {
                      // Get metadata from the first file
                      const firstFile = fileResponse.Contents[0];
                      
                      if (firstFile.Key) {
                        const metadataCommand = new GetObjectCommand({
                          Bucket: s3BucketName,
                          Key: firstFile.Key
                        });
                        
                        try {
                          const metadataResponse = await s3Client.send(metadataCommand);
                          const metadata = metadataResponse.Metadata || {};
                          
                          releases.push({
                            version,
                            target,
                            arch,
                            format,
                            publishDate: metadata.publishdate || new Date().toISOString(),
                          });
                        } catch (error) {
                          console.error(`Error getting metadata for ${version}:`, error);
                          
                          // Still add the release with default publish date
                          releases.push({
                            version,
                            target,
                            arch,
                            format,
                            publishDate: new Date().toISOString(),
                          });
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }

    // Sort by version (newest first)
    releases.sort((a, b) => {
      return (
        new Date(b.publishDate).getTime() - new Date(a.publishDate).getTime()
      );
    });

    return releases;
  } catch (error) {
    console.error("Error listing releases from R2:", error);
    return [];
  }
}
