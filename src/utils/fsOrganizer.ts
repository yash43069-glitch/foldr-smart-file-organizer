import {
  AugmentedDataTransferItem,
  AugmentedDirectoryHandle,
  BrowserCompatibilityInfo,
  CategoryName,
  LogEntry,
  MoveResult,
  OrganizeResult,
  PlannedMove,
  PreviewResult,
  ScanResult,
  ScannedFile,
} from '../types/foldr';
import { categorizeFilename, emptyCategoryCounts } from './categories';

let activeOperationLock = false;

function makeLog(
  level: LogEntry['level'],
  action: LogEntry['action'],
  message: string,
  extra?: Partial<Pick<LogEntry, 'filename' | 'sourcePath' | 'destinationPath'>>,
): LogEntry {
  const timestamp = new Date().toISOString();
  return {
    id: `${timestamp}-${Math.random().toString(36).slice(2, 9)}`,
    timestamp,
    level,
    action,
    message,
    ...extra,
  };
}

export function getBrowserCompatibility(): BrowserCompatibilityInfo {
  if (typeof window === 'undefined') {
    return {
      supported: false,
      secureContext: false,
      inIframe: false,
      reason: 'Browser window is unavailable.',
    };
  }

  const secureContext = Boolean(window.isSecureContext);
  let inIframe = false;
  try {
    inIframe = window.self !== window.top;
  } catch {
    inIframe = true;
  }

  const hasPicker = typeof window.showDirectoryPicker === 'function';

  if (!hasPicker) {
    return {
      supported: false,
      secureContext,
      inIframe,
      reason:
        'Your browser does not support the File System Access API (showDirectoryPicker). Please use desktop Google Chrome or Microsoft Edge.',
    };
  }

  if (!secureContext) {
    return {
      supported: false,
      secureContext,
      inIframe,
      reason:
        'Folder access requires a secure HTTPS context (or localhost during local development).',
    };
  }

  if (inIframe) {
    return {
      supported: true,
      secureContext,
      inIframe: true,
      reason:
        'Foldr is running inside an embedded preview frame. Some browsers block native folder pickers inside cross-origin iframes—open Foldr in a standalone browser tab for full folder access.',
    };
  }

  return {
    supported: true,
    secureContext,
    inIframe: false,
    reason: null,
  };
}

export async function ensureReadWritePermission(
  dirHandle: FileSystemDirectoryHandle,
): Promise<boolean> {
  const handle = dirHandle as AugmentedDirectoryHandle;
  if (typeof handle.queryPermission === 'function') {
    const current = await handle.queryPermission({ mode: 'readwrite' });
    if (current === 'granted') return true;
  }
  if (typeof handle.requestPermission === 'function') {
    const requested = await handle.requestPermission({ mode: 'readwrite' });
    return requested === 'granted';
  }
  return true;
}

export async function pickDirectoryHandle(): Promise<
  | { status: 'selected'; handle: FileSystemDirectoryHandle }
  | { status: 'cancelled' }
> {
  if (typeof window === 'undefined' || typeof window.showDirectoryPicker !== 'function') {
    throw new Error(
      'The File System Access API is unavailable in this browser. Use desktop Google Chrome or Microsoft Edge over HTTPS.',
    );
  }

  try {
    const dirHandle = await window.showDirectoryPicker({
      id: 'foldr-workspace-folder',
      mode: 'readwrite',
    });

    const granted = await ensureReadWritePermission(dirHandle);
    if (!granted) {
      throw new Error(
        `Read and write permission was denied for "${dirHandle.name}". Foldr needs folder permission to scan and move files safely.`,
      );
    }

    return { status: 'selected', handle: dirHandle };
  } catch (err) {
    if (err instanceof DOMException) {
      if (err.name === 'AbortError') {
        return { status: 'cancelled' };
      }
      if (err.name === 'SecurityError') {
        throw new Error(
          'Browser security blocked the folder picker inside this embedded frame. Open Foldr in a new standalone Chrome or Edge tab over HTTPS.',
        );
      }
      if (err.name === 'NotAllowedError') {
        throw new Error(
          'Folder access permission was denied. Please allow read and write access when prompted.',
        );
      }
    }
    throw err instanceof Error ? err : new Error(String(err));
  }
}

export async function extractDroppedDirectoryHandle(
  dataTransfer: DataTransfer,
): Promise<FileSystemDirectoryHandle | null> {
  const items = Array.from(dataTransfer.items ?? []);
  for (const item of items) {
    const aug = item as AugmentedDataTransferItem;
    if (typeof aug.getAsFileSystemHandle === 'function') {
      const handle = await aug.getAsFileSystemHandle();
      if (handle && handle.kind === 'directory') {
        const dirHandle = handle as FileSystemDirectoryHandle;
        const granted = await ensureReadWritePermission(dirHandle);
        if (!granted) {
          throw new Error(`Read/write permission denied for dropped folder "${dirHandle.name}".`);
        }
        return dirHandle;
      }
    }
  }
  return null;
}

