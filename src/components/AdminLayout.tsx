import React, { useState } from 'react';
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
  X,
} from 'lucide-react';
import { AdminUser } from '../types';
import { getSupabase } from '../lib/supabase';

interface AdminLayoutProps {
  currentTab: 'galeria' | 'cadastro';
  onSelectTab: (tab: 'galeria' | 'cadastro') => void;
  adminUser: AdminUser | null;
  onLogout: () => void;
  onOpenSupabaseModal: () => void;
  children: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  currentTab,
  onSelectTab,
  adminUser,
  onLogout,
  onOpenSupabaseModal,
  children,
}) => {
  const isSupabaseConnected = Boolean(getSupabase());
  const [showInfoModal, setShowInfoModal] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

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
          {/* Notification Bell */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowNotifications(!showNotifications)}
              className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center text-white relative transition-colors cursor-pointer"
              title="Notificações"
            >
              <Bell className="w-4 h-4" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-amber-400 rounded-full ring-2 ring-[#002B49]" />
            </button>

            {showNotifications && (
              <div className="absolute right-0 mt-2 w-72 bg-white rounded-xl shadow-xl border border-slate-200 p-3 z-40 text-slate-900 animate-in fade-in">
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <span className="text-xs font-bold text-[#002B49]">Notificações do Sistema</span>
                  <span className="text-[10px] text-slate-400">Agora</span>
                </div>
                <div className="py-2 space-y-2 text-xs">
                  <div className="p-2 bg-amber-50 rounded-lg text-[11px] text-amber-900 border border-amber-200">
                    <strong>Alerta de Vencimento:</strong> 2 cursos expiram nos próximos 30 dias.
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg text-[11px] text-slate-600">
                    Sincronização com o banco de dados realizada com sucesso.
                  </div>
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
