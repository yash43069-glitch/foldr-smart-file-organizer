import React from 'react';
import { Download, ShieldCheck, WifiOff } from 'lucide-react';
import { BrowserCompatibilityInfo } from '../types/foldr';
import { FoldrLogo } from './FoldrLogo';

interface HeaderProps {
  compatibility: BrowserCompatibilityInfo;
  selectedFolderName: string | null;
  onDownloadProject: () => void;
  downloadingZip: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  compatibility,
  selectedFolderName,
  onDownloadProject,
  downloadingZip,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-[#FFFFFF]/95 backdrop-blur-md border-b border-[#EBE5F3]">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4 px-4 sm:px-6 lg:px-8 h-18 py-3">
        {/* Brand Identity */}
        <div className="flex items-center gap-4 min-w-0">
          <FoldrLogo variant="horizontal" size="md" />
          <span className="hidden md:inline-block h-5 w-px bg-[#EBE5F3]" aria-hidden="true" />
          <p className="hidden md:block text-xs font-medium text-[#827A91] truncate">
            A place for everything · Version 2.0
          </p>
        </div>

        {/* Browser Access Status + Export Action */}
        <div className="flex items-center gap-3 sm:gap-4 shrink-0">
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium px-3 py-1.5 rounded-xl bg-[#FAF8FF] border border-[#EBE5F3]">
            {compatibility.supported ? (
              <>
                <ShieldCheck className="w-4 h-4 text-[#27AE83] shrink-0" strokeWidth={1.9} />
                <span className="text-[#27AE83] font-semibold whitespace-nowrap">
                  {selectedFolderName ? `Connected: ${selectedFolderName}` : 'Browser Access Ready'}
                </span>
              </>
            ) : (
              <>
                <WifiOff className="w-4 h-4 text-[#E36A7A] shrink-0" strokeWidth={1.9} />
                <span className="text-[#E36A7A] font-semibold whitespace-nowrap">
                  Browser Unsupported
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={onDownloadProject}
            disabled={downloadingZip}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-[#9161D8] text-white hover:bg-[#7E4EC9] shadow-[0_6px_16px_rgba(145,97,216,0.22)] transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download className="w-4 h-4" />
            <span>{downloadingZip ? 'Packaging ZIP...' : 'Download Project'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