function splitFilename(filename: string): { stem: string; suffix: string } {
  const dot = filename.lastIndexOf('.');
  if (dot <= 0) {
    return { stem: filename, suffix: '' };
  }
  return { stem: filename.slice(0, dot), suffix: filename.slice(dot) };
}

async function fileExistsInDirectory(
  dirHandle: FileSystemDirectoryHandle,
  filename: string,
): Promise<boolean> {
  try {
    await dirHandle.getFileHandle(filename, { create: false });
    return true;
  } catch (err) {
    if (err instanceof DOMException && err.name === 'NotFoundError') {
      return false;
    }
    // Check if a directory with the same name exists so we never collide
    try {
      await dirHandle.getDirectoryHandle(filename, { create: false });
      return true;
    } catch {
      return false;
    }
  }
}

async function getSubdirectoryIfExists(
  rootHandle: FileSystemDirectoryHandle,
  category: CategoryName,
  subfolder: string | null,
): Promise<FileSystemDirectoryHandle | null> {
  try {
    const catDir = await rootHandle.getDirectoryHandle(category, { create: false });
    if (subfolder) {
      return await catDir.getDirectoryHandle(subfolder, { create: false });
    }
    return catDir;
  } catch {
    return null;
  }
}

async function getOrCreateTargetDirectory(
  rootHandle: FileSystemDirectoryHandle,
  category: CategoryName,
  subfolder: string | null,
): Promise<FileSystemDirectoryHandle> {
  const catDir = await rootHandle.getDirectoryHandle(category, { create: true });
  if (subfolder) {
    return await catDir.getDirectoryHandle(subfolder, { create: true });
  }
  return catDir;
}

async function resolveUniqueFilename(
  destDirHandle: FileSystemDirectoryHandle | null,
  filename: string,
  reservedLowerNames: Set<string>,
): Promise<{ resolvedName: string; hasConflict: boolean }> {
  const isTaken = async (candidate: string): Promise<boolean> => {
    const key = candidate.toLowerCase();
    if (reservedLowerNames.has(key)) return true;
    if (destDirHandle) {
      return await fileExistsInDirectory(destDirHandle, candidate);
    }
    return false;
  };

  if (!(await isTaken(filename))) {
    reservedLowerNames.add(filename.toLowerCase());
    return { resolvedName: filename, hasConflict: false };
  }

  const { stem, suffix } = splitFilename(filename);
  let index = 1;
  while (true) {
    const numbered = `${stem} (${index})${suffix}`;
    if (!(await isTaken(numbered))) {
      reservedLowerNames.add(numbered.toLowerCase());
      return { resolvedName: numbered, hasConflict: true };
    }
    index += 1;
  }
}

export async function scanDirectoryHandle(
  rootHandle: FileSystemDirectoryHandle,
): Promise<ScanResult> {
  const granted = await ensureReadWritePermission(rootHandle);
  if (!granted) {
    throw new Error(`Permission denied for folder "${rootHandle.name}".`);
  }

  const augHandle = rootHandle as AugmentedDirectoryHandle;
  const logs: LogEntry[] = [
    makeLog('INFO', 'SCAN', `Started non-recursive scan of "${rootHandle.name}"`),
  ];

  const files: ScannedFile[] = [];
  const categoryCounts = emptyCategoryCounts();
  const categorySizes = emptyCategoryCounts();
  const documentSubfolderCounts = { PDF: 0, Word: 0, Text: 0 };

  let skippedDirectories = 0;
  let skippedUnsupported = 0;
  let permissionErrors = 0;
  let totalSizeBytes = 0;

  for await (const [name, entry] of augHandle.entries()) {
    try {
      if (entry.kind === 'directory') {
        skippedDirectories += 1;
        continue;
      }
      if (entry.kind !== 'file') {
        skippedUnsupported += 1;
        logs.push(makeLog('WARNING', 'SKIP', `Skipped unsupported entry "${name}"`, { filename: name }));
        continue;
      }

      const fileHandle = entry as FileSystemFileHandle;
      const fileObj = await fileHandle.getFile();
      const { category, subfolder, extension } = categorizeFilename(name);

      files.push({
        filename: name,
        sourcePath: `${rootHandle.name}/${name}`,
        extension,
        category,
        subfolder,
        sizeBytes: fileObj.size,
        lastModified: fileObj.lastModified,
        handle: fileHandle,
      });

      categoryCounts[category] += 1;
      categorySizes[category] += fileObj.size;
      totalSizeBytes += fileObj.size;

      if (category === 'Documents' && (subfolder === 'PDF' || subfolder === 'Word' || subfolder === 'Text')) {
        documentSubfolderCounts[subfolder] += 1;
      }
    } catch (err) {
      permissionErrors += 1;
      const msg = err instanceof Error ? err.message : String(err);
      logs.push(
        makeLog('ERROR', 'ERROR', `Failed to read "${name}": ${msg}`, {
          filename: name,
          sourcePath: `${rootHandle.name}/${name}`,
        }),
      );
    }
  }

  files.sort((a, b) => a.filename.localeCompare(b.filename, undefined, { sensitivity: 'base' }));

  logs.push(
    makeLog(
      'SUCCESS',
      'SCAN',
      `Scan complete: ${files.length} file(s) ready, ${skippedDirectories} subfolder(s) untouched.`,
    ),
  );

  return {
    directoryName: rootHandle.name,
    scannedAt: new Date().toISOString(),
    totalFiles: files.length,
    filesToOrganize: files.length,
    totalSizeBytes,
    skippedDirectories,
    skippedUnsupported,
    permissionErrors,
    categoryCounts,
    categorySizes,
    documentSubfolderCounts,
    files,
    logs,
  };
}

