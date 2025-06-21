import { fileExists, getFileStream } from "@/lib/storage";
import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { Readable } from "stream";

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } },
) {
  try {
    // Join path segments
    const filePath = params.path.join("/");

    // Check if file exists
    const exists = await fileExists(filePath);
    if (!exists) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Get file stream
    const fileStream = await getFileStream(filePath);

    // Convert stream to Response
    if (!fileStream) {
      return NextResponse.json(
        { error: "Failed to read file" },
        { status: 500 },
      );
    }

    // Set appropriate content type based on file extension
    const extension = path.extname(filePath).toLowerCase();
    let contentType = "application/octet-stream";

    if (extension === ".gz" || extension === ".tar.gz") {
      contentType = "application/gzip";
    } else if (extension === ".dmg") {
      contentType = "application/x-apple-diskimage";
    } else if (extension === ".zip") {
      contentType = "application/zip";
    }

    // Convert Node.js readable stream to Web stream
    const transformStream = new TransformStream();
    const writer = transformStream.writable.getWriter();

    if (fileStream instanceof Readable) {
      // Node.js stream
      fileStream.on("data", (chunk) => {
        writer.write(chunk);
      });

      fileStream.on("end", () => {
        writer.close();
      });

      fileStream.on("error", (err) => {
        console.error("Error streaming file:", err);
        writer.abort(err);
      });
    } else {
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

    // Return the response with the stream
    return new NextResponse(transformStream.readable, {
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": `attachment; filename="${path.basename(filePath)}"`,
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
