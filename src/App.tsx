import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  CheckSquare,
  Download,
  Eraser,
  Eye,
  FolderInput,
  FolderOpen,
  FolderSearch,
  Play,
  RefreshCw,
  Search,
  Square,
  Terminal,
  Trash2,
  UploadCloud,
} from 'lucide-react';
import {
  CategoryName,
  LogEntry,
  OrganizeResult,
  PlannedMove,
  PreviewResult,
  ScanResult,
} from './types/foldr';
import { CATEGORIES, getCategoryMeta } from './utils/categories';
import {
  extractDroppedDirectoryHandle,
  formatBytes,
  formatTimeShort,
  getBrowserCompatibility,
  organizeDirectoryFiles,
  pickDirectoryHandle,
  previewDirectoryOrganization,
  scanDirectoryHandle,
} from './utils/fsOrganizer';
import { downloadFoldrProjectZip } from './utils/projectExport';
import { Header } from './components/Header';
import { CompatibilityNotice } from './components/CompatibilityNotice';
import { CategoryIcon } from './components/CategoryIcon';
import { ConfirmOrganizeModal } from './components/ConfirmOrganizeModal';

export default function App() {
  const compatibility = useMemo(() => getBrowserCompatibility(), []);

  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  const [scanResult, setScanResult] = useState<ScanResult | null>(null);
  const [previewResult, setPreviewResult] = useState<PreviewResult | null>(null);
  const [lastOrganizeResult, setLastOrganizeResult] = useState<OrganizeResult | null>(null);
  const [organizedTotalSession, setOrganizedTotalSession] = useState<number>(0);

  const [selectedFiles, setSelectedFiles] = useState<Set<string>>(new Set());
  const [categoryFilter, setCategoryFilter] = useState<CategoryName | 'All'>('All');
  const [fileSearch, setFileSearch] = useState<string>('');
  const [dragActive, setDragActive] = useState<boolean>(false);

  const [busyState, setBusyState] = useState<
    'idle' | 'browsing' | 'scanning' | 'previewing' | 'organizing'
  >('idle');
  const busyLockRef = useRef<boolean>(false);

  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [progressLabel, setProgressLabel] = useState<string>('Ready — select a folder to begin');
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [confirmOpen, setConfirmOpen] = useState<boolean>(false);
  const [downloadingZip, setDownloadingZip] = useState<boolean>(false);

  const fileListRef = useRef<HTMLElement | null>(null);

  const appendLogs = useCallback((entries: LogEntry[]) => {
    if (!entries.length) return;
    setLogs((prev) => [...entries.slice().reverse(), ...prev].slice(0, 500));
  }, []);

  const addSystemLog = useCallback(
    (level: LogEntry['level'], action: LogEntry['action'], message: string) => {
      const ts = new Date().toISOString();
      appendLogs([
        {
          id: `${ts}-${Math.random().toString(36).slice(2, 8)}`,
          timestamp: ts,
          level,
          action,
          message,
        },
      ]);
    },
    [appendLogs],
  );

  const runScan = useCallback(
    async (targetHandle: FileSystemDirectoryHandle) => {
      if (busyLockRef.current) return;
      busyLockRef.current = true;
      setBusyState('scanning');
      setErrorMessage(null);
      setProgressPercent(35);
      setProgressLabel(`Scanning "${targetHandle.name}"...`);

      try {
        const result = await scanDirectoryHandle(targetHandle);
        setScanResult(result);
        setPreviewResult(null);
        setSelectedFiles(new Set(result.files.map((f) => f.filename)));
        appendLogs(result.logs);
        setProgressPercent(100);
        setProgressLabel(
          `Scan complete · ${result.totalFiles} file(s) found in "${result.directoryName}"`,
        );
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setErrorMessage(msg);
        setProgressPercent(0);
        setProgressLabel('Scan failed');
        addSystemLog('ERROR', 'SCAN', `Scan failed: ${msg}`);
      } finally {
        busyLockRef.current = false;
        setBusyState('idle');
      }
    },
    [addSystemLog, appendLogs],
  );

  const handleBrowseFolder = async () => {
    if (busyLockRef.current) return;
    busyLockRef.current = true;
    setBusyState('browsing');
    setErrorMessage(null);

    try {
      const pick = await pickDirectoryHandle();
      if (pick.status === 'cancelled') {
        addSystemLog('INFO', 'SYSTEM', 'Folder selection was cancelled.');
        return;
      }

      setDirectoryHandle(pick.handle);
      addSystemLog('INFO', 'SYSTEM', `Authorized folder "${pick.handle.name}"`);
      busyLockRef.current = false;
      setBusyState('idle');
      await runScan(pick.handle);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      addSystemLog('ERROR', 'ERROR', msg);
    } finally {
      busyLockRef.current = false;
      setBusyState('idle');
    }
  };

  const handleDropFolder = async (dataTransfer: DataTransfer) => {
    if (busyLockRef.current) return;
    busyLockRef.current = true;
    setBusyState('browsing');
    setErrorMessage(null);

    try {
      const droppedHandle = await extractDroppedDirectoryHandle(dataTransfer);
      if (!droppedHandle) {
        throw new Error(
          'Please drop a folder (not individual files) in desktop Chrome or Microsoft Edge, or click Browse Folder.',
        );
      }

      setDirectoryHandle(droppedHandle);
      addSystemLog('INFO', 'SYSTEM', `Authorized dropped folder "${droppedHandle.name}"`);
      busyLockRef.current = false;
      setBusyState('idle');
      await runScan(droppedHandle);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      addSystemLog('ERROR', 'ERROR', msg);
    } finally {
      busyLockRef.current = false;
      setBusyState('idle');
    }
  };

  const handlePreview = async () => {
    if (busyLockRef.current || !directoryHandle || !scanResult) return;
    busyLockRef.current = true;
    setBusyState('previewing');
    setErrorMessage(null);
    setProgressPercent(50);
    setProgressLabel('Generating organization preview...');

    try {
      const preview = await previewDirectoryOrganization(
        directoryHandle,
        scanResult.files,
        selectedFiles,
      );
      setPreviewResult(preview);
      appendLogs(preview.logs);
      setProgressPercent(100);
      setProgressLabel(
        `Preview ready · ${preview.totalPlanned} file(s) mapped · ${preview.conflictsResolved} conflict(s)`,
      );
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setProgressPercent(0);
      setProgressLabel('Preview failed');
      addSystemLog('ERROR', 'PREVIEW', `Preview failed: ${msg}`);
    } finally {
      busyLockRef.current = false;
      setBusyState('idle');
    }
  };

  const handleRequestOrganize = async () => {
    if (busyLockRef.current || !directoryHandle || !scanResult || selectedFiles.size === 0) {
      return;
    }
    if (!previewResult) {
      await handlePreview();
    }
    setConfirmOpen(true);
  };

  const handleConfirmOrganize = async () => {
    if (busyLockRef.current || !directoryHandle || !scanResult) return;
    busyLockRef.current = true;
    setBusyState('organizing');
    setErrorMessage(null);
    setProgressPercent(5);
    setProgressLabel('Organizing files safely...');

    try {
      const result = await organizeDirectoryFiles(
        directoryHandle,
        scanResult.files,
        selectedFiles,
        true,
        (completed, total, currentName) => {
          const pct = total > 0 ? Math.round((completed / total) * 100) : 100;
          setProgressPercent(pct);
          setProgressLabel(
            completed < total
              ? `Moving (${completed + 1}/${total}): ${currentName}`
              : 'Verifying and refreshing folder...',
          );
        },
      );

      setLastOrganizeResult(result);
      setOrganizedTotalSession((prev) => prev + result.organizedCount);
      appendLogs(result.logs);
      setConfirmOpen(false);

      if (result.failedCount > 0) {
        setErrorMessage(
          `${result.failedCount} file(s) could not be moved. Original source files were preserved.`,
        );
      }

      busyLockRef.current = false;
      setBusyState('idle');
      await runScan(directoryHandle);
      return;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      setProgressPercent(0);
      setProgressLabel('Organization failed');
      addSystemLog('ERROR', 'ORGANIZE', `Organization failed: ${msg}`);
      setConfirmOpen(false);
    } finally {
      busyLockRef.current = false;
      setBusyState('idle');
    }
  };

  const handleClearResults = () => {
    setDirectoryHandle(null);
    setScanResult(null);
    setPreviewResult(null);
    setSelectedFiles(new Set());
    setCategoryFilter('All');
    setFileSearch('');
    setErrorMessage(null);
    setProgressPercent(0);
    setProgressLabel('Ready — select a folder to begin');
    addSystemLog('INFO', 'SYSTEM', 'Cleared current workspace results.');
  };

  const handleDownloadProject = async () => {
    setDownloadingZip(true);
    try {
      await downloadFoldrProjectZip();
      addSystemLog('SUCCESS', 'SYSTEM', 'Downloaded foldr-smart-file-organizer.zip.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
      addSystemLog('ERROR', 'ERROR', `ZIP export failed: ${msg}`);
    } finally {
      setDownloadingZip(false);
    }
  };

  const handleExportLogs = () => {
    const blob = new Blob([JSON.stringify(logs, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `foldr-activity-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleFile = (filename: string) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      if (next.has(filename)) next.delete(filename);
      else next.add(filename);
      return next;
    });
    setPreviewResult(null);
  };

  const handleSelectAllVisible = (filenames: string[]) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      for (const name of filenames) next.add(name);
      return next;
    });
    setPreviewResult(null);
  };

  const handleClearAllVisible = (filenames: string[]) => {
    setSelectedFiles((prev) => {
      const next = new Set(prev);
      for (const name of filenames) next.delete(name);
      return next;
    });
    setPreviewResult(null);
  };

  const planByFilename = useMemo(() => {
    const map = new Map<string, PlannedMove>();
    if (previewResult) {
      for (const item of previewResult.plan) {
        map.set(item.filename, item);
      }
    }
    return map;
  }, [previewResult]);

  const filteredFiles = useMemo(() => {
    if (!scanResult) return [];
    const q = fileSearch.trim().toLowerCase();
    return scanResult.files.filter((file) => {
      if (categoryFilter !== 'All' && file.category !== categoryFilter) return false;
      if (
        q &&
        !file.filename.toLowerCase().includes(q) &&
        !file.extension.toLowerCase().includes(q) &&
        !file.category.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [scanResult, categoryFilter, fileSearch]);

  const visibleFilenames = filteredFiles.map((f) => f.filename);
  const allVisibleSelected =
    visibleFilenames.length > 0 && visibleFilenames.every((name) => selectedFiles.has(name));

  const isBusy = busyState !== 'idle';
  const totalFiles = scanResult?.totalFiles ?? 0;
  const filesWaiting = scanResult ? selectedFiles.size : 0;
  const storageBytes = scanResult?.totalSizeBytes ?? 0;
  const selectedBytes =
    scanResult?.files
      .filter((f) => selectedFiles.has(f.filename))
      .reduce((acc, f) => acc + f.sizeBytes, 0) ?? 0;

  return (
    <div className="min-h-screen bg-[#F3EEFF] text-[#24202D] flex flex-col">
      <Header
        compatibility={compatibility}
        selectedFolderName={directoryHandle?.name ?? null}
        onDownloadProject={() => void handleDownloadProject()}
        downloadingZip={downloadingZip}
      />

      <main className="flex-1 w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 space-y-6">
        <CompatibilityNotice compatibility={compatibility} />

        {/* 1. Target Directory Selector & Primary Controls */}
        <section className="foldr-card p-6 space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-[#24202D]">
                Smart File Organizer
              </h1>
              <p className="text-xs text-[#827A91] mt-0.5">
                Your files. Your space. Beautifully organized directly inside your browser.
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => directoryHandle && void runScan(directoryHandle)}
                disabled={isBusy || !directoryHandle}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#EBE5F3] bg-[#FFFFFF] text-[#24202D] hover:border-[#B99BEF] disabled:opacity-45 cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#9161D8]" />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                onClick={handleClearResults}
                disabled={isBusy || (!directoryHandle && !scanResult)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border border-[#EBE5F3] bg-[#FFFFFF] text-[#827A91] hover:text-[#E36A7A] hover:border-[#E36A7A]/40 disabled:opacity-45 cursor-pointer"
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>Clear Results</span>
              </button>
            </div>
          </div>

          {/* Selected Directory Row + Browse Button */}
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1 flex items-center gap-2.5 rounded-xl border border-[#EBE5F3] bg-[#FAF8FF] px-4 py-2.5 min-w-0">
              <FolderInput className="w-4 h-4 text-[#9161D8] shrink-0" />
              <span className="text-xs font-medium text-[#827A91] shrink-0">
                Target Directory:
              </span>
              <span className="text-xs font-bold text-[#24202D] truncate">
                {directoryHandle ? directoryHandle.name : 'No folder selected yet'}
              </span>
            </div>

            <button
              type="button"
              onClick={() => void handleBrowseFolder()}
              disabled={isBusy || !compatibility.supported}
              className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#9161D8] text-white hover:bg-[#7E4EC9] shadow-[0_6px_16px_rgba(145,97,216,0.22)] transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap shrink-0"
            >
              <FolderOpen className="w-4 h-4" />
              <span>{busyState === 'browsing' ? 'Selecting Folder...' : 'Browse Folder'}</span>
            </button>
          </div>

          {/* Drag-and-Drop Folder Zone */}
          <div
            onDragOver={(e) => {
              e.preventDefault();
              e.stopPropagation();
              if (!dragActive) setDragActive(true);
            }}
            onDragLeave={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
            }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDragActive(false);
              if (!isBusy) void handleDropFolder(e.dataTransfer);
            }}
            className={`rounded-xl border border-dashed px-4 py-3.5 flex flex-col sm:flex-row items-center justify-between gap-3 transition-colors ${
              dragActive
                ? 'border-[#9161D8] bg-[#EEE6FF]/70'
                : 'border-[#D7C8F5] bg-[#FAF8FF]/70 hover:border-[#B99BEF]'
            }`}
          >
            <div className="flex items-center gap-3 text-xs">
              <div className="w-8 h-8 rounded-lg bg-[#EEE6FF] text-[#9161D8] flex items-center justify-center shrink-0">
                <UploadCloud className="w-4 h-4" strokeWidth={1.85} />
              </div>
              <span className="text-[#827A91]">
                Permission-based local access: drag &amp; drop a folder here or click{' '}
                <strong className="text-[#24202D]">Browse Folder</strong>. Files never leave your device, and subfolders stay untouched.
              </span>
            </div>
          </div>

          {/* Primary Action Buttons */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => directoryHandle && void runScan(directoryHandle)}
              disabled={isBusy || !directoryHandle}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#EEE6FF] text-[#9161D8] hover:bg-[#E2D4FF] transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap"
            >
              <FolderSearch className="w-4 h-4" />
              <span>{busyState === 'scanning' ? 'Scanning...' : 'Scan Directory'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handlePreview()}
              disabled={isBusy || !scanResult || filesWaiting === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold border border-[#EBE5F3] bg-[#FFFFFF] text-[#24202D] hover:border-[#B99BEF] hover:bg-[#FAF8FF] transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap"
            >
              <Eye className="w-4 h-4 text-[#9161D8]" />
              <span>{busyState === 'previewing' ? 'Generating Preview...' : 'Preview Organization'}</span>
            </button>

            <button
              type="button"
              onClick={() => void handleRequestOrganize()}
              disabled={isBusy || !scanResult || filesWaiting === 0}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-semibold bg-[#27AE83] text-white hover:bg-[#219972] transition-colors disabled:opacity-45 cursor-pointer whitespace-nowrap"
            >
              <Play className="w-4 h-4" />
              <span>{busyState === 'organizing' ? 'Organizing...' : 'Organize Files'}</span>
            </button>

            {previewResult && (
              <span className="text-xs font-medium text-[#827A91] tabular-figures sm:ml-auto">
                Preview: {previewResult.totalPlanned} mapped · {previewResult.conflictsResolved} conflict(s)
              </span>
            )}
          </div>

          {errorMessage && (
            <div
              role="alert"
              className="flex items-start gap-2.5 rounded-xl border border-[#E36A7A]/40 bg-[#FFF5F7] px-4 py-3 text-xs text-[#24202D]"
            >
              <AlertCircle className="w-4 h-4 text-[#E36A7A] shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
        </section>

        {/* 2. Progress Indicator */}
        <section className="foldr-card px-6 py-4 space-y-2.5">
          <div className="flex items-center justify-between gap-4 text-xs">
            <span className="font-medium text-[#827A91]">{progressLabel}</span>
            <span className="font-bold text-[#9161D8] tabular-figures">{progressPercent}%</span>
          </div>
          <div className="h-2 w-full rounded-full bg-[#F3EEFF] overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${progressPercent}%`,
                backgroundColor:
                  errorMessage
                    ? '#E36A7A'
                    : progressPercent === 100 && lastOrganizeResult
                    ? '#27AE83'
                    : '#9161D8',
              }}
            />
          </div>
        </section>

        {/* 3. Statistics Cards */}
        <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4" aria-label="File Statistics">
          <div className="foldr-card p-5 space-y-1.5">
            <div className="text-xs font-medium text-[#827A91]">Total files</div>
            <div className="text-2xl font-bold text-[#24202D] tabular-figures">{totalFiles}</div>
            <div className="text-xs text-[#827A91] tabular-figures">
              {scanResult
                ? `${scanResult.skippedDirectories} subfolder(s) · ${scanResult.skippedUnsupported} skipped`
                : 'Awaiting folder scan'}
            </div>
          </div>

          <div className="foldr-card p-5 space-y-1.5">
            <div className="text-xs font-medium text-[#827A91]">Files waiting to be organized</div>
            <div className="text-2xl font-bold text-[#9161D8] tabular-figures">{filesWaiting}</div>
            <div className="text-xs text-[#827A91] tabular-figures">
              {previewResult
                ? `${previewResult.conflictsResolved} duplicate(s) auto-numbered`
                : 'Selected for organization'}
            </div>
          </div>

          <div className="foldr-card p-5 space-y-1.5">
            <div className="text-xs font-medium text-[#827A91]">Successfully organized</div>
            <div className="text-2xl font-bold text-[#27AE83] tabular-figures">
              {organizedTotalSession}
            </div>
            <div className="text-xs text-[#827A91] tabular-figures">
              {lastOrganizeResult
                ? `Last run: ${lastOrganizeResult.organizedCount} moved · ${lastOrganizeResult.failedCount} failed`
                : 'Verified moves this session'}
            </div>
          </div>

          <div className="foldr-card p-5 space-y-1.5">
            <div className="text-xs font-medium text-[#827A91]">Storage size</div>
            <div className="text-2xl font-bold text-[#24202D] tabular-figures">
              {formatBytes(storageBytes)}
            </div>
            <div className="text-xs text-[#827A91] tabular-figures">
              {lastOrganizeResult
                ? `${formatBytes(lastOrganizeResult.movedBytes)} organized last run`
                : 'Top-level files only'}
            </div>
          </div>
        </section>

        {/* 4. File Category Results */}
        <section className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-bold text-[#24202D]">File Categories</h2>
            <span className="text-xs text-[#827A91]">
              Click any category card to filter the file list below
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {CATEGORIES.map((cat) => {
              const count = scanResult?.categoryCounts[cat.name] ?? 0;
              const bytes = scanResult?.categorySizes[cat.name] ?? 0;
              const isSelectedCat = categoryFilter === cat.name;

              return (
                <button
                  key={cat.name}
                  type="button"
                  onClick={() => {
                    setCategoryFilter(isSelectedCat ? 'All' : cat.name);
                    fileListRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                  }}
                  className={`foldr-card-interactive p-5 text-left cursor-pointer ${
                    isSelectedCat ? 'ring-2 ring-[#9161D8] border-[#9161D8]' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ backgroundColor: cat.softBgHex, color: cat.accentHex }}
                    >
                      <CategoryIcon category={cat.name} className="w-5 h-5" />
                    </div>
                    <span
                      className={`text-2xl font-bold tabular-figures ${
                        count > 0 ? 'text-[#24202D]' : 'text-[#C7BED8]'
                      }`}
                    >
                      {count}
                    </span>
                  </div>

                  <div className="mt-3.5">
                    <div className="text-sm font-bold text-[#24202D]">{cat.name}</div>
                    <div className="text-xs text-[#827A91] mt-0.5 tabular-figures truncate">
                      {formatBytes(bytes)} · {cat.extensions.slice(0, 4).join(', ')}
                      {cat.extensions.length > 4 ? '…' : ''}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </section>

        {/* 5. Scanned Files & Destination Preview Table */}
        <section ref={fileListRef} className="foldr-card overflow-hidden">
          <div className="p-5 border-b border-[#EBE5F3] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h2 className="text-base font-bold text-[#24202D]">
                Scanned Files &amp; Destination Preview
              </h2>
              <p className="text-xs text-[#827A91] mt-0.5">
                Select which files to move and review their exact target paths before organizing.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
              <div className="relative">
                <Search className="w-4 h-4 text-[#827A91] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={fileSearch}
                  onChange={(e) => setFileSearch(e.target.value)}
                  placeholder="Filter files..."
                  className="w-full sm:w-56 pl-9 pr-3 py-2 rounded-xl border border-[#EBE5F3] bg-[#FAF8FF] text-xs text-[#24202D] placeholder:text-[#827A91] focus:outline-none focus:border-[#9161D8]"
                />
              </div>

              {categoryFilter !== 'All' && (
                <button
                  type="button"
                  onClick={() => setCategoryFilter('All')}
                  className="px-3 py-2 rounded-xl text-xs font-semibold bg-[#EEE6FF] text-[#9161D8] hover:bg-[#E2D4FF] cursor-pointer whitespace-nowrap"
                >
                  Showing: {categoryFilter} ×
                </button>
              )}
            </div>
          </div>

          {!scanResult ? (
            <div className="p-10 text-center text-xs text-[#827A91]">
              Select a folder using <strong className="text-[#24202D]">Browse Folder</strong> above
              to inspect files and preview destination paths.
            </div>
          ) : filteredFiles.length === 0 ? (
            <div className="p-10 text-center text-xs text-[#827A91]">
              {scanResult.totalFiles === 0
                ? 'This folder contains zero top-level files to organize.'
                : 'No scanned files match the current filter.'}
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="sticky top-0 bg-[#FAF8FF] border-b border-[#EBE5F3] z-10">
                  <tr className="text-[#827A91]">
                    <th className="py-3 px-5 w-10">
                      <button
                        type="button"
                        onClick={() =>
                          allVisibleSelected
                            ? handleClearAllVisible(visibleFilenames)
                            : handleSelectAllVisible(visibleFilenames)
                        }
                        aria-label={allVisibleSelected ? 'Deselect all visible' : 'Select all visible'}
                        className="text-[#827A91] hover:text-[#9161D8] cursor-pointer"
                      >
                        {allVisibleSelected ? (
                          <CheckSquare className="w-4 h-4 text-[#9161D8]" />
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3 font-semibold">File Name</th>
                    <th className="py-3 px-3 font-semibold">Extension</th>
                    <th className="py-3 px-3 font-semibold">Category</th>
                    <th className="py-3 px-3 font-semibold">Proposed Destination</th>
                    <th className="py-3 px-5 font-semibold text-right">Size</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EBE5F3]">
                  {filteredFiles.map((file) => {
                    const checked = selectedFiles.has(file.filename);
                    const planned = planByFilename.get(file.filename);
                    const catMeta = getCategoryMeta(file.category);
                    const defaultDest = file.subfolder
                      ? `${file.category}/${file.subfolder}/${file.filename}`
                      : `${file.category}/${file.filename}`;

                    return (
                      <tr
                        key={file.sourcePath}
                        className={`transition-colors ${
                          checked ? 'bg-[#FAF8FF]/60 hover:bg-[#F3EEFF]/60' : 'hover:bg-[#FAF8FF]'
                        }`}
                      >
                        <td className="py-3 px-5">
                          <button
                            type="button"
                            onClick={() => handleToggleFile(file.filename)}
                            aria-label={`Select ${file.filename}`}
                            className="cursor-pointer"
                          >
                            {checked ? (
                              <CheckSquare className="w-4 h-4 text-[#9161D8]" />
                            ) : (
                              <Square className="w-4 h-4 text-[#C7BED8]" />
                            )}
                          </button>
                        </td>
                        <td className="py-3 px-3 font-semibold text-[#24202D] max-w-xs truncate">
                          {file.filename}
                        </td>
                        <td className="py-3 px-3 text-[#827A91] font-medium tabular-figures whitespace-nowrap">
                          {file.extension === 'NONE' ? '—' : `.${file.extension}`}
                        </td>
                        <td className="py-3 px-3">
                          <span
                            className="inline-flex items-center gap-1.5 font-medium"
                            style={{ color: catMeta.accentHex }}
                          >
                            <CategoryIcon category={file.category} className="w-3.5 h-3.5" />
                            <span>
                              {file.category}
                              {file.subfolder ? ` / ${file.subfolder}` : ''}
                            </span>
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center gap-2">
                            <ArrowRight className="w-3.5 h-3.5 text-[#827A91] shrink-0" />
                            <span
                              className={`font-medium ${
                                planned?.hasConflict ? 'text-[#9161D8]' : 'text-[#27AE83]'
                              }`}
                            >
                              {planned ? planned.relativeDestination : defaultDest}
                            </span>
                            {planned?.hasConflict && (
                              <span className="text-[11px] font-semibold text-[#9161D8] bg-[#EEE6FF] px-2 py-0.5 rounded-md">
                                Auto-numbered
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="py-3 px-5 text-right font-medium text-[#827A91] tabular-figures">
                          {formatBytes(file.sizeBytes)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 6. Live Activity Console */}
        <section className="foldr-card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4 border-b border-[#EBE5F3] bg-[#FAF8FF]">
            <div className="flex items-center gap-2.5">
              <Terminal className="w-4 h-4 text-[#9161D8]" strokeWidth={1.9} />
              <h2 className="text-sm font-bold text-[#24202D]">Activity Console</h2>
              <span className="text-xs text-[#827A91] tabular-figures">
                · {logs.length} event(s)
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleExportLogs}
                disabled={logs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#EEE6FF] text-[#9161D8] hover:bg-[#E2D4FF] disabled:opacity-45 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Export JSON</span>
              </button>
              <button
                type="button"
                onClick={() => setLogs([])}
                disabled={logs.length === 0}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border border-[#EBE5F3] bg-[#FFFFFF] text-[#827A91] hover:text-[#E36A7A] disabled:opacity-45 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Clear</span>
              </button>
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto divide-y divide-[#EBE5F3] text-xs">
            {logs.length === 0 ? (
              <div className="px-6 py-8 text-center text-[#827A91]">
                No operations recorded yet. Select a folder to inspect and organize files.
              </div>
            ) : (
              logs.map((entry) => {
                const badgeClass =
                  entry.level === 'SUCCESS'
                    ? 'text-[#27AE83] bg-[#E7F7F1]'
                    : entry.level === 'WARNING'
                    ? 'text-[#9161D8] bg-[#EEE6FF]'
                    : entry.level === 'ERROR'
                    ? 'text-[#E36A7A] bg-[#FDECEF]'
                    : 'text-[#827A91] bg-[#F3EEFF]';

                return (
                  <div
                    key={entry.id}
                    className="flex flex-col sm:flex-row sm:items-baseline gap-1.5 sm:gap-3 px-6 py-3 hover:bg-[#FAF8FF]"
                  >
                    <span className="text-[#827A91] tabular-figures shrink-0">
                      {formatTimeShort(entry.timestamp)}
                    </span>
                    <span className={`px-2 py-0.5 rounded-md font-semibold w-fit shrink-0 ${badgeClass}`}>
                      {entry.action}
                    </span>
                    <span className="text-[#24202D] break-words">{entry.message}</span>
                  </div>
                );
              })
            )}
          </div>
        </section>
      </main>

      <ConfirmOrganizeModal
        open={confirmOpen}
        folderName={directoryHandle?.name ?? ''}
        fileCount={selectedFiles.size}
        totalBytes={selectedBytes}
        preview={previewResult}
        busy={busyState === 'organizing'}
        onConfirm={() => void handleConfirmOrganize()}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
  );
}
