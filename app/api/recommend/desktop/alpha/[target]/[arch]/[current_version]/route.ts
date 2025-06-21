import { getLatestVersion } from "@/lib/version";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  req: NextRequest,
  {
    params,
  }: { params: { target: string; arch: string; current_version: string } },
) {
  try {
    const { target, arch, current_version } = params;

    // Validate parameters
    if (!target || !arch || !current_version) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    // Get the latest version
    const latestVersion = await getLatestVersion(target, arch, current_version);

    if (!latestVersion) {
      return NextResponse.json({
        version: current_version,
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
      current_version: current_version,
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
