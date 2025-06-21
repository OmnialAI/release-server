import { fileExists, getFileStream } from "@/lib/storage";
import { extractBearerToken, validateAuthToken } from "@/lib/auth";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { Readable } from "stream";

// Add missing TransformStream import
import { TransformStream } from "stream/web";

// release.omnial.app/api/download/macos/arm64/1.0.0/filename.txt

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  try {
    console.log("Download request received:", req.url);
    console.log("Path parameters:", params.path);
    
    // Authenticate request
    const authHeader = req.headers.get("authorization");
    const token = extractBearerToken(authHeader);
    
    if (!token || !validateAuthToken(token)) {
      console.log("Authentication failed");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Join path segments to form the file path
    const filePath = params.path.join("/");
    console.log("File path:", filePath);

    // Check if file exists
    const exists = await fileExists(filePath);
    console.log("File exists:", exists);
    
    if (!exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get file stream
    const fileStream = await getFileStream(filePath);
    console.log("Got file stream:", !!fileStream);

    // Convert stream to Response
    if (!fileStream) {
      return NextResponse.json(
        { error: "Failed to read file" },
        { status: 500 },
      );
    }

    // Get filename from the path
    const filename = params.path[params.path.length - 1];

    // Set appropriate content type based on file extension
    const extension = path.extname(filename).toLowerCase();
    let contentType = "application/octet-stream";

    if (extension === ".gz" || extension === ".tar.gz") {
      contentType = "application/gzip";
    } else if (extension === ".dmg") {
      contentType = "application/x-apple-diskimage";
    } else if (extension === ".zip") {
      contentType = "application/zip";
    } else if (extension === ".txt") {
      contentType = "text/plain";
    }
    
    console.log("Content type:", contentType);

    // For text files, return a simple text response for testing
    if (extension === ".txt" && fileStream.transformToString) {
      try {
        const textContent = await fileStream.transformToString();
        console.log("Text content length:", textContent.length);
        return new NextResponse(textContent, {
          headers: {
            "Content-Type": contentType,
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        });
      } catch (err) {
        console.error("Error converting stream to text:", err);
      }
    }

    // Convert Node.js readable stream to Web stream
    const transformStream = new TransformStream();
    const writer = transformStream.writable.getWriter();

    if (fileStream instanceof Readable) {
      console.log("Using Node.js stream handling");
      // Node.js stream
      fileStream.on("data", (chunk: Buffer) => {
        writer.write(chunk);
      });

      fileStream.on("end", () => {
        writer.close();
      });

      fileStream.on("error", (err: Error) => {
        console.error("Error streaming file:", err);
        writer.abort(err);
      });
    } else {
      console.log("Using AWS SDK stream handling");
      // AWS SDK stream
      const reader = fileStream.transformToWebStream().getReader();

      const pump = async () => {
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            await writer.write(value);
          }
          await writer.close();
        } catch (err) {
          await writer.abort(err as Error);
        }
      };

      pump();
    }

    console.log("Returning response with stream");
    // Return the response with the stream
    return new NextResponse(transformStream.readable as unknown as ReadableStream, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${filename}"`,
      },
    });
  } catch (error) {
    console.error("Error serving file:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
} 