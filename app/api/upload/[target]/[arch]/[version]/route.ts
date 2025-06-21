import { extractBearerToken, validateAuthToken } from "@/lib/auth";
import { FileMetadata, storeFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";

// release.omnial.app/api/upload/[target]/[arch]/[version]
// release.omnial.app/api/upload/macos/arm64/1.0.0

export async function POST(
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
    
    // Extract format from query parameters
    const url = new URL(req.url);


    // Validate parameters
    if (!target || !arch || !version) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    // Extract metadata from headers
    const signature = req.headers.get("x-signature") || "";
    const publishDate = req.headers.get("x-pub-date") || new Date().toISOString();
    const notesBase64 = req.headers.get("x-notes") || "";

    // Decode notes from base64
    const notes = notesBase64
      ? Buffer.from(notesBase64, "base64").toString()
      : "";

    // Get the file from the request
    const formData = await req.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    // Read the file
    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const filename = file.name;

    // Store the file
    const filePath = `${target}/${arch}/${version}/${filename}`;
    const metadata: FileMetadata = {
      signature,
      publishDate,
      notes,
    };

    const success = await storeFile(filePath, fileBuffer, metadata);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to store file" },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      message: "File uploaded successfully",
      filePath,
    });
  } catch (error) {
    console.error("Error handling upload:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
} 