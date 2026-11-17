import React from 'react';
import { AlertCircle, CheckCircle2, ShieldCheck, X } from 'lucide-react';
import { PreviewResult } from '../types/foldr';
import { formatBytes } from '../utils/fsOrganizer';

interface ConfirmOrganizeModalProps {
  open: boolean;
  folderName: string;
  fileCount: number;
  totalBytes: number;
  preview: PreviewResult | null;
  busy: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmOrganizeModal: React.FC<ConfirmOrganizeModalProps> = ({
  open,
  folderName,
  fileCount,
  totalBytes,
  preview,
  busy,
  onConfirm,
  onCancel,
}) => {
  if (!open) return null;

  const conflictsCount = preview?.conflictsResolved ?? 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#24202D]/40 backdrop-blur-xs"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-organize-title"
    >
      <div className="w-full max-w-lg rounded-2xl bg-[#FFFFFF] border border-[#EBE5F3] shadow-[0_20px_50px_rgba(36,32,45,0.16)] overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#EBE5F3]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-[#EEE6FF] text-[#9161D8] flex items-center justify-center">
              <ShieldCheck className="w-4 h-4" strokeWidth={2} />
            </div>
            <h2 id="confirm-organize-title" className="text-base font-bold text-[#24202D]">
              Confirm File Organization
            </h2>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            aria-label="Close confirmation dialog"
            className="p-1.5 rounded-lg text-[#827A91] hover:text-[#24202D] hover:bg-[#F3EEFF] cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4 text-sm">
          <p className="text-[#827A91] leading-relaxed">
            Foldr will organize{' '}
            <span className="font-bold text-[#24202D] tabular-figures">{fileCount}</span> file(s) (
            <span className="font-semibold text-[#24202D] tabular-figures">
              {formatBytes(totalBytes)}
            </span>
            ) into categorized subfolders inside:
          </p>

          <div className="px-4 py-3 rounded-xl bg-[#F3EEFF] border border-[#EBE5F3] text-sm font-semibold text-[#9161D8] break-all">
            {folderName}
          </div>

          {conflictsCount > 0 && (
            <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-[#EEE6FF] border border-[#B99BEF]/50 text-xs text-[#24202D]">
              <AlertCircle className="w-4 h-4 text-[#9161D8] shrink-0 mt-0.5" />
              <span>
                <strong className="font-bold tabular-figures">{conflictsCount}</strong> filename
                conflict(s) detected. Existing files will remain untouched and incoming duplicates
                will receive numbered suffixes like <span className="font-semibold">(1)</span>.
              </span>
            </div>
          )}

          <div className="space-y-2 pt-1 text-xs text-[#827A91]">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#27AE83] shrink-0" />
              <span>Destination bytes are verified before removing any original file</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#27AE83] shrink-0" />
              <span>Existing files are never overwritten; failed writes preserve originals</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-[#27AE83] shrink-0" />
              <span>Subfolders are never scanned or moved recursively</span>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#EBE5F3] bg-[#FAF8FF]">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-4 py-2.5 text-xs font-semibold rounded-xl border border-[#EBE5F3] bg-[#FFFFFF] text-[#827A91] hover:text-[#24202D] cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-5 py-2.5 text-xs font-semibold rounded-xl bg-[#9161D8] text-white hover:bg-[#7E4EC9] transition-colors cursor-pointer disabled:opacity-50"
          >
            {busy ? 'Organizing Files...' : 'Confirm & Organize'}
          </button>
        </div>
      </div>
    </div>
  );
};
