# Simple Release Server

A simplified release server for software updates, built as a Cloudflare Worker. This server provides API endpoints for checking for updates, downloading updates, and uploading new releases.

## Features

- Version checking API endpoint
- File download API endpoint
- File upload API endpoint
- Authentication via bearer tokens
- Integration with Cloudflare R2 for file storage

## API Endpoints

### Version Check

```
GET /api/version/:target/:arch/:current_version
```

Checks if a newer version is available for the specified target, architecture, and current version.

**Headers:**
- `Authorization: Bearer <token>`

**Response:**
```json
{
  "version": "1.0.1",
  "pub_date": "2023-10-30T12:00:00Z",
  "url": "https://release.example.com/api/download/macos/arm64/1.0.1/app.zip",
  "signature": "signature-hash",
  "notes": "Release notes",
  "current_version": "1.0.0",
  "target": "macos"
}
```

### Download

```
GET /api/download/:target/:arch/:version/:filename
```

Downloads a specific release file.

**Headers:**
- `Authorization: Bearer <token>`

### Upload

```
POST /api/upload/:target/:arch/:version
```

Uploads a new release file.

**Headers:**
- `Authorization: Bearer <token>`
- `Content-Type: multipart/form-data`

**Form Data:**
- `file`: The release file
- `signature`: The signature for the file (optional)
- `notes`: Release notes (optional)

**Response:**
```json
{
  "success": true,
  "url": "https://release.example.com/api/download/macos/arm64/1.0.1/app.zip",
  "version": "1.0.1",
  "target": "macos",
  "arch": "arm64"
}
```

## Deployment

### Prerequisites

- [Node.js](https://nodejs.org/) (v16 or later)
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/)
- Cloudflare account with Workers and R2 enabled

### Setup

1. Clone this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Configure your Cloudflare account in Wrangler:
   ```
   npx wrangler login
   ```
4. Create an R2 bucket:
   ```
   npx wrangler r2 bucket create release-server-bucket
   ```
5. Update the environment variables in `wrangler.toml`:
   ```toml
   [vars]
   CLOUDFLARE_ACCOUNT_ID = "your-account-id"
   R2_ACCESS_KEY_ID = "your-access-key-id"
   R2_SECRET_ACCESS_KEY = "your-secret-access-key"
   R2_BUCKET_NAME = "release-server-bucket"
   AUTH_SECRET = "your-auth-secret"
   BASE_URL = "https://your-worker-url.workers.dev"
   ```

### Development

To run the server locally:

```
npm run dev
```

### Deployment

To deploy to Cloudflare Workers:

```
npm run deploy
```

## Authentication

The server uses bearer token authentication. The default token is `alpha-tester`, but you should change this in the environment variables for production use.

## File Structure

- `worker.js`: The main worker code
- `wrangler.toml`: Cloudflare Workers configuration
- `package.json`: Node.js dependencies

## Environment Variables

- `CLOUDFLARE_ACCOUNT_ID`: Your Cloudflare account ID
- `R2_ACCESS_KEY_ID`: R2 access key ID
- `R2_SECRET_ACCESS_KEY`: R2 secret access key
- `R2_BUCKET_NAME`: R2 bucket name
- `AUTH_SECRET`: Authentication token
- `BASE_URL`: Base URL for the server (optional)
