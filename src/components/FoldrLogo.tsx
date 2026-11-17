import React from 'react';

interface FoldrLogoProps {
  variant?: 'horizontal' | 'icon' | 'hero';
  size?: 'sm' | 'md' | 'lg';
}

export const FoldrLogo: React.FC<FoldrLogoProps> = ({
  variant = 'horizontal',
  size = 'md',
}) => {
  const iconDim = size === 'sm' ? 'w-8 h-8' : size === 'lg' ? 'w-11 h-11' : 'w-9 h-9';

  const mark = (
    <div
      className={`${iconDim} rounded-xl bg-[#9161D8] flex items-center justify-center shrink-0 shadow-[0_6px_18px_rgba(145,97,216,0.28)]`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 36 36" className="w-[64%] h-[64%]" fill="none">
        {/* Back overlapping folder layer */}
        <path
          d="M6.5 11.5C6.5 9.84315 7.84315 8.5 9.5 8.5H14.5858C15.3814 8.5 16.1445 8.81607 16.7071 9.37868L18.1213 10.7929C18.6839 11.3555 19.447 11.6716 20.2426 11.6716H26.5C28.1569 11.6716 29.5 13.0147 29.5 14.6716V16.5H6.5V11.5Z"
          fill="#EEE6FF"
          fillOpacity="0.82"
        />
        {/* Front geometric folder layer */}
        <rect x="5" y="14.5" width="26" height="14.5" rx="4.25" fill="#FFFFFF" />
        {/* Minimal organizer bar detail */}
        <path
          d="M12.5 21.75H23.5"
          stroke="#9161D8"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
      </svg>
    </div>
  );

  if (variant === 'icon') {
    return mark;
  }

  if (variant === 'hero') {
    return (
      <div className="inline-flex items-center gap-3.5">
        {mark}
        <span className="text-3xl font-bold tracking-tight text-[#24202D]">Foldr</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      {mark}
      <div className="flex flex-col leading-none">
        <span className="text-lg font-bold tracking-tight text-[#24202D]">Foldr</span>
        <span className="text-[11px] font-medium text-[#827A91] mt-0.5">Smart Organizer</span>
      </div>
    </div>
  );
};
