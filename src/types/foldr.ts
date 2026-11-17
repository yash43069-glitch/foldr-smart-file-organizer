export type CategoryName =
  | 'Documents'
  | 'Images'
  | 'Videos'
  | 'Audio'
  | 'Archives'
  | 'Applications'
  | 'Spreadsheets'
  | 'Others';

export interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
  action: 'SCAN' | 'PREVIEW' | 'ORGANIZE' | 'SKIP' | 'CONFLICT' | 'ERROR' | 'SYSTEM';
  message: string;
  filename?: string;
  sourcePath?: string;
  destinationPath?: string;
}

export interface ScannedFile {
  filename: string;
  sourcePath: string;
  extension: string;
  category: CategoryName;
  subfolder: string | null;
  sizeBytes: number;
  lastModified: number;
  handle: FileSystemFileHandle;
}

export interface ScanResult {
  directoryName: string;
  scannedAt: string;
  totalFiles: number;
  filesToOrganize: number;
  totalSizeBytes: number;
  skippedDirectories: number;
  skippedUnsupported: number;
  permissionErrors: number;
  categoryCounts: Record<CategoryName, number>;
  categorySizes: Record<CategoryName, number>;
  documentSubfolderCounts: {
    PDF: number;
    Word: number;
    Text: number;
  };
  files: ScannedFile[];
  logs: LogEntry[];
}

export interface PlannedMove {
  filename: string;
  resolvedFilename: string;
  sourcePath: string;
  relativeDestination: string;
  category: CategoryName;
  subfolder: string | null;
  extension: string;
  sizeBytes: number;
  hasConflict: boolean;
  status: 'READY' | 'CONFLICT_RESOLVED';
}

export interface PreviewResult {
  directoryName: string;
  generatedAt: string;
  totalPlanned: number;
  conflictsResolved: number;
  totalSizeBytes: number;
  categorySummary: Record<CategoryName, number>;
  plan: PlannedMove[];
  logs: LogEntry[];
}

export interface MoveResult {
  filename: string;
  finalFilename: string;
  relativeDestination: string | null;
  category: CategoryName;
  subfolder: string | null;
  sizeBytes: number;
  hadConflict: boolean;
  status: 'MOVED' | 'FAILED';
  error: string | null;
}

export interface OrganizeResult {
  directoryName: string;
  completedAt: string;
  organizedCount: number;
  failedCount: number;
  skippedCount: number;
  conflictsResolved: number;
  movedBytes: number;
  results: MoveResult[];
  logs: LogEntry[];
}

export interface BrowserCompatibilityInfo {
  supported: boolean;
  secureContext: boolean;
  inIframe: boolean;
  reason: string | null;
}

export interface FsPermissionDescriptor {
  mode?: 'read' | 'readwrite';
}

export type FsPermissionState = 'granted' | 'denied' | 'prompt';

export interface AugmentedDirectoryHandle extends FileSystemDirectoryHandle {
  queryPermission?: (descriptor?: FsPermissionDescriptor) => Promise<FsPermissionState>;
  requestPermission?: (descriptor?: FsPermissionDescriptor) => Promise<FsPermissionState>;
}

export interface AugmentedDataTransferItem extends DataTransferItem {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
}

declare global {
  interface Window {
    showDirectoryPicker?: (options?: {
      id?: string;
      mode?: 'read' | 'readwrite';
      startIn?: 'desktop' | 'documents' | 'downloads' | 'music' | 'pictures' | 'videos';
    }) => Promise<FileSystemDirectoryHandle>;
  }
}