export async function previewDirectoryOrganization(
  rootHandle: FileSystemDirectoryHandle,
  scannedFiles: ScannedFile[],
  selectedFilenames?: Set<string>,
): Promise<PreviewResult> {
  const logs: LogEntry[] = [
    makeLog('INFO', 'PREVIEW', `Generating non-destructive organization preview for "${rootHandle.name}"`),
  ];

  const reservedPerTarget = new Map<string, Set<string>>();
  const destDirCache = new Map<string, FileSystemDirectoryHandle | null>();

  const plan: PlannedMove[] = [];
  const categorySummary = emptyCategoryCounts();
  let conflictsResolved = 0;
  let totalSizeBytes = 0;

  for (const item of scannedFiles) {
    if (selectedFilenames && !selectedFilenames.has(item.filename)) {
      continue;
    }

    const folderKey = item.subfolder ? `${item.category}/${item.subfolder}` : item.category;
    if (!destDirCache.has(folderKey)) {
      const existingDir = await getSubdirectoryIfExists(rootHandle, item.category, item.subfolder);
      destDirCache.set(folderKey, existingDir);
    }
    if (!reservedPerTarget.has(folderKey)) {
      reservedPerTarget.set(folderKey, new Set());
    }

    const destHandle = destDirCache.get(folderKey) ?? null;
    const reservedSet = reservedPerTarget.get(folderKey)!;

    const { resolvedName, hasConflict } = await resolveUniqueFilename(
      destHandle,
      item.filename,
      reservedSet,
    );

    const relativeDestination = `${folderKey}/${resolvedName}`;
    if (hasConflict) {
      conflictsResolved += 1;
      logs.push(
        makeLog(
          'WARNING',
          'CONFLICT',
          `Filename conflict for "${item.filename}" → auto-numbered as "${relativeDestination}"`,
          {
            filename: item.filename,
            sourcePath: item.sourcePath,
            destinationPath: `${rootHandle.name}/${relativeDestination}`,
          },
        ),
      );
    }

    categorySummary[item.category] += 1;
    totalSizeBytes += item.sizeBytes;

    plan.push({
      filename: item.filename,
      resolvedFilename: resolvedName,
      sourcePath: item.sourcePath,
      relativeDestination,
      category: item.category,
      subfolder: item.subfolder,
      extension: item.extension,
      sizeBytes: item.sizeBytes,
      hasConflict,
      status: hasConflict ? 'CONFLICT_RESOLVED' : 'READY',
    });
  }

  logs.push(
    makeLog(
      'SUCCESS',
      'PREVIEW',
      `Preview ready: ${plan.length} file(s) mapped, ${conflictsResolved} conflict(s) resolved.`,
    ),
  );

  return {
    directoryName: rootHandle.name,
    generatedAt: new Date().toISOString(),
    totalPlanned: plan.length,
    conflictsResolved,
    totalSizeBytes,
    categorySummary,
    plan,
    logs,
  };
}

