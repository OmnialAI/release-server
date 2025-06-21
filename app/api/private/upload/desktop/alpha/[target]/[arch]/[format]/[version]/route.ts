import { extractBearerToken, validateAuthToken } from "@/lib/auth";
import { FileMetadata, storeFile } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import { promisify } from "util";
import fs from "fs";
import path from "path";

// Disable body parsing, handle it manually
export const config = {
  api: {
    bodyParser: false,
  },
};

export async function POST(
  req: NextRequest,
  {
    params,
  }: {
    params: { target: string; arch: string; format: string; version: string };
  },
) {
  try {
    // Validate authentication
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);

    if (!token || !validateAuthToken(token)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Extract parameters
    const { target, arch, format, version } = params;

    // Validate parameters
    if (!target || !arch || !format || !version) {
      return NextResponse.json(
        { error: "Missing required parameters" },
        { status: 400 },
      );
    }

    // Extract metadata from headers
    const signature = req.headers.get("x-signature") || "";
    const publishDate =
      req.headers.get("x-pub-date") || new Date().toISOString();
    const notesBase64 = req.headers.get("x-notes") || "";

    // Decode notes from base64
    const notes = notesBase64
      ? Buffer.from(notesBase64, "base64").toString()
      : "";

    // Create a temporary directory for file upload
    const tmpDir = path.join(process.cwd(), "tmp");
    if (!fs.existsSync(tmpDir)) {
      fs.mkdirSync(tmpDir, { recursive: true });
    }

    // Parse the multipart form data
    const formData = await parseForm(req, tmpDir);

    if (!formData.files || !formData.files.file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const file = Array.isArray(formData.files.file)
      ? formData.files.file[0]
      : formData.files.file;

    // Read the file
    const fileBuffer = await promisify(fs.readFile)(file.filepath);

    // Store the file
    const filePath = `desktop/alpha/${target}/${arch}/${format}/${version}/${file.originalFilename}`;
    const metadata: FileMetadata = {
      signature,
      publishDate,
      notes,
    };

    const success = await storeFile(filePath, fileBuffer, metadata);

    // Clean up temporary file
    await promisify(fs.unlink)(file.filepath);

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

// Function to parse multipart form data
async function parseForm(req: NextRequest, tmpDir: string) {
  // Placeholder implementation
  // In a real app, you would use a library like formidable
  return { files: { file: { filepath: "", originalFilename: "" } } };
}
