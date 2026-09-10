import React, { useState, useEffect } from 'react';

interface VliAvatarProps {
  fotoUrl?: string | null;
  nome: string;
  genero?: 'M' | 'H' | null;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'badge';
  className?: string;
  showBadgeBorder?: boolean;
}

export const VliAvatar: React.FC<VliAvatarProps> = ({
  fotoUrl,
  nome,
  genero = 'H',
  size = 'md',
  className = '',
  showBadgeBorder = false,
}) => {
  const [imageError, setImageError] = useState(false);
  const [svgAssetError, setSvgAssetError] = useState(false);

  const isFemale = genero === 'M';
  const avatarSvgPath = isFemale ? '/avatar_m.svg' : '/avatar_h.svg';

  // Redefine erros caso o usuário altere a foto ou troque o gênero
  useEffect(() => {
    setImageError(false);
  }, [fotoUrl]);

  useEffect(() => {
    setSvgAssetError(false);
  }, [avatarSvgPath]);

  const sizeClasses = {
    sm: 'w-10 h-10 rounded-xl',
    md: 'w-16 h-16 rounded-2xl',
    lg: 'w-24 h-24 rounded-2xl',
    xl: 'w-32 h-32 rounded-3xl',
    badge: 'w-28 h-28 sm:w-32 sm:h-32 rounded-2xl',
  }[size];

  const hasValidPhoto = Boolean(fotoUrl) && !imageError;

  return (
    <div
      className={`relative inline-flex items-center justify-center shrink-0 overflow-hidden bg-slate-100 ${sizeClasses} ${
        showBadgeBorder ? 'ring-3 ring-[#FFB81C] shadow-md' : 'shadow-inner'
      } ${className}`}
    >
      {hasValidPhoto ? (
        <img
          src={fotoUrl!}
          alt={`Foto de ${nome}`}
          referrerPolicy="no-referrer"
          onError={() => setImageError(true)}
          className="w-full h-full object-cover object-center"
        />
      ) : (
        /* VLI Worker Avatar (Mulher M ou Homem H) com renderização em pixel art */
        <div
          className="w-full h-full flex items-center justify-center relative bg-gradient-to-b from-slate-100 to-slate-200 select-none"
          title={`Avatar Colaborador VLI (${isFemale ? 'Mulher - M' : 'Homem - H'})`}
        >
          {!svgAssetError ? (
            <img
              key={avatarSvgPath}
              src={avatarSvgPath}
              alt={`Avatar Colaborador VLI (${isFemale ? 'Mulher' : 'Homem'})`}
              onError={() => setSvgAssetError(true)}
              className="w-full h-full object-contain [image-rendering:pixelated]"
              style={{ imageRendering: 'pixelated' }}
            />
          ) : (
            /* Inline fallback SVG vector */
            <svg
              viewBox="0 0 240 240"
              className="w-full h-full object-contain p-0.5"
              xmlns="http://www.w3.org/2000/svg"
            >
              <rect width="240" height="240" rx="36" fill="#E2E8F0" />
              <circle cx="120" cy="120" r="104" fill="#F1F5F9" stroke="#94A3B8" strokeWidth="1.5" strokeDasharray="4 3" />
              {/* Neck */}
              <path d="M102 142 L138 142 L138 168 C138 174 132 178 120 178 C108 178 102 174 102 168 Z" fill="#E89F70" />
              {/* Uniform */}
              <path d="M48 240 C52 195 80 162 104 158 L120 174 L136 158 C160 162 188 195 192 240 Z" fill="#334155" />
              {/* High-Vis Band */}
              <path d="M60 216 Q120 205 180 216" stroke="#FF7A00" strokeWidth="8" fill="none" strokeLinecap="round" />
              <path d="M60 216 Q120 205 180 216" stroke="#FFFFFF" strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.9" />
              {/* Chest Badge */}
              <rect x="74" y="184" width="30" height="12" rx="2" fill="#001833" stroke="#FF7A00" strokeWidth="1" />
              <text x="89" y="193" fontFamily="sans-serif" fontSize="7.5" fontWeight="900" fill="#FFB81C" textAnchor="middle">VLI</text>
              {/* Face */}
              <ellipse cx="120" cy="116" rx="38" ry="42" fill={isFemale ? '#FFE4D6' : '#FCD3B0'} />
              {/* Ears */}
              <ellipse cx="80" cy="120" rx="7" ry="11" fill="#F6B889" />
              <ellipse cx="160" cy="120" rx="7" ry="11" fill="#F6B889" />
              {isFemale ? (
                /* Female side ponytail */
                <path d="M152 130 C165 150 172 180 170 210 C165 215 155 215 150 195 C146 175 148 150 144 135 Z" fill="#451A03" />
              ) : (
                /* Male beard */
                <path d="M92 124 C92 152 104 162 120 162 C136 162 148 152 148 124 C144 126 138 140 120 142 C102 140 96 126 92 124 Z" fill="#1F2937" />
              )}
              {/* Eyes & Smile */}
              <circle cx="106" cy="118" r="3.8" fill="#1E293B" />
              <circle cx="134" cy="118" r="3.8" fill="#1E293B" />
              <path d="M109 135 Q120 144 131 135" stroke="#7A3919" strokeWidth="2.5" fill="none" strokeLinecap="round" />
              {/* Glasses */}
              <rect x="94" y="110" width="22" height="16" rx="4" fill="#BAE6FD" fillOpacity="0.3" stroke="#0F172A" strokeWidth="2" />
              <rect x="124" y="110" width="22" height="16" rx="4" fill="#BAE6FD" fillOpacity="0.3" stroke="#0F172A" strokeWidth="2" />
              <line x1="116" y1="117" x2="124" y2="117" stroke="#0F172A" strokeWidth="2" />
              {/* White Helmet */}
              <path d="M78 100 C78 60 162 60 162 100 C154 94 86 94 78 100 Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1.5" />
              <rect x="100" y="75" width="40" height="15" rx="3" fill="#002B49" stroke="#FF7A00" strokeWidth="1" />
              <text x="120" y="86.5" fontFamily="sans-serif" fontSize="10.5" fontWeight="900" fill="#FFFFFF" textAnchor="middle">VLi</text>
              <path d="M72 100 Q120 85 168 100 Q152 114 120 112 Q88 114 72 100 Z" fill="#FFFFFF" stroke="#CBD5E1" strokeWidth="1" />
            </svg>
          )}
        </div>
      )}
    </div>
  );
};
