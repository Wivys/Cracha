import React, { useEffect, useState, useRef } from 'react';
import QRCode from 'qrcode';
import { Download, Copy, Check, Share2 } from 'lucide-react';

interface QrCodeDisplayProps {
  value: string;
  size?: number;
  label?: string;
  sublabel?: string;
  showActions?: boolean;
  showShareOnlyButton?: boolean;
  matricula?: string;
  nome?: string;
}

export const QrCodeDisplay: React.FC<QrCodeDisplayProps> = ({
  value,
  size = 180,
  label,
  sublabel,
  showActions = true,
  showShareOnlyButton = false,
  matricula,
  nome,
}) => {
  const [dataUrl, setDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    if (!value) return;

    QRCode.toDataURL(value, {
      width: size * 2, // High DPI
      margin: 1,
      color: {
        dark: '#002B49', // VLI Navy Blue
        light: '#FFFFFF',
      },
      errorCorrectionLevel: 'H',
    })
      .then((url) => {
        setDataUrl(url);
      })
      .catch((err) => {
        console.error('Erro ao gerar QR code:', err);
      });
  }, [value, size]);

  const handleShareQrOnly = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dataUrl) return;

    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const fileName = `QRCode_VLI_${matricula || 'card'}.png`;
      const file = new File([blob], fileName, { type: 'image/png' });

      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `QR Code VLI - ${nome || matricula || 'Crachá'}`,
          text: `QR Code de Acesso e Verificação do Colaborador VLI`,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } else if (navigator.share) {
        await navigator.share({
          title: `QR Code VLI - ${nome || matricula || 'Crachá'}`,
          text: `QR Code do Colaborador VLI`,
          url: value,
        });
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      } else {
        // Fallback for browsers that don't support Web Share
        handleDownloadQr(e);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        handleDownloadQr(e);
      }
    }
  };

  const handleCopyLink = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
      const input = document.createElement('input');
      input.value = value;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownloadQr = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!dataUrl) return;
    const link = document.createElement('a');
    link.href = dataUrl;
    link.download = `QRCode_VLI_${matricula || 'card'}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="flex flex-col items-center justify-center p-3 bg-white rounded-xl border border-slate-200/80 shadow-xs">
      {dataUrl ? (
        <div className="relative group p-2 bg-white rounded-lg border border-slate-100 flex items-center justify-center">
          <img
            src={dataUrl}
            alt={`QR Code para ${nome || matricula || 'verificação'}`}
            style={{ width: size, height: size }}
            className="rounded-sm block"
          />
        </div>
      ) : (
        <div
          style={{ width: size, height: size }}
          className="bg-slate-50 animate-pulse rounded-lg flex items-center justify-center text-xs text-slate-400"
        >
          Gerando QR...
        </div>
      )}

      {label && (
        <p className="mt-2 text-xs font-bold text-[#002B49] text-center tracking-wide">
          {label}
        </p>
      )}

      {sublabel && (
        <p className="text-[11px] text-slate-500 text-center font-mono max-w-[220px] truncate mt-0.5">
          {sublabel}
        </p>
      )}

      {/* Botão funcional de compartilhar apenas o QR Code */}
      {showShareOnlyButton && (
        <button
          type="button"
          id={`btn-share-qr-only-${matricula || 'card'}`}
          onClick={handleShareQrOnly}
          className="mt-2.5 inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#002B49] hover:bg-blue-950 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all cursor-pointer border border-[#FFB81C]/40 group"
          title="Compartilhar apenas a imagem do QR Code"
        >
          <Share2 className="w-3.5 h-3.5 text-[#FFB81C] group-hover:scale-110 transition-transform" />
          <span>{shared ? 'QR Code Compartilhado!' : 'Compartilhar QR Code'}</span>
        </button>
      )}

      {showActions && (
        <div className="flex items-center gap-1.5 mt-2.5 pt-2 border-t border-slate-100 w-full justify-center">
          <button
            type="button"
            id={`share-qr-btn-${matricula || 'card'}`}
            onClick={handleShareQrOnly}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-[#002B49] bg-amber-50 hover:bg-amber-100 rounded-lg transition-colors border border-amber-200"
            title="Compartilhar imagem do QR Code"
          >
            {shared ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Share2 className="w-3.5 h-3.5 text-[#002B49]" />}
            <span>{shared ? 'Compartilhado!' : 'Compartilhar'}</span>
          </button>

          <button
            type="button"
            id={`copy-qr-btn-${matricula || 'card'}`}
            onClick={handleCopyLink}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Copiar link"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado!' : 'Copiar Link'}</span>
          </button>

          <button
            type="button"
            id={`download-qr-btn-${matricula || 'card'}`}
            onClick={handleDownloadQr}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
            title="Baixar QR Code PNG"
          >
            <Download className="w-3.5 h-3.5 text-slate-600" />
            <span>Baixar</span>
          </button>
        </div>
      )}
    </div>
  );
};
