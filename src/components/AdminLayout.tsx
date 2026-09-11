import React, { useState, useMemo } from 'react';
import { VliLogo } from './VliLogo';
import {
  Bell,
  User,
  LayoutGrid,
  Edit3,
  Info,
  LogOut,
  Database,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Check,
  X,
} from 'lucide-react';
import { AdminUser, FuncionarioWithTreinamentos } from '../types';
import { getSupabase } from '../lib/supabase';

interface AdminLayoutProps {
  currentTab: 'galeria' | 'cadastro';
  onSelectTab: (tab: 'galeria' | 'cadastro') => void;
  adminUser: AdminUser | null;
  onLogout: () => void;
  onOpenSupabaseModal: () => void;
  employees?: FuncionarioWithTreinamentos[];
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onSelectTab,
  adminUser,
  onLogout,
  onOpenSupabaseModal,
  employees = [],
  children,
}) => {
  const isSupabaseConnected = Boolean(getSupabase());
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [lastDismissedTime, setLastDismissedTime] = useState<number>(() => {
    try {
      return Number(localStorage.getItem('vli_notifications_dismissed_at') || '0');
    } catch {
      return 0;
    }
  });

  // Análise em tempo real dos cursos e vencimentos
  const { expiredList, expiringSoonList } = useMemo(() => {
    const expired: Array<{ colab: string; matricula: string; curso: string; data: string }> = [];
    const expiringSoon: Array<{ colab: string; matricula: string; curso: string; data: string }> = [];

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const in30Days = new Date(today);
    in30Days.setDate(in30Days.getDate() + 30);

    employees.forEach((emp) => {
      (emp.treinamentos || []).forEach((trn) => {
        const valStr = trn.data_validade || '';
        const isPermanente =
          valStr.toLowerCase().includes('indeterminado') ||
          valStr.toLowerCase().includes('infinito') ||
          valStr.startsWith('2099');

        if (trn.status === 'vencido') {
          expired.push({
            colab: emp.nome,
            matricula: emp.matricula,
            curso: trn.nome_curso,
            data: trn.data_validade,
          });
          return;
        }

        if (!isPermanente && valStr) {
          const trnDate = new Date(valStr);
          if (!isNaN(trnDate.getTime())) {
            if (trnDate < today) {
              expired.push({
                colab: emp.nome,
                matricula: emp.matricula,
                curso: trn.nome_curso,
                data: trn.data_validade,
              });
            } else if (trnDate >= today && trnDate <= in30Days) {
              expiringSoon.push({
                colab: emp.nome,
                matricula: emp.matricula,
                curso: trn.nome_curso,
                data: trn.data_validade,
              });
            }
          }
        }
      });
    });

    return { expiredList: expired, expiringSoonList: expiringSoon };
  }, [employees]);

  // Contagem de alertas ativos
  const totalAlerts = expiredList.length + expiringSoonList.length;
  const hasUnreadAlerts = totalAlerts > 0 && lastDismissedTime < Date.now() - 3600000;

  const handleDismissNotifications = () => {
    const now = Date.now();
    setLastDismissedTime(now);
    try {
      localStorage.setItem('vli_notifications_dismissed_at', String(now));
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col">
      {/* TOP BAR: Dark Blue Bar matching 1.jpg */}
      <header className="h-14 bg-[#002B49] text-white px-4 sm:px-6 flex items-center justify-between border-b-2 border-amber-400 z-30 sticky top-0 shadow-sm">
        {/* Left: VLi Logo in white with yellow dot */}
        <div className="flex items-center gap-3">
          <VliLogo variant="white" size="sm" />
          <span className="hidden md:inline-block text-[11px] font-bold text-amber-300/90 pl-3 border-l border-white/20 uppercase tracking-wider">
            Painel Administrativo
          </span>
        </div>

        {/* Right: Notification Bell & User Circle */}
        <div className="flex items-center gap-3">
          {/* Notification Bell Funcional */}
          <div className="relative">
            <button
              type="button"
              id="btn-notificacoes-sistema"
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white relative transition-colors cursor-pointer"
              title="Notificações do Sistema"
            >
              <Bell className="w-4 h-4" />
              {hasUnreadAlerts && (
                <span className="absolute -top-1 -right-1 min-w-4 h-4 px-1 bg-amber-500 text-slate-950 text-[10px] font-extrabold rounded-full flex items-center justify-center ring-2 ring-[#002B49] animate-pulse">
                  {totalAlerts}
                </span>
              )}
            </button>

            {showNotifications && (
              <div
                id="popover-notificacoes"
                className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 p-4 z-40 text-slate-900 animate-in fade-in"
              >
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-[#002B49]" />
                    <span className="text-xs font-black text-[#002B49] uppercase tracking-wide">
                      Notificações do Sistema
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {hasUnreadAlerts && (
                      <button
                        type="button"
                        onClick={handleDismissNotifications}
                        className="text-[10px] text-slate-500 hover:text-[#002B49] font-semibold flex items-center gap-0.5 cursor-pointer"
                        title="Marcar como lidas"
                      >
                        <Check className="w-3 h-3" />
                        Lidas
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setShowNotifications(false)}
                      className="text-slate-400 hover:text-slate-600 cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                <div className="py-2.5 space-y-2.5 max-h-72 overflow-y-auto text-xs">
                  {/* 1. Alerta de Cursos Vencidos */}
                  {expiredList.length > 0 ? (
                    <div className="p-3 bg-rose-50 rounded-xl border border-rose-200 text-rose-950">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-bold text-xs text-rose-900">
                            {expiredList.length} Treinamento(s) Vencido(s)
                          </div>
                          <p className="text-[11px] text-rose-800 mt-0.5">
                            Existem colaboradores com cursos fora da validade.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTab('galeria');
                              setShowNotifications(false);
                            }}
                            className="mt-2 text-[10px] font-extrabold text-rose-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            Ver na Galeria de Cards &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* 2. Alerta de Cursos a Vencer nos Próximos 30 Dias */}
                  {expiringSoonList.length > 0 ? (
                    <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-amber-950">
                      <div className="flex items-start gap-2">
                        <Clock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-bold text-xs text-amber-900">
                            {expiringSoonList.length} Curso(s) a Vencer em Breve
                          </div>
                          <p className="text-[11px] text-amber-800 mt-0.5">
                            Expiram nos próximos 30 dias. Programe a reciclagem operacional.
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              onSelectTab('galeria');
                              setShowNotifications(false);
                            }}
                            className="mt-2 text-[10px] font-extrabold text-amber-900 hover:underline inline-flex items-center gap-1 cursor-pointer"
                          >
                            Conferir na Galeria &rarr;
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* 3. Status de Conformidade quando não há pendências */}
                  {expiredList.length === 0 && expiringSoonList.length === 0 && (
                    <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-950">
                      <div className="flex items-center gap-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <div>
                          <div className="font-bold text-xs text-emerald-900">
                            Operação em Conformidade
                          </div>
                          <p className="text-[11px] text-emerald-700 mt-0.5">
                            Todos os crachás e cursos cadastrados estão válidos e regulares.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 4. Status de Armazenamento e Banco de Dados */}
                  <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-slate-700 flex items-start gap-2">
                    {isSupabaseConnected ? (
                      <>
                        <Database className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-bold text-xs text-slate-900">
                            Supabase Conectado
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Sincronização em nuvem ativa em tempo real.
                          </p>
                        </div>
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                        <div className="flex-1">
                          <div className="font-bold text-xs text-slate-900">
                            Persistência Local &amp; Servidor
                          </div>
                          <p className="text-[11px] text-slate-500">
                            {employees.length} colaborador(es) cadastrado(s) com dados preservados.
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
                  <span>Atualizado agora</span>
                  <button
                    type="button"
                    onClick={onOpenSupabaseModal}
                    className="text-[#002B49] font-bold hover:underline cursor-pointer"
                  >
                    Status do Banco &rarr;
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* User Circle Avatar */}
          <div
            className="w-8 h-8 rounded-full bg-white/20 border border-white/30 flex items-center justify-center text-white text-xs font-bold shadow-2xs"
            title={adminUser?.nome || 'Administrador VLI'}
          >
            <User className="w-4 h-4" />
          </div>
        </div>
      </header>

      {/* BODY WITH LEFT SIDEBAR */}
      <div className="flex-1 flex">
        {/* LEFT SIDEBAR: Dark Blue with icons */}
        <aside className="w-14 sm:w-16 bg-[#002B49] text-white flex flex-col items-center py-4 justify-between border-r border-slate-800 shrink-0 select-none">
          {/* Top Icons */}
          <div className="flex flex-col items-center gap-3 w-full px-2">
            {/* 1: Pencil / Cadastro icon */}
            <button
              type="button"
              id="sidebar-btn-cadastro"
              onClick={() => onSelectTab('cadastro')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                currentTab === 'cadastro'
                  ? 'bg-white text-[#002B49] shadow-md ring-2 ring-[#FFB81C]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Cadastro e Criação de Cards"
            >
              <Edit3 className="w-4 h-4 sm:w-5 sm:h-5" />
              {currentTab === 'cadastro' && (
                <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-1.5 h-4 bg-[#FFB81C] rounded-l" />
              )}
            </button>

            {/* 2: Folder / Gallery icon */}
            <button
              type="button"
              id="sidebar-btn-galeria"
              onClick={() => onSelectTab('galeria')}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all cursor-pointer relative ${
                currentTab === 'galeria'
                  ? 'bg-white text-[#002B49] shadow-md ring-2 ring-[#FFB81C]'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
              title="Galeria de Cards"
            >
              <LayoutGrid className="w-4 h-4 sm:w-5 sm:h-5" />
              {currentTab === 'galeria' && (
                <span className="absolute -right-2 top-1/2 -translate-y-1/2 w-1.5 h-4 bg-[#FFB81C] rounded-l" />
              )}
            </button>

            {/* 3: Info icon */}
            <button
              type="button"
              onClick={() => setShowInfoModal(true)}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-slate-300 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Informações do Sistema"
            >
              <Info className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>

          {/* Bottom Icons: Logout */}
          <div className="flex flex-col items-center gap-2 w-full px-2">
            <button
              type="button"
              onClick={onLogout}
              className="w-10 h-10 rounded-xl flex items-center justify-center text-rose-400 hover:text-rose-200 hover:bg-rose-950/40 transition-colors cursor-pointer"
              title="Sair do Painel"
            >
              <LogOut className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 bg-slate-100 overflow-y-auto flex flex-col">
          {children}
        </main>
      </div>

      {/* Info Modal */}
      {showInfoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl p-6 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-black text-sm text-[#002B49]">Sobre o Sistema VLI</h3>
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="py-3 text-xs text-slate-600 space-y-2">
              <p>
                <strong>Plataforma de Gestão de Crachás e Normas VLI.</strong>
              </p>
              <p>
                Permite a criação rápida de crachás digitais com QR Code dinâmico, monitoramento de prazos de validade de treinamentos e consulta pública mobile-first.
              </p>
              <div className="p-2.5 bg-slate-50 rounded-lg font-mono text-[11px] text-slate-700">
                Padrão Visual: Azul Marinho (#002B49) e Amarelo (#FFB81C)
              </div>
            </div>
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={() => setShowInfoModal(false)}
                className="px-4 py-1.5 bg-[#002B49] text-white text-xs font-bold rounded-lg"
              >
                Entendido
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
