# Release Server API Usage Guide

This document provides instructions for using the release server API endpoints.

## Authentication

All endpoints require authentication using a Bearer token:

```
Authorization: Bearer alpha-tester
```

## API Endpoints

### Check for Updates

```
GET /api/version/{target}/{arch}/{version}
```

**Example:**
```bash
curl -X GET "https://release.omnial.app/api/version/macos/arm64/0.0.5" \
  -H "Authorization: Bearer alpha-tester"
```

**Response:**
```json
{
  "version": "1.0.1",
  "pub_date": "2025-06-21T14:52:06.329Z",
  "url": "https://release.omnial.app/api/download/macos/arm64/1.0.1/test-upload.txt",
  "signature": "test-signature",
  "notes": "Test upload via curl",
  "current_version": "0.0.5",
  "target": "macos"
}
```

### Download Release

```
GET /api/download/{target}/{arch}/{version}/{filename}
```

**Example:**
```bash
curl -X GET "https://release.omnial.app/api/download/macos/arm64/1.0.1/test-upload.txt" \
  -H "Authorization: Bearer alpha-tester" \
  --output downloaded-file.txt
```

### Upload Release

```
POST /api/upload/{target}/{arch}/{version}
```

**Example:**
```bash
curl -X POST "https://release.omnial.app/api/upload/macos/arm64/1.0.2" \
  -H "Authorization: Bearer alpha-tester" \
  -F "file=@path/to/your/file.zip" \
  -F "signature=your-signature-here" \
  -F "notes=Release notes for this version"
```

**Response:**
```json
{
  "success": true,
  "url": "https://release.omnial.app/api/download/macos/arm64/1.0.2/file.zip",
  "version": "1.0.2",
  "target": "macos",
  "arch": "arm64"
}
```

## Parameters

- `target`: Target platform (e.g., macos, windows, linux)
- `arch`: CPU architecture (e.g., arm64, x86_64)
- `version`: Version string using semantic versioning (e.g., 1.0.0)
- `filename`: Name of the file to download (only for download endpoint)

## File Upload Fields

- `file`: The binary file to upload (required)
- `signature`: Signature for the file (optional)
- `notes`: Release notes (optional) 