import React from 'react';
import { AlertTriangle, ExternalLink, Info } from 'lucide-react';
import { BrowserCompatibilityInfo } from '../types/foldr';

interface CompatibilityNoticeProps {
  compatibility: BrowserCompatibilityInfo;
}

export const CompatibilityNotice: React.FC<CompatibilityNoticeProps> = ({
  compatibility,
}) => {
  if (compatibility.supported && !compatibility.inIframe) {
    return null;
  }

  const isWarning = !compatibility.supported;

  return (
    <div
      role="status"
      className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        isWarning
          ? 'bg-[#FFF5F7] border-[#E36A7A]/35 text-[#24202D]'
          : 'bg-[#FFFFFF] border-[#B99BEF]/60 text-[#24202D]'
      }`}
    >
      <div className="flex items-start gap-3">
        <div
          className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
            isWarning
              ? 'bg-[#E36A7A]/15 text-[#E36A7A]'
              : 'bg-[#EEE6FF] text-[#9161D8]'
          }`}
        >
          {isWarning ? (
            <AlertTriangle className="w-5 h-5" strokeWidth={1.85} />
          ) : (
            <Info className="w-5 h-5" strokeWidth={1.85} />
          )}
        </div>
        <div className="space-y-1">
          <div className="text-sm font-bold text-[#24202D]">
            {isWarning
              ? 'File System Access API Unavailable'
              : 'Embedded Preview Frame Detected'}
          </div>
          <p className="text-xs text-[#827A91] leading-relaxed max-w-2xl">
            {compatibility.reason}
          </p>
        </div>
      </div>

      {compatibility.inIframe && typeof window !== 'undefined' && (
        <a
          href={window.location.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#9161D8] text-white hover:bg-[#7E4EC9] transition-colors whitespace-nowrap shrink-0"
        >
          <span>Open in New Tab</span>
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      )}
    </div>
  );
};
