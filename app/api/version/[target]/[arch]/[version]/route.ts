import { getLatestVersion } from "@/lib/version";
import { NextRequest, NextResponse } from "next/server";
import { extractBearerToken, validateAuthToken } from "@/lib/auth";

// release.omnial.app/api/version/[target]/[arch]/[current_version]
// release.omnial.app/api/version/macos/arm64/1.0.0

export async function GET(
  req: NextRequest,
  { params }: { params: { target: string; arch: string; version: string } }
) {
  try {
    // Authenticate request
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token || !validateAuthToken(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const { target, arch, version } = params;

    // Validate parameters
    if (!target || !arch || !version) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    // Get the latest version
    const latestVersion = await getLatestVersion(target, arch, version);

    if (!latestVersion) {
      return NextResponse.json({
        version: version,
        message: "No updates available",
      });
    }

    // Format response according to Tauri updater requirements
    const baseUrl = process.env.BASE_URL || req.nextUrl.origin;

    return NextResponse.json({
      version: latestVersion.version,
      pub_date: latestVersion.date,
      url: `${baseUrl}${latestVersion.url}`,
      signature: latestVersion.signature,
      notes: latestVersion.notes,
      current_version: version,
      target: target,
    });
  } catch (error) {
    console.error("Error checking for updates:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
} 