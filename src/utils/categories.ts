import { CategoryName } from '../types/foldr';

export interface CategoryMeta {
  name: CategoryName;
  extensions: string[];
  subfolders?: { label: string; key: 'PDF' | 'Word' | 'Text'; extensions: string[] }[];
  accentHex: string;
  softBgHex: string;
  description: string;
}

export const CATEGORY_ORDER: CategoryName[] = [
  'Documents',
  'Images',
  'Videos',
  'Audio',
  'Archives',
  'Applications',
  'Spreadsheets',
  'Others',
];

export const CATEGORIES: CategoryMeta[] = [
  {
    name: 'Documents',
    extensions: ['PDF', 'DOC', 'DOCX', 'TXT', 'RTF', 'ODT'],
    subfolders: [
      { label: 'Documents/PDF/', key: 'PDF', extensions: ['PDF'] },
      { label: 'Documents/Word/', key: 'Word', extensions: ['DOC', 'DOCX', 'RTF', 'ODT'] },
      { label: 'Documents/Text/', key: 'Text', extensions: ['TXT'] },
    ],
    accentHex: '#9161D8',
    softBgHex: '#EEE6FF',
    description: 'Sorted into PDF, Word, and Text subfolders.',
  },
  {
    name: 'Images',
    extensions: ['JPG', 'JPEG', 'PNG', 'GIF', 'BMP', 'WEBP', 'SVG', 'ICO', 'TIFF'],
    accentHex: '#7B5CD6',
    softBgHex: '#EFE9FF',
    description: 'Photos, illustrations, screenshots, and vectors.',
  },
  {
    name: 'Videos',
    extensions: ['MP4', 'MKV', 'MOV', 'AVI', 'WMV', 'WEBM'],
    accentHex: '#27AE83',
    softBgHex: '#E7F7F1',
    description: 'Video recordings, clips, and media streams.',
  },
  {
    name: 'Audio',
    extensions: ['MP3', 'WAV', 'AAC', 'FLAC', 'OGG', 'M4A'],
    accentHex: '#9161D8',
    softBgHex: '#EEE6FF',
    description: 'Music, voice memos, and lossless audio.',
  },
  {
    name: 'Archives',
    extensions: ['ZIP', 'RAR', '7Z', 'TAR', 'GZ'],
    accentHex: '#6F58C9',
    softBgHex: '#EEE8FF',
    description: 'Compressed archives and backups.',
  },
  {
    name: 'Applications',
    extensions: ['EXE', 'MSI', 'APK'],
    accentHex: '#E36A7A',
    softBgHex: '#FDECEF',
    description: 'Desktop installers and mobile packages.',
  },
  {
    name: 'Spreadsheets',
    extensions: ['XLS', 'XLSX', 'CSV', 'ODS'],
    accentHex: '#27AE83',
    softBgHex: '#E7F7F1',
    description: 'Workbooks, tables, and CSV exports.',
  },
  {
    name: 'Others',
    extensions: ['UNKNOWN'],
    accentHex: '#827A91',
    softBgHex: '#F2EEF8',
    description: 'Unrecognized extensions and extensionless files.',
  },
];

const EXTENSION_MAP: Record<string, { category: CategoryName; subfolder: string | null }> = {
  // Documents
  '.pdf': { category: 'Documents', subfolder: 'PDF' },
  '.doc': { category: 'Documents', subfolder: 'Word' },
  '.docx': { category: 'Documents', subfolder: 'Word' },
  '.rtf': { category: 'Documents', subfolder: 'Word' },
  '.odt': { category: 'Documents', subfolder: 'Word' },
  '.txt': { category: 'Documents', subfolder: 'Text' },
  // Images
  '.jpg': { category: 'Images', subfolder: null },
  '.jpeg': { category: 'Images', subfolder: null },
  '.png': { category: 'Images', subfolder: null },
  '.gif': { category: 'Images', subfolder: null },
  '.bmp': { category: 'Images', subfolder: null },
  '.webp': { category: 'Images', subfolder: null },
  '.svg': { category: 'Images', subfolder: null },
  '.ico': { category: 'Images', subfolder: null },
  '.tiff': { category: 'Images', subfolder: null },
  // Videos
  '.mp4': { category: 'Videos', subfolder: null },
  '.mkv': { category: 'Videos', subfolder: null },
  '.mov': { category: 'Videos', subfolder: null },
  '.avi': { category: 'Videos', subfolder: null },
  '.wmv': { category: 'Videos', subfolder: null },
  '.webm': { category: 'Videos', subfolder: null },
  // Audio
  '.mp3': { category: 'Audio', subfolder: null },
  '.wav': { category: 'Audio', subfolder: null },
  '.aac': { category: 'Audio', subfolder: null },
  '.flac': { category: 'Audio', subfolder: null },
  '.ogg': { category: 'Audio', subfolder: null },
  '.m4a': { category: 'Audio', subfolder: null },
  // Archives
  '.zip': { category: 'Archives', subfolder: null },
  '.rar': { category: 'Archives', subfolder: null },
  '.7z': { category: 'Archives', subfolder: null },
  '.tar': { category: 'Archives', subfolder: null },
  '.gz': { category: 'Archives', subfolder: null },
  // Applications
  '.exe': { category: 'Applications', subfolder: null },
  '.msi': { category: 'Applications', subfolder: null },
  '.apk': { category: 'Applications', subfolder: null },
  // Spreadsheets
  '.xls': { category: 'Spreadsheets', subfolder: null },
  '.xlsx': { category: 'Spreadsheets', subfolder: null },
  '.csv': { category: 'Spreadsheets', subfolder: null },
  '.ods': { category: 'Spreadsheets', subfolder: null },
};

export function categorizeFilename(filename: string): {
  category: CategoryName;
  subfolder: string | null;
  extension: string;
} {
  const lastDot = filename.lastIndexOf('.');
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return { category: 'Others', subfolder: null, extension: 'NONE' };
  }
  const suffix = filename.slice(lastDot).toLowerCase();
  const extLabel = suffix.slice(1).toUpperCase();
  const match = EXTENSION_MAP[suffix];
  if (match) {
    return { category: match.category, subfolder: match.subfolder, extension: extLabel };
  }
  return { category: 'Others', subfolder: null, extension: extLabel };
}

export function getCategoryMeta(name: CategoryName): CategoryMeta {
  return CATEGORIES.find((c) => c.name === name) ?? CATEGORIES[CATEGORIES.length - 1];
}

export function emptyCategoryCounts(): Record<CategoryName, number> {
  return {
    Documents: 0,
    Images: 0,
    Videos: 0,
    Audio: 0,
    Archives: 0,
    Applications: 0,
    Spreadsheets: 0,
    Others: 0,
  };
}
