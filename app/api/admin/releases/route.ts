import { extractBearerToken, validateAuthToken } from "@/lib/auth";
import { localStoragePath } from "@/lib/storage";
import fs from "fs";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { promisify } from "util";

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

  // Base path for releases
  const basePath = path.join(localStoragePath, "desktop", "alpha");

  // Check if directory exists
  if (!fs.existsSync(basePath)) {
    return releases;
  }

  // Get all targets
  const targets = await promisify(fs.readdir)(basePath);

  for (const target of targets) {
    const targetPath = path.join(basePath, target);
    if (!fs.statSync(targetPath).isDirectory()) continue;

    // Get all architectures
    const architectures = await promisify(fs.readdir)(targetPath);

    for (const arch of architectures) {
      const archPath = path.join(targetPath, arch);
      if (!fs.statSync(archPath).isDirectory()) continue;

      // Get all formats
      const formats = await promisify(fs.readdir)(archPath);

      for (const format of formats) {
        const formatPath = path.join(archPath, format);
        if (!fs.statSync(formatPath).isDirectory()) continue;

        // Get all versions
        const versions = await promisify(fs.readdir)(formatPath);

        for (const version of versions) {
          const versionPath = path.join(formatPath, version);
          if (!fs.statSync(versionPath).isDirectory()) continue;

          // Get metadata from the first file in this directory
          const files = await promisify(fs.readdir)(versionPath);

          if (files.length > 0) {
            const firstFile = files[0];
            const metadataPath = path.join(
              versionPath,
              `${firstFile}.meta.json`,
            );

            let publishDate = new Date().toISOString();

            if (fs.existsSync(metadataPath)) {
              try {
                const metadataContent = await promisify(fs.readFile)(
                  metadataPath,
                  "utf8",
                );
                const metadata = JSON.parse(metadataContent);
                publishDate = metadata.publishDate || publishDate;
              } catch (error) {
                console.error(`Error reading metadata for ${version}:`, error);
              }
            }

            releases.push({
              version,
              target,
              arch,
              format,
              publishDate,
            });
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
}
