export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname.slice(1); // Remove leading slash
    
    // Handle root path
    if (path === "") {
      return new Response("R2 Test API: Use /upload to upload files and /[filename] to download files");
    }
    
    // Handle upload endpoint
    if (path === "upload") {
      if (request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
      }
      
      try {
        const formData = await request.formData();
        const file = formData.get("file");
        
        if (!file) {
          return new Response("No file uploaded", { status: 400 });
        }
        
        const filename = formData.get("filename") || file.name || "unnamed-file";
        const buffer = await file.arrayBuffer();
        
        // Upload to R2
        await env.STORAGE.put(filename, buffer, {
          httpMetadata: {
            contentType: file.type,
          }
        });
        
        return new Response(`File ${filename} uploaded successfully!`);
      } catch (error) {
        return new Response(`Error uploading file: ${error.message}`, { status: 500 });
      }
    }
    
    // Handle download endpoint (any other path)
    try {
      const object = await env.STORAGE.get(path);
      
      if (object === null) {
        return new Response("File not found", { status: 404 });
      }
      
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set("etag", object.httpEtag);
      
      return new Response(object.body, {
        headers,
      });
    } catch (error) {
      return new Response(`Error retrieving file: ${error.message}`, { status: 500 });
    }
  }
}; 