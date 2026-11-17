# Foldr — Smart File Organizer

> **A place for everything.**  
> Your files. Your space. Beautifully organized.

## Project Overview

**Foldr** is a serverless, privacy-first web application that organizes scattered files inside a user-authorized local directory directly in the browser. It preserves a clean single-page SaaS workflow—letting you select a folder, inspect files and sizes, preview proposed destinations, resolve duplicate filenames safely, and move files into structured category folders with zero backend servers or cloud uploads.

---

## Features

- **Native Browser Folder Selection**: Authorizes a local directory via `window.showDirectoryPicker({ mode: "readwrite" })` or drag-and-drop folder handles (`getAsFileSystemHandle()`).
- **Non-Recursive Directory Scanning**: Reads top-level files only, displaying file names, extensions, byte sizes, and categories while leaving existing subdirectories untouched.
- **8 Smart Categories + Document Subfolders**:
  - `Documents/` → `PDF/` (`.pdf`), `Word/` (`.doc`, `.docx`, `.rtf`, `.odt`), `Text/` (`.txt`)
  - `Images/` → `.jpg`, `.jpeg`, `.png`, `.gif`, `.bmp`, `.webp`, `.svg`, `.ico`, `.tiff`
  - `Videos/` → `.mp4`, `.mkv`, `.mov`, `.avi`, `.wmv`, `.webm`
  - `Audio/` → `.mp3`, `.wav`, `.aac`, `.flac`, `.ogg`, `.m4a`
  - `Archives/` → `.zip`, `.rar`, `.7z`, `.tar`, `.gz`
  - `Applications/` → `.exe`, `.msi`, `.apk`
  - `Spreadsheets/` → `.xls`, `.xlsx`, `.csv`, `.ods`
  - `Others/` → Unknown extensions and extensionless files
- **Dry-Run Preview & Selective Organization**: Check or uncheck individual files, filter by category or search term, and inspect exact destination paths before moving anything.
- **Verified Safe Movement**: Streams files into destination handles via `createWritable()`, verifies the written destination byte count matches the source file before calling `removeEntry()`, and auto-numbers collisions (e.g. `image (1).png`) so existing files are never overwritten.
- **Live Activity Console & Export**: Records timestamped scans, previews, conflict resolutions, verified moves, and errors, with one-click JSON log export and downloadable project ZIP export.

---

## Technology Stack

- **Frontend Framework**: React 19 + TypeScript
- **Build Tool**: Vite 8
- **Styling**: Tailwind CSS v4 + Manrope typography
- **Icons**: Lucide React
- **Browser Storage/Filesystem API**: File System Access API (`FileSystemDirectoryHandle`, `FileSystemFileHandle`, `createWritable`, `removeEntry`)
- **Packaging**: JSZip (client-side project export)
- **Hosting**: Static frontend on Vercel (no backend, no database, no serverless API functions)

---

## Architecture Explanation

Foldr runs **100% client-side** as a static single-page React application:

1. **Zero Backend**: There is no Python, FastAPI, Node.js, or database layer. Static HTML, CSS, and JavaScript assets are served directly from Vercel's CDN.
2. **Direct Browser File Access**: Clicking **Browse Folder** calls `window.showDirectoryPicker({ mode: "readwrite" })`, prompting the browser's native OS permission dialog.
3. **Safe Move Pipeline (`src/utils/fsOrganizer.ts`)**:
   - Reads top-level entries from the authorized `FileSystemDirectoryHandle` (skipping directories).
   - Computes target folders and unique non-conflicting filenames during **Preview**.
   - During **Organize**, opens destination handles with `getFileHandle(uniqueName, { create: true })`, pipes the source `File.stream()` to `createWritable()`, reads back `destHandle.getFile()` to verify `writtenFile.size === sourceFile.size`, and **only then** calls `rootHandle.removeEntry(filename)`. If any write or verification step fails, the original file is preserved untouched.

---

## Browser Compatibility

The File System Access API requires:
- **Supported**: Desktop **Google Chrome** (86+) and **Microsoft Edge** (86+) over **HTTPS** (or `http://localhost` during development).
- **Unsupported**: Firefox, Safari, and mobile browsers do not expose `window.showDirectoryPicker` with read/write directory mutation. Foldr automatically detects support and displays a clear compatibility message instead of faking operations.
- **Embedded Iframes**: Cross-origin iframes may block `showDirectoryPicker` via browser `SecurityError`. Open the deployed HTTPS URL in a top-level browser tab.

---

## Local Setup Instructions

### Prerequisites
- **Node.js 18+** and **npm**

### Install & Run
```bash
npm install
npm run dev
```
Open `http://localhost:3000` in desktop Chrome or Microsoft Edge.

---

## Build Instructions

Verify TypeScript types and create the production static bundle in `dist/`:

```bash
npm run lint
npm run build
npm run preview
```

---

## Vercel Deployment Instructions

1. Push this repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Deploy Foldr serverless web app"
   git branch -M main
   git remote add origin https://github.com/<your-username>/foldr-smart-file-organizer.git
   git push -u origin main
   ```
2. Sign in to [vercel.com](https://vercel.com) and click **Add New → Project**.
3. Import your GitHub repository.
4. Confirm settings (pre-configured in `vercel.json`):
   - **Framework Preset**: `Vite`
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Environment Variables**: None required.
5. Click **Deploy**. Vercel serves the app over HTTPS so the File System Access API works immediately.

---

## Privacy and Security Explanation

- **Permission-Based Access**: Foldr cannot inspect or modify any folder on your computer until you explicitly select it and approve your browser's read/write permission prompt.
- **Zero Data Transmission**: Files are processed strictly in-memory/on-disk on your device. No file contents, filenames, or folder paths are uploaded to any server or third-party service.
- **Non-Destructive Guarantees**: Existing files are never overwritten, subdirectories are never recursively modified, and original files are never removed unless the destination write succeeds and passes byte-size verification.

---

## Known Limitations

- **Browser Support**: Requires desktop Chrome or Microsoft Edge; Firefox, Safari, and mobile browsers lack full `showDirectoryPicker({ mode: "readwrite" })` support.
- **Cross-Device Move Behavior**: Because the File System Access API does not expose an atomic `rename/move` primitive across directories on all OS/browser builds, moving files streams bytes into the new folder, verifies file size, and removes the original entry—very large files (multi-GB videos/archives) take proportional disk copy time.
- **Top-Level Scope**: By design, Foldr organizes only direct files inside the selected folder and does not traverse nested subdirectories.
- **Browser Permission Prompts**: Refreshing the page clears the in-memory `FileSystemDirectoryHandle`, requiring you to re-select the folder on your next session.
