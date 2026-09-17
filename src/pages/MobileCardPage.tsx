import React, { useEffect, useState } from 'react';
import {
  Shield,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Share2,
  Check,
  Building2,
  Copy,
  GraduationCap,
  QrCode,
  X,
  UserCheck,
  Clock,
  Infinity,
  RefreshCw,
  Download,
} from 'lucide-react';
import { FuncionarioWithTreinamentos } from '../types';
import { dbService } from '../lib/supabase';
import { repairFuncionarioObject } from '../lib/textSanitizer';
import { buildShareableBadgeUrl } from '../lib/portableBadge';
import {
  isDailySyncDue,
  formatLastSyncDate,
  syncEmployeeWebtraining,
} from '../lib/webtrainingSync';
import { QrCodeDisplay } from '../components/QrCodeDisplay';
import { VliLogo } from '../components/VliLogo';
import { VliAvatar } from '../components/VliAvatar';
import { shareQrCodeAsJpg, downloadQrCodeAsJpg } from '../lib/qrCodeExport';

interface MobileCardPageProps {
  matriculaOrId: string;
  onBack: () => void;
  isAdminLoggedIn?: boolean;
}

export interface CountdownInfo {
  hasExpiration: boolean;
  isExpired: boolean;
  daysRemaining: number | null;
  displayCountdown: string;
  displayDate: string;
  badgeColor: 'emerald' | 'amber' | 'rose' | 'blue';
}

/**
 * Calcula a contagem regressiva para expiração do treinamento
 * ou identifica que o curso não possui expiração (Símbolo do Infinito ∞).
 */
export function getCountdownInfo(
  dataValidade?: string,
  status?: string,
  vencimentoTreinamento?: string
): CountdownInfo {
  const rawDate = (dataValidade || '').trim();
  const rawVenc = (vencimentoTreinamento || '').trim().toLowerCase();

  const isPermanent =
    !rawDate ||
    rawDate === 'indeterminado' ||
    rawDate === 'permanente' ||
    rawDate === 'sem_validade' ||
    rawDate === 'sem validade' ||
    rawDate === 'infinito' ||
    rawDate.startsWith('9999') ||
    rawVenc.includes('não aplicável') ||
    rawVenc.includes('nao aplicavel') ||
    rawVenc.includes('sem validade') ||
    rawVenc.includes('indeterminad') ||
    rawVenc.includes('permanente') ||
    rawVenc.includes('sem expiração') ||
    rawVenc.includes('sem expiracao');

  if (isPermanent) {
    return {
      hasExpiration: false,
      isExpired: false,
      daysRemaining: null,
      displayCountdown: 'Sem expiração',
      displayDate: '∞',
      badgeColor: 'blue',
    };
  }

  let expDate: Date | null = null;
  if (rawDate.includes('-')) {
    const parts = rawDate.split('-');
    if (parts.length === 3) {
      expDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
    }
  } else if (rawDate.includes('/')) {
    const parts = rawDate.split('/');
    if (parts.length === 3) {
      expDate = new Date(parseInt(parts[2], 10), parseInt(parts[1], 10) - 1, parseInt(parts[0], 10));
    }
  } else {
    const d = new Date(rawDate);
    if (!isNaN(d.getTime())) {
      expDate = d;
    }
  }

  if (!expDate || isNaN(expDate.getTime())) {
    return {
      hasExpiration: false,
      isExpired: false,
      daysRemaining: null,
      displayCountdown: 'Sem expiração',
      displayDate: '∞',
      badgeColor: 'blue',
    };
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  expDate.setHours(0, 0, 0, 0);

  const dayStr = String(expDate.getDate()).padStart(2, '0');
  const monthStr = String(expDate.getMonth() + 1).padStart(2, '0');
  const yearStr = expDate.getFullYear();
  const formattedDate = `${dayStr}/${monthStr}/${yearStr}`;

  const diffMs = expDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays < 0 || status === 'vencido') {
    const absDays = Math.abs(diffDays);
    return {
      hasExpiration: true,
      isExpired: true,
      daysRemaining: diffDays,
      displayCountdown: diffDays < 0 ? `Vencido há ${absDays}d` : 'Vencido',
      displayDate: formattedDate,
      badgeColor: 'rose',
    };
  }

  if (diffDays === 0) {
    return {
      hasExpiration: true,
      isExpired: false,
      daysRemaining: 0,
      displayCountdown: 'Expira hoje!',
      displayDate: formattedDate,
      badgeColor: 'amber',
    };
  }

  if (diffDays <= 30) {
    return {
      hasExpiration: true,
      isExpired: false,
      daysRemaining: diffDays,
      displayCountdown: `${diffDays}d restantes`,
      displayDate: formattedDate,
      badgeColor: 'amber',
    };
  }

  if (diffDays > 365) {
    const years = Math.floor(diffDays / 365);
    const remDays = diffDays % 365;
    return {
      hasExpiration: true,
      isExpired: false,
      daysRemaining: diffDays,
      displayCountdown: `${years}a ${remDays}d restantes`,
      displayDate: formattedDate,
      badgeColor: 'emerald',
    };
  }

  return {
    hasExpiration: true,
    isExpired: false,
    daysRemaining: diffDays,
    displayCountdown: `${diffDays}d restantes`,
    displayDate: formattedDate,
    badgeColor: 'emerald',
  };
}

