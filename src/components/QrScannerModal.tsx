import React, { useState, useEffect, useRef } from 'react';
import jsQR from 'jsqr';
import { QrCode, X, AlertCircle, Upload, CheckCircle2, Image as ImageIcon, ArrowRight } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScan?: (scannedValue: string) => void;
  onScanSuccess?: (scannedValue: string) => void;
}

export const QrScannerModal: React.FC<QrScannerModalProps> = ({
  isOpen,
  onClose,
  onScan,
  onScanSuccess,
}) => {
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [scannedFeedback, setScannedFeedback] = useState<string | null>(null);
  const [manualInput, setManualInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const triggerScanCallback = (val: string) => {
    if (onScan) onScan(val);
    if (onScanSuccess) onScanSuccess(val);
  };

  const playBeep = () => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, audioCtx.currentTime);
      gain.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.15);
    } catch {
      // Audio not supported or allowed
    }
  };

  const processDecodedText = (rawText: string) => {
    playBeep();
    setScannedFeedback(rawText);

    // Extract ID or matricula from URL if it's a link (e.g. /card/VLI-89201 or token/...)
    let extracted = rawText.trim();
    if (extracted.includes('/card/')) {
      const parts = extracted.split('/card/');
      extracted = parts[parts.length - 1].split('?')[0].split('#')[0];
    } else if (extracted.includes('/token/')) {
      const parts = extracted.split('/token/');
      extracted = parts[parts.length - 1].split('?')[0].split('#')[0];
    } else if (extracted.includes('matricula=')) {
      const match = extracted.match(/matricula=([^&]+)/);
      if (match) extracted = decodeURIComponent(match[1]);
    }

    setTimeout(() => {
      triggerScanCallback(extracted);
      onClose();
    }, 600);
  };

  const decodeImageFile = (file: File) => {
    setErrorMessage(null);
    setScannedFeedback(null);
    setIsProcessing(true);

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = img.width;
          canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            setErrorMessage('Falha ao inicializar o processador de imagem.');
            setIsProcessing(false);
            return;
          }
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: 'dontInvert',
          });

          if (code && code.data) {
            processDecodedText(code.data);
          } else {
            setErrorMessage('Nenhum QR Code legível foi detectado na imagem enviada. Certifique-se de que o código esteja nítido ou insira a matrícula manualmente.');
          }
        } catch (err: any) {
          setErrorMessage(err.message || 'Erro ao processar imagem do QR Code.');
        } finally {
          setIsProcessing(false);
        }
      };
      img.onerror = () => {
        setErrorMessage('Não foi possível ler o arquivo de imagem selecionado.');
        setIsProcessing(false);
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      decodeImageFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      decodeImageFile(file);
    }
  };

  // Suporte a colar imagem da área de transferência (Ctrl+V)
  useEffect(() => {
    if (!isOpen) return;

    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith('image/')) {
          const file = items[i].getAsFile();
          if (file) {
            decodeImageFile(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isOpen]);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualInput.trim()) return;
    processDecodedText(manualInput.trim());
  };

  if (!isOpen) return null;

  return (
    <div
      id="qr-scanner-modal-overlay"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div
        id="qr-scanner-modal-card"
        className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200"
      >
        {/* Modal Header */}
        <div className="bg-[#002B49] text-white px-5 py-4 flex items-center justify-between border-b-2 border-amber-400">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-400 flex items-center justify-center text-amber-400">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">Leitura de QR Code</h3>
              <p className="text-xs text-amber-200 font-medium">Envie a imagem ou cole o link do crachá</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body: Upload de Imagem do QR Code (sem uso de câmera) */}
        <div className="p-6 space-y-4 text-center">
          {/* Sucesso no reconhecimento */}
          {scannedFeedback ? (
            <div className="py-6 px-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex flex-col items-center">
              <CheckCircle2 className="w-12 h-12 text-emerald-600 mb-2 animate-bounce" />
              <p className="font-black text-slate-900 text-base">QR Code Reconhecido!</p>
              <p className="text-xs text-emerald-700 font-mono mt-1 break-all max-w-xs">{scannedFeedback}</p>
              <p className="text-xs text-slate-500 mt-2">Carregando crachá do colaborador...</p>
            </div>
          ) : (
            <>
              {/* Área de Drag and Drop / Seleção de Imagem */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-slate-300 hover:border-[#002B49] bg-slate-50 hover:bg-amber-50/40 p-6 rounded-2xl cursor-pointer transition-all flex flex-col items-center justify-center group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                <div className="w-14 h-14 bg-white rounded-2xl shadow-xs border border-slate-200 flex items-center justify-center text-[#002B49] group-hover:scale-105 transition-transform mb-3">
                  {isProcessing ? (
                    <div className="w-6 h-6 border-3 border-[#002B49] border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Upload className="w-7 h-7 text-[#002B49]" />
                  )}
                </div>

                <h4 className="font-extrabold text-sm text-slate-900 group-hover:text-[#002B49]">
                  {isProcessing ? 'Processando imagem...' : 'Clique para selecionar imagem do QR Code'}
                </h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs">
                  Ou arraste uma foto/print do crachá aqui. Você também pode colar com <kbd className="px-1.5 py-0.5 bg-white border border-slate-300 rounded text-[10px] font-mono">Ctrl+V</kbd>.
                </p>

                <button
                  type="button"
                  className="mt-4 px-4 py-2 bg-[#002B49] hover:bg-[#003860] text-white font-bold text-xs rounded-xl shadow-xs inline-flex items-center gap-1.5"
                >
                  <ImageIcon className="w-4 h-4" />
                  <span>Escolher Arquivo de Imagem</span>
                </button>
              </div>

              {/* Mensagem de Erro (se houver) */}
              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-left flex items-start gap-2 text-rose-800 text-xs">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">Aviso</span>
                    <span>{errorMessage}</span>
                  </div>
                </div>
              )}

              {/* Opção Alternativa: Colar Link ou Código Direto */}
              <div className="pt-2 border-t border-slate-100 text-left">
                <label className="block text-[11px] font-bold text-slate-600 mb-1">
                  Ou cole o link/código do QR diretamente:
                </label>
                <form onSubmit={handleManualSubmit} className="flex gap-2">
                  <input
                    type="text"
                    value={manualInput}
                    onChange={(e) => setManualInput(e.target.value)}
                    placeholder="Ex: VLI-89201 ou link completo"
                    className="flex-1 px-3 py-2 text-xs border border-slate-300 rounded-xl focus:ring-2 focus:ring-[#002B49] focus:outline-none font-mono"
                  />
                  <button
                    type="submit"
                    disabled={!manualInput.trim()}
                    className="px-3.5 py-2 bg-[#FFB81C] hover:bg-[#F5A800] disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl transition-colors inline-flex items-center gap-1 cursor-pointer"
                  >
                    <span>Abrir</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </form>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-medium">Sem necessidade de permissão de câmera</span>
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