export async function organizeDirectoryFiles(
  rootHandle: FileSystemDirectoryHandle,
  scannedFiles: ScannedFile[],
  selectedFilenames: Set<string>,
  confirmed: boolean,
  onProgress?: (completed: number, total: number, currentFilename: string) => void,
): Promise<OrganizeResult> {
  if (!confirmed) {
    throw new Error('Explicit user confirmation is required before organizing files.');
  }
  if (activeOperationLock) {
    throw new Error('An organization operation is already in progress.');
  }

  activeOperationLock = true;
  try {
    const granted = await ensureReadWritePermission(rootHandle);
    if (!granted) {
      throw new Error(`Write permission denied for folder "${rootHandle.name}".`);
    }

    const logs: LogEntry[] = [
      makeLog('INFO', 'ORGANIZE', `Started confirmed organization in "${rootHandle.name}"`),
    ];

    const filesToMove = scannedFiles.filter((f) => selectedFilenames.has(f.filename));
    const skippedCount = scannedFiles.length - filesToMove.length;

    const results: MoveResult[] = [];
    let organizedCount = 0;
    let failedCount = 0;
    let conflictsResolved = 0;
    let movedBytes = 0;

    for (let i = 0; i < filesToMove.length; i += 1) {
      const item = filesToMove[i];
      onProgress?.(i, filesToMove.length, item.filename);

      try {
        // Re-fetch current source handle to verify file still exists at root
        const sourceHandle = await rootHandle.getFileHandle(item.filename, { create: false });
        const sourceFile = await sourceHandle.getFile();

        const destDirHandle = await getOrCreateTargetDirectory(
          rootHandle,
          item.category,
          item.subfolder,
        );

        const { resolvedName, hasConflict } = await resolveUniqueFilename(
          destDirHandle,
          item.filename,
          new Set<string>(),
        );

        // Create destination file (new unique name guaranteed not to overwrite)
        const destFileHandle = await destDirHandle.getFileHandle(resolvedName, { create: true });
        const writable = await destFileHandle.createWritable();

        try {
          await sourceFile.stream().pipeTo(writable);
        } catch (writeErr) {
          try {
            await writable.abort();
          } catch {
            // Ignore abort failure
          }
          // Clean up incomplete destination file if possible, NEVER touching source
          try {
            await destDirHandle.removeEntry(resolvedName);
          } catch {
            // Ignore cleanup failure
          }
          throw writeErr;
        }

        // Verify destination write integrity BEFORE removing original source file
        const writtenFile = await destFileHandle.getFile();
        if (writtenFile.size !== sourceFile.size) {
          try {
            await destDirHandle.removeEntry(resolvedName);
          } catch {
            // Ignore cleanup failure
          }
          throw new Error(
            `Write verification failed for "${item.filename}" (expected ${sourceFile.size} bytes, wrote ${writtenFile.size} bytes). Original file preserved.`,
          );
        }

        // Safe to remove original source entry only after verified write
        await rootHandle.removeEntry(item.filename);

        const relDest = item.subfolder
          ? `${item.category}/${item.subfolder}/${resolvedName}`
          : `${item.category}/${resolvedName}`;

        organizedCount += 1;
        movedBytes += sourceFile.size;
        if (hasConflict) conflictsResolved += 1;

        results.push({
          filename: item.filename,
          finalFilename: resolvedName,
          relativeDestination: relDest,
          category: item.category,
          subfolder: item.subfolder,
          sizeBytes: sourceFile.size,
          hadConflict: hasConflict,
          status: 'MOVED',
          error: null,
        });

        logs.push(
          makeLog(
            'SUCCESS',
            'ORGANIZE',
            `Moved "${item.filename}" → "${relDest}"${hasConflict ? ' (conflict auto-numbered)' : ''}`,
            {
              filename: item.filename,
              sourcePath: item.sourcePath,
              destinationPath: `${rootHandle.name}/${relDest}`,
            },
          ),
        );
      } catch (err) {
        failedCount += 1;
        const msg = err instanceof Error ? err.message : String(err);
        results.push({
          filename: item.filename,
          finalFilename: item.filename,
          relativeDestination: null,
          category: item.category,
          subfolder: item.subfolder,
          sizeBytes: item.sizeBytes,
          hadConflict: false,
          status: 'FAILED',
          error: msg,
        });
        logs.push(
          makeLog('ERROR', 'ERROR', `Failed to organize "${item.filename}": ${msg}`, {
            filename: item.filename,
            sourcePath: item.sourcePath,
          }),
        );
      }
    }

    onProgress?.(filesToMove.length, filesToMove.length, 'Complete');

    logs.push(
      makeLog(
        failedCount === 0 ? 'SUCCESS' : 'WARNING',
        'ORGANIZE',
        `Organization complete: ${organizedCount} moved, ${conflictsResolved} renamed, ${failedCount} error(s).`,
      ),
    );

    return {
      directoryName: rootHandle.name,
      completedAt: new Date().toISOString(),
      organizedCount,
      failedCount,
      skippedCount,
      conflictsResolved,
      movedBytes,
      results,
      logs,
    };
  } finally {
    activeOperationLock = false;
  }
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const idx = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, idx);
  return `${value >= 100 || idx === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[idx]}`;
}

export function formatTimeShort(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], {
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return iso;
  }
}
