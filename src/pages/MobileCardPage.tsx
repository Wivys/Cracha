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
  RotateCw,
  ArrowRight,
  X,
  UserCheck,
  Clock,
  Infinity,
} from 'lucide-react';
import { FuncionarioWithTreinamentos } from '../types';
import { dbService } from '../lib/supabase';
import { repairFuncionarioObject } from '../lib/textSanitizer';
import { QrCodeDisplay } from '../components/QrCodeDisplay';
import { VliLogo } from '../components/VliLogo';
import { VliAvatar } from '../components/VliAvatar';

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
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedVerificationLink, setCopiedVerificationLink] = useState(false);

  // Controle de alternância Frente e Verso (Giro 3D)
  const [cardSide, setCardSide] = useState<'frente' | 'verso'>('frente');

  // Modal de Pop-up do QR Code
  const [showQrModal, setShowQrModal] = useState(false);

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
      }
    };

    fetchColaborador();
  }, [matriculaOrId]);

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
        <div className="w-12 h-12 bg-rose-500/20 text-rose-400 rounded-2xl flex items-center justify-center mb-3">
          <AlertTriangle className="w-6 h-6" />
        </div>
        <h2 className="text-lg font-bold text-white mb-1">Crachá Não Encontrado</h2>
        <p className="text-slate-400 text-xs max-w-xs mb-4">{error}</p>
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 bg-[#FFB81C] text-slate-950 font-bold text-xs rounded-xl shadow-md cursor-pointer"
        >
          Voltar
        </button>
      </div>
    );
  }

  const cleanNameSlug = employee.nome.replace(/\s+/g, '').toUpperCase();
  const directTokenUrl = `http://autenticar.vli.com.br/token/${cleanNameSlug}`;
  const actualPublicUrl = `${window.location.origin}/card/${employee.matricula || employee.id}`;

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

  // Compartilhamento geral do crachá
  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: `Crachá VLI - ${employee.nome}`,
          text: `Acesse o crachá digital e certificações de ${employee.nome}:`,
          url: actualPublicUrl,
        });
        return;
      } catch {
        // Fallback para cópia
      }
    }

    try {
      await navigator.clipboard.writeText(actualPublicUrl);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
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
    <div className="min-h-screen bg-slate-100 md:bg-slate-900 py-3 sm:py-6 md:py-10 px-2 sm:px-4 md:px-6 flex flex-col items-center justify-start sm:justify-center relative overflow-x-hidden">
      {/* Controles Flutuantes Superiores - Adaptativo para Mobile e PC */}
      <div className="w-full max-w-md md:max-w-2xl mb-3 flex items-center justify-between z-20 px-1">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white sm:bg-slate-800/90 hover:bg-slate-50 sm:hover:bg-slate-800 text-slate-800 sm:text-slate-200 hover:text-slate-950 sm:hover:text-white rounded-xl text-xs font-bold transition-colors border border-slate-200 sm:border-slate-700 shadow-2xs cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>{isAdminLoggedIn ? 'Painel ADM' : 'Sair'}</span>
        </button>

        <div className="flex items-center gap-2">
          {/* Botão de Giro Superior Rápido */}
          <button
            type="button"
            onClick={handleToggleSide}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white sm:bg-slate-800/90 hover:bg-slate-50 sm:hover:bg-slate-800 text-[#002B49] sm:text-[#FFB81C] rounded-xl text-xs font-bold transition-all border border-slate-200 sm:border-slate-700 shadow-2xs cursor-pointer"
            title="Girar Crachá (Efeito 3D)"
          >
            <RotateCw className="w-3.5 h-3.5 transition-transform group-hover:rotate-180" />
            <span>Girar</span>
          </button>

          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#FFB81C] hover:bg-[#F5A800] text-slate-950 rounded-xl text-xs font-bold transition-colors shadow-2xs cursor-pointer"
            title="Abrir QR Code de Acesso"
          >
            <QrCode className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>QR Code</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white sm:bg-slate-800/90 hover:bg-slate-50 sm:hover:bg-slate-800 text-slate-800 sm:text-slate-200 hover:text-[#002B49] sm:hover:text-[#FFB81C] rounded-xl text-xs font-bold transition-colors border border-slate-200 sm:border-slate-700 shadow-2xs cursor-pointer"
            title="Compartilhar Link"
          >
            {copiedLink ? (
              <Check className="w-3.5 h-3.5 text-emerald-600 sm:text-emerald-400" />
            ) : (
              <Share2 className="w-3.5 h-3.5" />
            )}
            <span>{copiedLink ? 'Copiado!' : 'Compartilhar'}</span>
          </button>
        </div>
      </div>

      {/* CONTAINER COM PERSPECTIVA 3D PARA GIRO REAL DO CRACHÁ */}
      <div
        style={{ perspective: '1400px' }}
        className="w-full max-w-md md:max-w-2xl mx-auto"
      >
        <div
          id="cracha-card-3d"
          style={{
            transformStyle: 'preserve-3d',
            transform: cardSide === 'verso' ? 'rotateY(180deg)' : 'rotateY(0deg)',
            transition: 'transform 0.75s cubic-bezier(0.35, 0.1, 0.25, 1)',
            display: 'grid',
          }}
          className="w-full relative"
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
            className="w-full bg-white rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col justify-between transition-shadow"
          >
            <div>
              {/* Topo Oficial Azul Marinho VLI */}
              <div className="bg-[#002B49] text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between">
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
              <div className="px-3 sm:px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
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

                {/* Botão Girar Cartão com animação */}
                <button
                  type="button"
                  id="btn-girar-cracha-frente"
                  onClick={handleToggleSide}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#002B49] hover:text-amber-600 px-3 py-1.5 rounded-xl hover:bg-slate-200/70 transition-colors cursor-pointer"
                  title="Clique para girar o crachá em 3D"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Girar Cartão</span>
                </button>
              </div>

              {/* Corpo da Frente: Cabeçalho Lado a Lado */}
              <div className="p-4 sm:p-6 md:p-8 flex flex-col">
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
                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 gap-2.5 sm:gap-3 text-left">
                  <div className="p-3 bg-emerald-50/80 border border-emerald-200/80 rounded-2xl">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-emerald-800">
                      <Shield className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Status do Crachá</span>
                    </div>
                    <p className="text-sm font-extrabold text-emerald-700 mt-1">
                      Ativo & Regular
                    </p>
                  </div>

                  <div className="p-3 bg-blue-50/80 border border-blue-200/80 rounded-2xl">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#002B49]">
                      <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Treinamentos</span>
                    </div>
                    <p className="text-sm font-extrabold text-[#002B49] mt-1">
                      {treinamentosValidos}/{totalTreinamentos} válidos
                    </p>
                  </div>

                  <div className="col-span-2 md:col-span-1 p-3 bg-slate-50 border border-slate-200 rounded-2xl">
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
                <div className="mt-4 p-3 sm:p-4 bg-slate-50 rounded-2xl border border-slate-200 text-left sm:text-center">
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
                    <span className="text-xs font-mono font-bold text-[#002B49] group-hover:text-blue-950 truncate max-w-[280px] sm:max-w-none">
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

            {/* Ações do Rodapé da Frente */}
            <div className="p-4 sm:p-6 md:p-8 pt-0 space-y-2.5">
              <button
                type="button"
                id="btn-exportar-qr-code"
                onClick={() => setShowQrModal(true)}
                className="w-full py-3 px-5 bg-[#FFB81C] hover:bg-[#F5A800] active:scale-98 text-slate-950 font-black text-sm sm:text-base rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer border border-amber-400"
              >
                <QrCode className="w-5 h-5 text-slate-950 stroke-[2.5]" />
                <span>Exportar QR Code de Acesso</span>
              </button>

              <button
                type="button"
                id="btn-ver-treinamentos-girar"
                onClick={handleToggleSide}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer group"
              >
                <RotateCw className="w-4 h-4 text-slate-500 group-hover:rotate-180 transition-transform" />
                <span>Girar e Ver Treinamentos (Verso)</span>
                <ArrowRight className="w-4 h-4 text-slate-400 ml-auto" />
              </button>
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
            className="w-full bg-white rounded-2xl sm:rounded-3xl shadow-lg sm:shadow-2xl border border-slate-200/80 overflow-hidden flex flex-col justify-between transition-shadow"
          >
            <div>
              {/* Topo Oficial Azul Marinho VLI */}
              <div className="bg-[#002B49] text-white px-4 sm:px-6 py-3.5 sm:py-4 flex items-center justify-between">
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
              <div className="px-3 sm:px-6 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2">
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

                {/* Botão Girar Cartão */}
                <button
                  type="button"
                  id="btn-girar-cracha-verso"
                  onClick={handleToggleSide}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-[#002B49] hover:text-amber-600 px-3 py-1.5 rounded-xl hover:bg-slate-200/70 transition-colors cursor-pointer"
                  title="Clique para girar de volta para a Frente"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                  <span>Girar Cartão</span>
                </button>
              </div>

              {/* Conteúdo do Verso: Cabeçalho Compacto + Treinamentos Lado a Lado (2 por linha) */}
              <div className="p-4 sm:p-6 md:p-8 flex flex-col text-left">
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
                <div className="w-full border border-slate-200 rounded-2xl p-2 sm:p-3 bg-slate-50/50 max-h-60 sm:max-h-72 md:max-h-80 overflow-y-auto space-y-3">
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
                      {cursosUniversidadeVLi.length > 0 && (
                        <div className="pt-1 space-y-2">
                          <div className="flex items-center justify-between px-1">
                            <div className="flex items-center gap-1.5 text-xs font-extrabold text-[#002B49] uppercase">
                              <GraduationCap className="w-4 h-4" />
                              <span>Universidade VLi</span>
                            </div>
                            <span className="text-[9px] font-bold px-2 py-0.5 bg-blue-100 text-[#002B49] rounded-md">
                              {cursosUniversidadeVLi.length} itens
                            </span>
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

            {/* Ações do Rodapé do Verso */}
            <div className="p-4 sm:p-6 md:p-8 pt-0 space-y-2">
              <button
                type="button"
                id="btn-voltar-frente-girar"
                onClick={handleToggleSide}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-2 cursor-pointer group"
              >
                <RotateCw className="w-4 h-4 text-slate-500 group-hover:-rotate-180 transition-transform" />
                <span>Girar e Voltar para a Frente</span>
              </button>

              <button
                type="button"
                onClick={() => setShowQrModal(true)}
                className="w-full py-2.5 px-4 bg-[#FFB81C] hover:bg-[#F5A800] text-slate-950 font-black text-xs sm:text-sm rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <QrCode className="w-4 h-4 stroke-[2.5]" />
                <span>Exportar QR Code de Acesso</span>
              </button>
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

              {/* Botões de Ação do QR Code: Compartilhar e Fechar */}
              <div className="mt-4 w-full grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleShare}
                  className="py-2.5 px-3 bg-[#002B49] hover:bg-blue-950 text-white font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  <span>Compartilhar</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowQrModal(false)}
                  className="py-2.5 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs rounded-xl transition-colors flex items-center justify-center gap-1 cursor-pointer"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
