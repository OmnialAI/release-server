# Omnial Release Server

A simple release server for the Omnial desktop application, built with Next.js. This server handles both uploading and downloading of application updates, compatible with Tauri's updater system.

## Features

- **Upload Endpoints**: Secure endpoints for uploading application builds
- **Update Check**: Endpoints for clients to check for updates
- **Download**: Secure file serving for updates
- **Admin Interface**: Simple UI to view and manage releases
- **Storage Options**: Local file system or S3-compatible storage

## Setup

1. Install dependencies:

   ```bash
   bun install
   ```

2. Configure environment variables:

   - Copy `env.local` to `.env.local` and update the values
   - Set storage configuration (local or S3)
   - Set authentication secrets

3. Run the development server:

   ```bash
   bun run dev
   ```

4. For production:
   ```bash
   bun run build
   bun run start
   ```

## API Endpoints

### Upload

- **POST** `/api/private/upload/desktop/alpha/{target}/{arch}/{format}/{version}`
  - Uploads a file for a specific target, architecture, format, and version
  - Requires Bearer token authentication
  - Headers:
    - `Authorization: Bearer <token>`
    - `x-signature`: File signature
    - `x-pub-date`: Publication date
    - `x-notes`: Base64-encoded release notes

### Update Check

- **GET** `/api/recommend/desktop/alpha/{target}/{arch}/{current_version}`
  - Checks for updates for a specific target, architecture, and current version
  - Returns update information if available

### Download

- **GET** `/api/download/{path}`
  - Downloads a file at the specified path
  - Handles streaming of large files

## Authentication

- Upload endpoints require a Bearer token for authentication
- The token is defined in the environment variables

## Admin Interface

- Visit `/admin` to view and manage releases
- Requires authentication with the same Bearer token

## Compatibility

This server is designed to work with:

- The Omnial desktop application's update system
- The `upload.sh` script for uploading builds
- Tauri's updater plugin

## Storage

The server supports two storage backends:

1. **Local File System**: Files are stored in the local file system
2. **S3-Compatible Storage**: Files are stored in an S3-compatible storage service

Configure the storage backend in the environment variables.
# release-server
