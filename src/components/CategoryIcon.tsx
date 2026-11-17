import React from 'react';
import {
  Archive,
  AppWindow,
  FileQuestion,
  FileText,
  Film,
  Image as ImageIcon,
  Music,
  Table2,
} from 'lucide-react';
import { CategoryName } from '../types/foldr';

interface CategoryIconProps {
  category: CategoryName;
  className?: string;
}

export const CategoryIcon: React.FC<CategoryIconProps> = ({
  category,
  className = 'w-5 h-5',
}) => {
  switch (category) {
    case 'Documents':
      return <FileText className={className} strokeWidth={1.75} />;
    case 'Images':
      return <ImageIcon className={className} strokeWidth={1.75} />;
    case 'Videos':
      return <Film className={className} strokeWidth={1.75} />;
    case 'Audio':
      return <Music className={className} strokeWidth={1.75} />;
    case 'Archives':
      return <Archive className={className} strokeWidth={1.75} />;
    case 'Applications':
      return <AppWindow className={className} strokeWidth={1.75} />;
    case 'Spreadsheets':
      return <Table2 className={className} strokeWidth={1.75} />;
    case 'Others':
    default:
      return <FileQuestion className={className} strokeWidth={1.75} />;
  }
};
