import React from 'react';

interface VliLogoProps {
  variant?: 'full' | 'compact' | 'white' | 'dark';
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showSubtitle?: boolean;
}

export const VliLogo: React.FC<VliLogoProps> = ({
  variant = 'full',
  className = '',
  size = 'md',
  showSubtitle = false,
}) => {
  const isWhite = variant === 'white';

  const sizeStyles = {
    sm: { text: 'text-2xl', dot: 'w-2 h-2 -top-0.5', sub: 'text-[9px]' },
    md: { text: 'text-3xl sm:text-4xl', dot: 'w-2.5 h-2.5 -top-1', sub: 'text-[10px]' },
    lg: { text: 'text-5xl sm:text-6xl', dot: 'w-3.5 h-3.5 -top-1.5', sub: 'text-xs' },
    xl: { text: 'text-6xl sm:text-7xl', dot: 'w-4 h-4 -top-2', sub: 'text-sm' },
  }[size];

  const textColor = isWhite ? 'text-white' : 'text-[#002B49]';
  const dotColor = 'bg-[#FFB81C]';

  return (
    <div className={`inline-flex flex-col items-center justify-center select-none ${className}`}>
      {/* VLi Typography exactly matching the image */}
      <div className={`font-black tracking-tight ${sizeStyles.text} ${textColor} flex items-baseline leading-none font-sans`}>
        <span>V</span>
        <span>L</span>
        <span className="relative ml-0.5">
          {/* Lowercase dotless i body */}
          <span className="inline-block">ı</span>
          {/* Custom Yellow/Amber Dot on the i */}
          <span
            className={`absolute left-1/2 -translate-x-1/2 ${sizeStyles.dot} ${dotColor} rounded-full`}
          />
        </span>
      </div>

      {showSubtitle && (
        <div className={`mt-1 text-center font-medium ${isWhite ? 'text-slate-200' : 'text-slate-500'} ${sizeStyles.sub} leading-tight`}>
          <p>VLI - Logística Integrada.</p>
          <p className="text-[0.9em] opacity-90">Conectando e Protegendo.</p>
        </div>
      )}
    </div>
  );
};