/**
 * Página de Exibição do Crachá Digital VLI
 * - Giro 3D Real (Flip): Ao clicar em 'Girar', o cartão rotaciona literalmente 180° no eixo Y.
 * - Treinamentos lado a lado (2 por linha): Grade dividida ao meio, compacta e otimizada.
 * - Contagem Regressiva e Símbolo do Infinito (∞): Cursos com validade mostram os dias restantes;
 *   cursos sem expiração mostram o símbolo ∞.
 * - 100% Responsivo: Abre adaptado à tela do celular ou do PC sem molduras artificiais.
 */
export const MobileCardPage: React.FC<MobileCardPageProps> = ({
  matriculaOrId,
  onBack,
  isAdminLoggedIn = false,
}) => {
  const [employee, setEmployee] = useState<FuncionarioWithTreinamentos | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedVerificationLink, setCopiedVerificationLink] = useState(false);

  // Controle de alternância Frente e Verso (Giro 3D)
  const [cardSide, setCardSide] = useState<'frente' | 'verso'>('frente');

  // Modal de Pop-up do QR Code
  const [showQrModal, setShowQrModal] = useState(false);

  // Estado da Sincronização Diária da Universidade VLI
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncFeedback, setSyncFeedback] = useState<{
    message: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  useEffect(() => {
    const fetchColaborador = async () => {
      setLoading(true);
      setError(null);
      try {
        const found = await dbService.getFuncionarioByIdOrMatricula(matriculaOrId);
        if (found) {
          setEmployee(repairFuncionarioObject(found));
        } else {
          setError(`Colaborador com identificação "${matriculaOrId}" não encontrado.`);
        }
      } catch (err: any) {
        setError(err.message || 'Erro ao carregar dados do colaborador.');
      } finally {
        setLoading(false);
        setIsRetrying(false);
      }
    };

    fetchColaborador();
  }, [matriculaOrId, retryCount]);

  // Sincronização Diária Automática ao carregar o crachá
  useEffect(() => {
    if (!employee || !employee.webtraining_url || isSyncing) return;

    if (isDailySyncDue(employee.last_webtraining_sync)) {
      setIsSyncing(true);
      syncEmployeeWebtraining(employee, false)
        .then((res) => {
          setIsSyncing(false);
          if (res.updated) {
            setEmployee(repairFuncionarioObject(res.employee));
            setSyncFeedback({
              type: 'success',
              message:
                res.changesCount > 0
                  ? `${res.changesCount} atualização(ões) de vencimento/cursos sincronizada(s) da Universidade VLI!`
                  : 'Registros da Universidade VLI verificados hoje.',
            });
            setTimeout(() => setSyncFeedback(null), 5000);
          }
        })
        .catch(() => setIsSyncing(false));
    }
  }, [employee?.id, employee?.webtraining_url]);

  const handleManualSync = async () => {
    if (!employee || !employee.webtraining_url || isSyncing) return;
    setIsSyncing(true);
    setSyncFeedback(null);
    try {
      const res = await syncEmployeeWebtraining(employee, true);
      if (res.updated) {
        setEmployee(repairFuncionarioObject(res.employee));
        setSyncFeedback({ type: 'success', message: res.message });
      } else {
        setSyncFeedback({ type: res.error ? 'error' : 'info', message: res.message });
      }
    } catch (err: any) {
      setSyncFeedback({
        type: 'error',
        message: err.message || 'Falha ao sincronizar com a Universidade VLI.',
      });
    } finally {
      setIsSyncing(false);
      setTimeout(() => setSyncFeedback(null), 5000);
    }
  };

  const handleRetry = () => {
    setIsRetrying(true);
    setRetryCount((c) => c + 1);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-10 h-10 border-4 border-[#FFB81C] border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-white font-bold text-xs tracking-wider uppercase">
          Carregando Crachá VLI...
        </p>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-center">
        <div className="w-14 h-14 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-3 border border-rose-500/30">
          <AlertTriangle className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-white mb-1">Crachá Não Encontrado</h2>
        <p className="text-slate-300 text-xs sm:text-sm max-w-sm mb-4 leading-relaxed">{error}</p>

        <div className="bg-slate-800/80 border border-slate-700/80 rounded-2xl p-4 max-w-md w-full mb-6 text-left shadow-lg">
          <p className="text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
            Consulta de Crachá Digital VLI
          </p>
          <p className="text-slate-300 text-xs leading-relaxed">
            Verifique se a matrícula informada está correta e se o aparelho está conectado à internet para sincronização com a nuvem.
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <button
            type="button"
            onClick={handleRetry}
            disabled={isRetrying}
            className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md border border-slate-600 flex items-center gap-2 cursor-pointer transition-all disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRetrying ? 'animate-spin' : ''}`} />
            <span>Tentar Novamente</span>
          </button>
          <button
            type="button"
            onClick={onBack}
            className="px-5 py-2.5 bg-[#FFB81C] hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer transition-all"
          >
            Voltar ao Início
          </button>
        </div>
      </div>
    );
  }

  const cleanNameSlug = employee.nome.replace(/\s+/g, '').toUpperCase();
  const directTokenUrl = `http://autenticar.vli.com.br/token/${cleanNameSlug}`;
  const actualPublicUrl = `${window.location.origin}/card/${encodeURIComponent(employee.matricula || employee.id)}`;

  // Separação dos cursos
  const cursosManuais = employee.treinamentos.filter((t) => t.origem !== 'universidade_vli');
  const cursosUniversidadeVLi = employee.treinamentos.filter(
    (t) => t.origem === 'universidade_vli'
  );

  const totalTreinamentos = employee.treinamentos.length;
  const treinamentosValidos = employee.treinamentos.filter((t) => {
    const info = getCountdownInfo(t.data_validade, t.status, t.vencimento_treinamento);
    return !info.isExpired;
  }).length;

  // Alternar lado com animação 3D
  const handleToggleSide = () => {
    setCardSide((prev) => (prev === 'frente' ? 'verso' : 'frente'));
  };

  // Alternar gênero do avatar (H ou M)
  const handleUpdateGenero = async (newGenero: 'H' | 'M') => {
    if (!employee) return;
    setEmployee({ ...employee, genero: newGenero });
    try {
      await dbService.updateFuncionario(employee.id, {
        genero: newGenero,
      });
    } catch (e) {
      console.error('Erro ao atualizar gênero do colaborador:', e);
    }
  };

  // Estado de processamento e feedback de compartilhamento
  const [isSharing, setIsSharing] = useState(false);
  const [shareToast, setShareToast] = useState<string | null>(null);

  // Compartilhamento do QR Code oficial em formato JPG (Foto / Imagem)
  const handleShare = async () => {
    if (!employee || isSharing) return;
    setIsSharing(true);
    try {
      const res = await shareQrCodeAsJpg({
        url: actualPublicUrl || directTokenUrl,
        nome: employee.nome,
        matricula: employee.matricula,
        cargo: employee.cargo,
        unidade: employee.unidade,
      });

      if (res.sharedViaNative) {
        setCopiedLink(true);
        setShareToast('Foto JPG do QR Code compartilhada!');
        setTimeout(() => {
          setCopiedLink(false);
          setShareToast(null);
        }, 3000);
      } else if (res.downloaded) {
        setCopiedLink(true);
        setShareToast('Foto JPG salva no aparelho e link copiado!');
        setTimeout(() => {
          setCopiedLink(false);
          setShareToast(null);
        }, 3500);
      }
    } catch (err) {
      console.error('Erro ao compartilhar QR Code em JPG:', err);
    } finally {
      setIsSharing(false);
    }
  };

  // Download direto da foto JPG do QR Code
  const handleDownloadJpg = async () => {
    if (!employee) return;
    try {
      await downloadQrCodeAsJpg({
        url: actualPublicUrl || directTokenUrl,
        nome: employee.nome,
        matricula: employee.matricula,
        cargo: employee.cargo,
        unidade: employee.unidade,
      });
      setShareToast('Foto JPG baixada com sucesso!');
      setTimeout(() => setShareToast(null), 3000);
    } catch (err) {
      console.error('Erro ao baixar QR Code JPG:', err);
    }
  };

  // Cópia automática do link de verificação online
  const handleCopyVerificationLink = async (e?: React.MouseEvent) => {
    if (e) e.preventDefault();
    const linkToCopy = actualPublicUrl || directTokenUrl;
    try {
      await navigator.clipboard.writeText(linkToCopy);
      setCopiedVerificationLink(true);
      setTimeout(() => setCopiedVerificationLink(false), 2500);
    } catch {
      const input = document.createElement('input');
      input.value = linkToCopy;
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      setCopiedVerificationLink(true);
      setTimeout(() => setCopiedVerificationLink(false), 2500);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 md:bg-slate-900 py-0 sm:py-6 md:py-10 px-0 sm:px-4 md:px-6 flex flex-col items-center justify-start sm:justify-center relative overflow-x-hidden w-full">
      {/* Toast flutuante de confirmação do JPG */}
      {shareToast && (
        <div className="fixed top-3 sm:top-5 z-50 bg-[#002B49] text-white px-4 py-2.5 rounded-2xl shadow-xl border border-amber-400 flex items-center gap-2 text-xs font-bold animate-in fade-in slide-in-from-top-2">
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{shareToast}</span>
        </div>
      )}

      {/* Barra de Controles Superiores - Adaptativo para Mobile e PC */}
      <div className="w-full max-w-full sm:max-w-md md:max-w-2xl px-3 py-2.5 sm:px-1 sm:mb-3 flex items-center justify-between z-20 bg-slate-900/95 sm:bg-transparent backdrop-blur-md sm:backdrop-blur-none border-b border-slate-800/80 sm:border-0 sticky top-0 sm:static">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 sm:bg-white sm:hover:bg-slate-50 text-white sm:text-slate-800 rounded-xl text-xs font-bold transition-all border border-white/10 sm:border-slate-200 cursor-pointer shadow-xs"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isAdminLoggedIn ? 'Painel ADM' : 'Sair'}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Único botão de QR Code na tela - compacto e posicionado no topo */}
          <button
            type="button"
            id="btn-qrcode-topo"
            onClick={() => setShowQrModal(true)}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-[#FFB81C] hover:bg-[#F5A800] active:scale-95 text-slate-950 rounded-xl transition-all shadow-xs cursor-pointer border border-amber-400"
            title="Abrir QR Code de Acesso"
            aria-label="Abrir QR Code de Acesso"
          >
            <QrCode className="w-4 h-4 stroke-[2.5]" />
          </button>

          {/* Botão de Compartilhar Foto JPG - apenas com a imagem/ícone que já existe */}
          <button
            type="button"
            id="btn-compartilhar-topo"
            onClick={handleShare}
            disabled={isSharing}
            className="w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center bg-white/10 hover:bg-white/20 sm:bg-white sm:hover:bg-slate-50 active:scale-95 text-white sm:text-slate-800 hover:text-amber-300 sm:hover:text-[#002B49] rounded-xl transition-all border border-white/10 sm:border-slate-200 shadow-xs cursor-pointer disabled:opacity-50"
            title={copiedLink ? 'Foto JPG Enviada!' : 'Compartilhar Foto JPG do QR Code'}
            aria-label="Compartilhar Foto JPG do QR Code"
          >
            {copiedLink ? (
              <Check className="w-4 h-4 text-emerald-400 sm:text-emerald-600" />
            ) : (
              <Share2 className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* CONTAINER COM PERSPECTIVA 3D PARA GIRO REAL DO CRACHÁ */}
      <div
        style={{ perspective: '1400px' }}
        className="w-full max-w-full sm:max-w-md md:max-w-2xl mx-auto flex-1 flex flex-col"
      >
        <div
          id="cracha-card-3d"
          style={{
            transformStyle: 'preserve-3d',
            transform: cardSide === 'verso' ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.75s cubic-bezier(0.35, 0.1, 0.25, 1)',
            display: 'grid',
          }}
          className="w-full relative flex-1"
        >
          {/* =================================================================== */}
          {/* FACE 1: FRENTE DO CRACHÁ (IDENTIFICAÇÃO + STATUS + QR CODE)        */}
          {/* =================================================================== */}
          <div
            style={{
              gridArea: '1 / 1',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(0deg)',
              pointerEvents: cardSide === 'frente' ? 'auto' : 'none',
            }}
            className="w-full bg-white rounded-none sm:rounded-3xl shadow-none sm:shadow-2xl border-0 sm:border border-slate-200/80 overflow-hidden flex flex-col justify-between transition-shadow min-h-screen sm:min-h-0"
          >
            <div>
              {/* Topo Oficial Azul Marinho VLI */}
              <div className="bg-[#002B49] text-white px-3.5 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <VliLogo variant="white" size="md" showSubtitle={true} />
                </div>

                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-300">
                    Crachá Digital
                  </span>
                </div>
              </div>

              {/* Linha Divisória Dourada Oficial */}
              <div className="h-1.5 bg-[#FFB81C] w-full" />

              {/* Barra de Alternância Frente e Verso */}
              <div className="px-3 sm:px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-center">
                <div className="inline-flex p-1 bg-slate-200/80 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    id="tab-cracha-frente"
                    onClick={() => setCardSide('frente')}
                    className="px-3.5 sm:px-5 py-1.5 rounded-lg transition-all cursor-pointer bg-[#002B49] text-white shadow-xs"
                  >
                    Frente
                  </button>
                  <button
                    type="button"
                    id="tab-cracha-verso"
                    onClick={() => setCardSide('verso')}
                    className="px-3.5 sm:px-5 py-1.5 rounded-lg transition-all cursor-pointer text-slate-600 hover:text-slate-900"
                  >
                    Verso (Treinamentos)
                  </button>
                </div>
              </div>

              {/* Corpo da Frente: Cabeçalho Lado a Lado */}
              <div className="p-3.5 sm:p-6 md:p-8 flex flex-col">
                <div className="flex items-center gap-3 sm:gap-5 pb-4 border-b border-slate-100">
                  {/* Foto / Avatar à esquerda */}
                  <div className="shrink-0 flex flex-col items-center">
                    <VliAvatar
                      fotoUrl={employee.foto_url}
                      nome={employee.nome}
                      genero={employee.genero}
                      size="lg"
                      className="w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 rounded-2xl border-2 border-[#FFB81C] shadow-sm"
                    />
                    {/* 2 Botões abaixo do AVATAR: "H" e "M" do tamanho da letra */}
                    <div className="flex items-center justify-center gap-1 mt-1.5" title="Alterar avatar: H (Homem) ou M (Mulher)">
                      <button
                        type="button"
                        id="btn-cracha-avatar-h"
                        onClick={() => handleUpdateGenero('H')}
                        title="H - Homem (Avatar ferroviário VLi 8-bit)"
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded font-black text-[10px] sm:text-xs flex items-center justify-center transition-all cursor-pointer ${
                          employee.genero !== 'M'
                            ? 'bg-[#002B49] text-[#FFB81C] ring-1.5 ring-[#FF7A00] shadow-xs scale-105'
                            : 'bg-white/90 text-slate-600 border border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        H
                      </button>
                      <button
                        type="button"
                        id="btn-cracha-avatar-m"
                        onClick={() => handleUpdateGenero('M')}
                        title="M - Mulher (Avatar ferroviária VLi 8-bit)"
                        className={`w-5 h-5 sm:w-6 sm:h-6 rounded font-black text-[10px] sm:text-xs flex items-center justify-center transition-all cursor-pointer ${
                          employee.genero === 'M'
                            ? 'bg-[#002B49] text-[#FFB81C] ring-1.5 ring-[#FF7A00] shadow-xs scale-105'
                            : 'bg-white/90 text-slate-600 border border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                        }`}
                      >
                        M
                      </button>
                    </div>
                  </div>

                  {/* Nome e Matrícula à direita */}
                  <div className="min-w-0 flex-1 text-left">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-wider text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                        <UserCheck className="w-3 h-3 text-emerald-700" />
                        Colaborador Ativo
                      </span>
                    </div>

                    <h1 className="text-base sm:text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase leading-snug break-words">
                      {employee.nome}
                    </h1>

                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-xs sm:text-sm font-semibold text-slate-700">
                      <p className="font-mono">
                        Matrícula:{' '}
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {employee.matricula}
                        </span>
                      </p>
                      {employee.cargo && (
                        <span className="text-slate-500 font-medium truncate">
                          • {employee.cargo}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Painel de Indicadores Rápidos */}
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2 sm:gap-3 text-left">
                  <div className="p-2.5 sm:p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Status do Crachá</span>
                    </div>
                    <p className="text-sm font-extrabold text-emerald-700 mt-1">
                      Ativo & Regular
                    </p>
                  </div>

                  <div className="p-2.5 sm:p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#002B49]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Treinamentos</span>
                    </div>
                    <p className="text-sm font-extrabold text-[#002B49] mt-1">
                      {treinamentosValidos}/{totalTreinamentos} válidos
                    </p>
                  </div>

                  <div className="col-span-2 md:col-span-1 p-2.5 sm:p-3 bg-slate-50 border border-slate-200 rounded-2xl">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-600">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span>Unidade / Base</span>
                    </div>
                    <p className="text-xs sm:text-sm font-bold text-slate-800 truncate mt-1">
                      {employee.unidade || 'Corredor Centro-Leste'}
                    </p>
                  </div>
                </div>

                {/* Verificação Online (Clique para copiar) */}
                <div className="mt-3.5 p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left sm:text-center">
                  <span className="text-[11px] text-slate-500 font-semibold block mb-1">
                    Link de Verificação Online (clique para copiar):
                  </span>
                  <button
                    type="button"
                    id="btn-copiar-link-verificacao"
                    onClick={handleCopyVerificationLink}
                    className="group w-full flex items-center justify-between sm:justify-center gap-2 px-3 py-2 bg-white hover:bg-amber-50 active:scale-98 border border-slate-200 hover:border-amber-300 rounded-xl transition-all cursor-pointer"
                    title="Clique para copiar o link de verificação"
                  >
                    <span className="text-xs font-mono font-bold text-[#002B49] group-hover:text-blue-950 truncate max-w-[260px] sm:max-w-none">
                      {directTokenUrl}
                    </span>
                    {copiedVerificationLink ? (
                      <span className="inline-flex items-center gap-1 text-emerald-700 font-bold text-[10px] bg-emerald-100 px-2 py-0.5 rounded-md shrink-0">
                        <Check className="w-3 h-3 text-emerald-700" /> Copiado!
                      </span>
                    ) : (
                      <Copy className="w-3.5 h-3.5 text-slate-400 group-hover:text-[#002B49] shrink-0" />
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* Rodapé da Frente - Limpo e Oficial */}
            <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">VLI Credenciamento Digital</span>
              <span className="font-mono text-slate-400 text-[10px]">Autenticado • 100% Seguro</span>
            </div>
          </div>

          {/* =================================================================== */}
          {/* FACE 2: VERSO DO CRACHÁ (TREINAMENTOS 2 POR LINHA + CONTAGEM / ∞)  */}
          {/* =================================================================== */}
          <div
            style={{
              gridArea: '1 / 1',
              backfaceVisibility: 'hidden',
              WebkitBackfaceVisibility: 'hidden',
              transform: 'rotateY(180deg)',
              pointerEvents: cardSide === 'verso' ? 'auto' : 'none',
            }}
            className="w-full bg-white rounded-none sm:rounded-3xl shadow-none sm:shadow-2xl border-0 sm:border border-slate-200/80 overflow-hidden flex flex-col justify-between transition-shadow min-h-screen sm:min-h-0"
          >
            <div>
              {/* Topo Oficial Azul Marinho VLI */}
              <div className="bg-[#002B49] text-white px-3.5 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <VliLogo variant="white" size="md" showSubtitle={true} />
                </div>

                <div className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full border border-white/15">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  <span className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-amber-300">
                    Verso • Qualificações
                  </span>
                </div>
              </div>

              {/* Linha Divisória Dourada Oficial */}
              <div className="h-1.5 bg-[#FFB81C] w-full" />

              {/* Barra de Alternância Frente e Verso */}
              <div className="px-3 sm:px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-center">
                <div className="inline-flex p-1 bg-slate-200/80 rounded-xl text-xs font-bold">
                  <button
                    type="button"
                    onClick={() => setCardSide('frente')}
                    className="px-3.5 sm:px-5 py-1.5 rounded-lg transition-all cursor-pointer text-slate-600 hover:text-slate-900"
                  >
                    Frente
                  </button>
                  <button
                    type="button"
                    onClick={() => setCardSide('verso')}
                    className="px-3.5 sm:px-5 py-1.5 rounded-lg transition-all cursor-pointer bg-[#002B49] text-white shadow-xs"
                  >
                    Verso (Treinamentos)
                  </button>
                </div>
              </div>

              {/* Conteúdo do Verso: Cabeçalho Compacto + Treinamentos Lado a Lado (2 por linha) */}
              <div className="p-3.5 sm:p-6 md:p-8 flex flex-col text-left">
                {/* Cabeçalho Compacto do Colaborador */}
                <div className="flex items-center gap-3 pb-3 border-b border-slate-100">
                  <VliAvatar
                    fotoUrl={employee.foto_url}
                    nome={employee.nome}
                    genero={employee.genero}
                    size="sm"
                    className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl border border-[#FFB81C] shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm sm:text-base font-black text-slate-900 uppercase truncate">
                      {employee.nome}
                    </h3>
                    <p className="text-xs font-mono font-semibold text-slate-500">
                      Matrícula: {employee.matricula}
                    </p>
                  </div>
                  <span className="text-[10px] font-extrabold px-2 py-1 bg-amber-100 text-amber-900 rounded-lg border border-amber-300 shrink-0">
                    Verso
                  </span>
                </div>

                {/* Faixa Azul: "TREINAMENTOS ATIVOS" */}
                <div className="w-full mt-3 mb-2 bg-[#002B49] text-white py-1.5 px-3 sm:px-4 rounded-xl flex items-center justify-between">
                  <h2 className="text-xs font-black tracking-wider uppercase flex items-center gap-1.5">
                    <span>TREINAMENTOS ATIVOS</span>
                  </h2>
                  <span className="text-[11px] font-bold text-amber-300">
                    {treinamentosValidos} válidos / {totalTreinamentos} total
                  </span>
                </div>

                {/* LISTA DE TREINAMENTOS LADO A LADO (2 POR LINHA) COM SCROLL INTERNO */}
                <div className="w-full border border-slate-200 rounded-2xl p-2 sm:p-3 bg-slate-50/50 max-h-[380px] sm:max-h-80 md:max-h-96 overflow-y-auto space-y-3">
                  {employee.treinamentos.length === 0 ? (
                    <p className="text-xs sm:text-sm text-slate-500 text-center py-6">
                      Nenhum treinamento registrado no crachá.
                    </p>
                  ) : (
                    <>
                      {/* 1. CURSOS REGULARES / MANUAIS (GRADE 2 POR LINHA) */}
                      {cursosManuais.length > 0 && (
                        <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                          {cursosManuais.map((trn, idx) => {
                            const info = getCountdownInfo(
                              trn.data_validade,
                              trn.status,
                              trn.vencimento_treinamento
                            );

                            return (
                              <div
                                key={trn.id || idx}
                                className={`p-2 sm:p-2.5 bg-white rounded-xl border transition-all flex flex-col justify-between shadow-2xs ${
                                  info.isExpired
                                    ? 'border-rose-200 bg-rose-50/30'
                                    : !info.hasExpiration
                                    ? 'border-blue-200 bg-blue-50/20'
                                    : 'border-slate-200 hover:border-slate-300'
                                }`}
                              >
                                {/* Linha 1: Nome do Curso (2 linhas máximas para densidade perfeita) */}
                                <div>
                                  <h4
                                    className="text-[11px] sm:text-xs font-bold text-slate-900 leading-snug line-clamp-2"
                                    title={trn.nome_curso}
                                  >
                                    {trn.nome_curso}
                                  </h4>
                                </div>

                                {/* Linha 2: Data de Validade + Contagem Regressiva OU Símbolo de Infinito (∞) */}
                                <div className="mt-2 pt-1.5 border-t border-slate-100 flex flex-col gap-1">
                                  {info.hasExpiration ? (
                                    <>
                                      <div className="flex items-center justify-between text-[10px] text-slate-500">
                                        <span>Validade:</span>
                                        <span className="font-mono font-bold text-slate-700">
                                          {info.displayDate}
                                        </span>
                                      </div>

                                      {/* Contagem Regressiva e Status */}
                                      <div className="flex items-center justify-between gap-1 mt-0.5">
                                        <span
                                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0 ${
                                            info.badgeColor === 'rose'
                                              ? 'bg-rose-100 text-rose-800'
                                              : info.badgeColor === 'amber'
                                              ? 'bg-amber-100 text-amber-900'
                                              : 'bg-emerald-100 text-emerald-800'
                                          }`}
                                          title={`Contagem regressiva: ${info.displayCountdown}`}
                                        >
                                          <Clock className="w-2.5 h-2.5 shrink-0" />
                                          <span className="truncate max-w-[85px] sm:max-w-[110px]">
                                            {info.displayCountdown}
                                          </span>
                                        </span>

                                        {info.isExpired ? (
                                          <span className="text-[9px] font-bold text-rose-600 shrink-0">
                                            Vencido
                                          </span>
                                        ) : (
                                          <span className="text-[9px] font-bold text-emerald-600 shrink-0">
                                            Válido
                                          </span>
                                        )}
                                      </div>
                                    </>
                                  ) : (
                                    /* CURSO SEM EXPIRAÇÃO: SÍMBOLO DO INFINITO (∞) */
                                    <div className="flex items-center justify-between gap-1 py-0.5">
                                      <span className="text-[10px] text-slate-500 font-medium">
                                        Validade:
                                      </span>
                                      <span
                                        className="inline-flex items-center gap-1 text-[10px] font-black text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded-md"
                                        title="Curso permanente sem expiração"
                                      >
                                        <Infinity className="w-3.5 h-3.5 stroke-[2.5]" />
                                        <span>Infinito</span>
                                      </span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {/* 2. CURSOS DA UNIVERSIDADE VLI (GRADE 2 POR LINHA) */}
                      {(cursosUniversidadeVLi.length > 0 || employee.webtraining_url) && (
                        <div className="pt-1 space-y-2">
                          <div className="flex flex-col gap-1.5 px-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#002B49] uppercase">
                                <GraduationCap className="w-4 h-4" />
                                <span>Universidade VLi</span>
                              </div>
                              <div className="flex items-center gap-1.5">
                                {employee.webtraining_url && (
                                  <button
                                    type="button"
                                    id="btn-sincronizar-webtraining-card"
                                    onClick={handleManualSync}
                                    disabled={isSyncing}
                                    title="Sincronizar vencimentos com a Universidade VLI agora"
                                    className="px-2 py-0.5 bg-blue-100 hover:bg-blue-200 active:scale-95 text-[#002B49] font-bold text-[10px] rounded-md transition-all flex items-center gap-1 cursor-pointer disabled:opacity-50"
                                  >
                                    <RefreshCw className={`w-3 h-3 ${isSyncing ? 'animate-spin' : ''}`} />
                                    <span>{isSyncing ? 'Atualizando...' : 'Sincronizar'}</span>
                                  </button>
                                )}
                                <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-100 text-[#002B49] rounded-md">
                                  {cursosUniversidadeVLi.length} itens
                                </span>
                              </div>
                            </div>

                            {/* Informações de Sincronização Diária */}
                            {employee.webtraining_url && (
                              <div className="flex items-center justify-between text-[9px] text-slate-500 bg-blue-50/60 px-2 py-1 rounded-md border border-blue-100">
                                <span className="flex items-center gap-1 text-emerald-700 font-semibold">
                                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                                  Sincronização diária ativa
                                </span>
                                <span>{formatLastSyncDate(employee.last_webtraining_sync)}</span>
                              </div>
                            )}

                            {syncFeedback && (
                              <div
                                className={`text-[10px] px-2 py-1 rounded-md flex items-center gap-1 font-semibold ${
                                  syncFeedback.type === 'success'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : syncFeedback.type === 'error'
                                    ? 'bg-rose-100 text-rose-800'
                                    : 'bg-blue-100 text-blue-800'
                                }`}
                              >
                                {syncFeedback.type === 'success' ? (
                                  <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                                ) : (
                                  <AlertTriangle className="w-3 h-3 text-rose-600 shrink-0" />
                                )}
                                <span>{syncFeedback.message}</span>
                              </div>
                            )}
                          </div>

                          <div className="grid grid-cols-2 gap-2 sm:gap-2.5">
                            {cursosUniversidadeVLi.map((trn, idx) => {
                              const info = getCountdownInfo(
                                trn.data_validade,
                                trn.status,
                                trn.vencimento_treinamento
                              );

                              return (
                                <div
                                  key={trn.id || idx}
                                  className="p-2 sm:p-2.5 bg-blue-50/40 rounded-xl border border-blue-200/80 flex flex-col justify-between shadow-2xs hover:border-blue-300 transition-all"
                                >
                                  <div>
                                    {trn.categoria && (
                                      <span className="text-[8px] font-extrabold uppercase text-blue-900 bg-blue-100 px-1.5 py-0.5 rounded inline-block mb-1 truncate max-w-full">
                                        {trn.categoria}
                                      </span>
                                    )}

                                    <h5
                                      className="text-[11px] sm:text-xs font-bold text-slate-900 leading-snug line-clamp-2"
                                      title={trn.nome_curso}
                                    >
                                      {trn.nome_curso}
                                    </h5>
                                  </div>

                                  <div className="mt-2 pt-1.5 border-t border-blue-100 flex flex-col gap-1">
                                    {info.hasExpiration ? (
                                      <>
                                        <div className="flex items-center justify-between text-[10px] text-slate-600">
                                          <span>Venc:</span>
                                          <span className="font-mono font-bold text-slate-800">
                                            {info.displayDate}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between gap-1 mt-0.5">
                                          <span
                                            className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md flex items-center gap-1 shrink-0 ${
                                              info.badgeColor === 'rose'
                                                ? 'bg-rose-100 text-rose-800'
                                                : info.badgeColor === 'amber'
                                                ? 'bg-amber-100 text-amber-900'
                                                : 'bg-emerald-100 text-emerald-800'
                                            }`}
                                            title={`Contagem: ${info.displayCountdown}`}
                                          >
                                            <Clock className="w-2.5 h-2.5 shrink-0" />
                                            <span className="truncate max-w-[85px] sm:max-w-[110px]">
                                              {info.displayCountdown}
                                            </span>
                                          </span>

                                          <span
                                            className={`text-[9px] font-bold shrink-0 ${
                                              info.isExpired
                                                ? 'text-rose-600'
                                                : 'text-emerald-600'
                                            }`}
                                          >
                                            {trn.status_webtraining ||
                                              (info.isExpired ? 'Vencido' : 'Liberado')}
                                          </span>
                                        </div>
                                      </>
                                    ) : (
                                      /* SÍMBOLO DO INFINITO (∞) */
                                      <div className="flex items-center justify-between gap-1 py-0.5">
                                        <span className="text-[10px] text-slate-500 font-medium">
                                          Validade:
                                        </span>
                                        <span className="inline-flex items-center gap-1 text-[10px] font-black text-blue-800 bg-blue-100/90 px-2 py-0.5 rounded-md">
                                          <Infinity className="w-3.5 h-3.5 stroke-[2.5]" />
                                          <span>Infinito</span>
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Rodapé do Verso - Limpo e Oficial */}
            <div className="px-4 sm:px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
              <span className="font-semibold text-slate-600">Universidade VLI</span>
              <span className="font-mono text-slate-400 text-[10px]">{treinamentosValidos}/{totalTreinamentos} Cursos Ativos</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. MODAL / POP-UP: EXPORTAR QR CODE DE ACESSO */}
      {showQrModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            {/* Topo do Modal com Barra VLI */}
            <div className="bg-[#002B49] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-amber-400">
              <div className="flex items-center gap-2">
                <div className="p-1 bg-[#FFB81C] rounded-lg">
                  <QrCode className="w-4 h-4 text-slate-950 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-white leading-tight">
                    QR Code de Acesso
                  </h3>
                  <p className="text-[10px] text-amber-300 font-mono">
                    {employee.nome} • {employee.matricula}
                  </p>
                </div>
              </div>

              <button
                type="button"
                id="btn-fechar-modal-qr"
                onClick={() => setShowQrModal(false)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
                title="Fechar"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Conteúdo do Modal: QR Code Nítido e Opções */}
            <div className="p-5 flex flex-col items-center text-center">
              {/* Moldura Nítida do QR Code */}
              <div className="p-3 bg-white rounded-2xl border-2 border-slate-200 shadow-sm">
                <QrCodeDisplay
                  value={actualPublicUrl}
                  size={180}
                  showActions={false}
                  matricula={employee.matricula}
                  nome={employee.nome}
                  cargo={employee.cargo}
                />
              </div>

              <span className="text-[11px] font-black text-slate-800 tracking-wider uppercase mt-3">
                ESCANEAR PARA VERIFICAÇÃO
              </span>

              {/* Verificação Online com cópia automática */}
              <div className="mt-3 w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl">
                <span className="text-[10px] text-slate-500 font-semibold block mb-1">
                  Link de Verificação Online:
                </span>
                <button
                  type="button"
                  onClick={handleCopyVerificationLink}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-amber-50 active:scale-98 border border-slate-200 hover:border-amber-300 rounded-lg transition-all cursor-pointer"
                  title="Clique para copiar"
                >
                  <span className="text-[10px] font-mono font-bold text-[#002B49] truncate">
                    {directTokenUrl}
                  </span>
                  {copiedVerificationLink ? (
                    <span className="inline-flex items-center gap-0.5 text-emerald-600 font-bold text-[9px] bg-emerald-100 px-1 py-0.5 rounded shrink-0">
                      <Check className="w-2.5 h-2.5" /> Copiado!
                    </span>
                  ) : (
                    <Copy className="w-3 h-3 text-slate-400 group-hover:text-[#002B49] shrink-0" />
                  )}
                </button>
              </div>

              {/* Botões de Ação do QR Code: Compartilhar Foto JPG, Baixar Foto JPG e Fechar */}
              <div className="mt-4 w-full grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="btn-compartilhar-modal-jpg"
                  onClick={handleShare}
                  disabled={isSharing}
                  className="py-2.5 px-3 bg-[#002B49] hover:bg-blue-950 active:scale-95 text-white font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-xs border border-amber-400/30 disabled:opacity-50"
                  title="Compartilhar Foto JPG do QR Code"
                >
                  <Share2 className="w-3.5 h-3.5 text-[#FFB81C]" />
                  <span>{isSharing ? 'Gerando...' : 'Compartilhar (JPG)'}</span>
                </button>

                <button
                  type="button"
                  id="btn-baixar-modal-jpg"
                  onClick={handleDownloadJpg}
                  className="py-2.5 px-3 bg-amber-50 hover:bg-amber-100 active:scale-95 text-[#002B49] font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-1.5 cursor-pointer border border-amber-300 shadow-xs"
                  title="Baixar Foto JPG do QR Code"
                >
                  <Download className="w-3.5 h-3.5 text-amber-600" />
                  <span>Baixar JPG</span>
                </button>
              </div>

              <button
                type="button"
                id="btn-fechar-modal-acao"
                onClick={() => setShowQrModal(false)}
                className="mt-2.5 w-full py-2 px-3 bg-slate-100 hover:bg-slate-200 active:scale-98 text-slate-700 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
