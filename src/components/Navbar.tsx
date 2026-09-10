import React from 'react';
import { VliLogo } from './VliLogo';
import { LayoutGrid, UserPlus, LogOut, Database, ShieldCheck, Smartphone, QrCode } from 'lucide-react';
import { AdminUser } from '../types';
import { getSupabase } from '../lib/supabase';

interface NavbarProps {
  currentTab: 'galeria' | 'cadastro' | 'mobile_preview';
  onSelectTab: (tab: 'galeria' | 'cadastro' | 'mobile_preview') => void;
  adminUser: AdminUser | null;
  onLogout: () => void;
  onOpenSupabaseModal: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentTab,
  onSelectTab,
  adminUser,
  onLogout,
  onOpenSupabaseModal,
}) => {
  const isSupabaseConnected = Boolean(getSupabase());

  return (
    <header className="sticky top-0 z-40 bg-[#002B49] text-white border-b-4 border-amber-400 shadow-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Brand Logo & System Title */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-3">
              <VliLogo variant="white" size="md" />
              <div className="hidden sm:block pl-3 border-l border-white/20">
                <span className="text-xs font-bold uppercase tracking-wider text-amber-400 block leading-tight">
                  Sistema de Crachás
                </span>
                <span className="text-[11px] text-slate-300 font-medium">
                  Gestão de Normas & Treinamentos
                </span>
              </div>
            </div>
          </div>

          {/* Admin Navigation Tabs */}
          <nav className="flex items-center gap-1 sm:gap-2">
            <button
              type="button"
              id="nav-tab-galeria"
              onClick={() => onSelectTab('galeria')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                currentTab === 'galeria'
                  ? 'bg-amber-400 text-[#002B49] shadow-md'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <LayoutGrid className="w-4 h-4" />
              <span>Galeria de Cards</span>
            </button>

            <button
              type="button"
              id="nav-tab-cadastro"
              onClick={() => onSelectTab('cadastro')}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all ${
                currentTab === 'cadastro'
                  ? 'bg-amber-400 text-[#002B49] shadow-md'
                  : 'text-slate-200 hover:text-white hover:bg-white/10'
              }`}
            >
              <UserPlus className="w-4 h-4" />
              <span>Cadastrar Funcionário</span>
            </button>
          </nav>

          {/* Right Action Tools */}
          <div className="flex items-center gap-2">
            {/* Supabase Status Chip */}
            <button
              type="button"
              id="btn-supabase-status"
              onClick={onOpenSupabaseModal}
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-white/10 hover:bg-white/20 text-slate-200 border border-white/15 transition-colors"
              title="Configurar Supabase"
            >
              <Database className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-[11px]">
                {isSupabaseConnected ? 'Supabase Conectado' : 'Banco Local'}
              </span>
              <span
                className={`w-2 h-2 rounded-full ${
                  isSupabaseConnected ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
                }`}
              />
            </button>

            {/* Admin User Info & Logout */}
            <div className="flex items-center gap-2 pl-2 border-l border-white/20">
              <div className="hidden lg:block text-right">
                <p className="text-xs font-bold text-white truncate max-w-[130px]">
                  {adminUser?.nome || 'Administrador VLI'}
                </p>
                <p className="text-[10px] text-amber-300 uppercase tracking-wider font-semibold">
                  Painel ADM
                </p>
              </div>

              <button
                type="button"
                id="btn-admin-logout"
                onClick={onLogout}
                className="p-2 rounded-lg bg-white/10 hover:bg-rose-500/80 text-white transition-colors"
                title="Sair do Painel ADM"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};
