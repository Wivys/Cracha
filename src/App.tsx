import React, { useState, useEffect, useCallback } from 'react';
import { AdminLayout } from './components/AdminLayout';
import { LoginPage } from './pages/LoginPage';
import { CadastroPage } from './pages/CadastroPage';
import { GaleriaCardsPage } from './pages/GaleriaCardsPage';
import { MobileCardPage } from './pages/MobileCardPage';
import { QrScannerModal } from './components/QrScannerModal';
import { SupabaseSettingsModal } from './components/SupabaseSettingsModal';
import { AdminUser, FuncionarioWithTreinamentos } from './types';
import { dbService } from './lib/supabase';
import { ShieldCheck } from 'lucide-react';

type ViewMode = 'login' | 'admin_galeria' | 'admin_cadastro' | 'mobile_card';

export default function App() {
  // Session & View state
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [currentView, setCurrentView] = useState<ViewMode>('login');
  const [activeCardIdOrMatricula, setActiveCardIdOrMatricula] = useState<string>('');
  const [editingEmployee, setEditingEmployee] = useState<FuncionarioWithTreinamentos | null>(null);

  // Data state
  const [employees, setEmployees] = useState<FuncionarioWithTreinamentos[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);

  // Modals
  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isSupabaseModalOpen, setIsSupabaseModalOpen] = useState(false);

  // Refresh employees from Supabase / Local storage
  const loadEmployees = useCallback(async () => {
    setLoadingEmployees(true);
    try {
      const data = await dbService.getFuncionarios();
      const seenKeys = new Set<string>();
      const deduped: FuncionarioWithTreinamentos[] = [];

      for (const emp of data || []) {
        if (!emp) continue;
        const key = String(emp.matricula || emp.id || '').trim().toLowerCase();
        if (!key || seenKeys.has(key)) continue;
        seenKeys.add(key);

        deduped.push({
          ...emp,
          id: emp.id || `vli-${emp.matricula || Date.now()}`,
          matricula: String(emp.matricula || ''),
          nome: emp.nome || 'Colaborador VLI',
          treinamentos: Array.isArray(emp.treinamentos) ? emp.treinamentos : [],
        });
      }

      setEmployees(deduped);
    } catch (err) {
      console.error('Erro ao carregar colaboradores:', err);
    } finally {
      setLoadingEmployees(false);
    }
  }, []);

  // Parse current route from URL
  const parseRouteFromUrl = useCallback(() => {
    const path = window.location.pathname;
    const hash = window.location.hash;
    const params = new URLSearchParams(window.location.search);

    const cardParam = params.get('card');
    if (cardParam) {
      setActiveCardIdOrMatricula(cardParam);
      setCurrentView('mobile_card');
      return;
    }

    if (path.startsWith('/card/')) {
      const id = path.replace('/card/', '').split('/')[0];
      if (id) {
        setActiveCardIdOrMatricula(decodeURIComponent(id));
        setCurrentView('mobile_card');
        return;
      }
    }

    if (hash.startsWith('#card/')) {
      const id = hash.replace('#card/', '').split('?')[0];
      if (id) {
        setActiveCardIdOrMatricula(decodeURIComponent(id));
        setCurrentView('mobile_card');
        return;
      }
    }

    // Default route: check session
    const currentAdmin = dbService.getCurrentAdmin();
    if (currentAdmin) {
      setAdminUser(currentAdmin);
      setCurrentView('admin_galeria');
    } else {
      setCurrentView('login');
    }
  }, []);

  useEffect(() => {
    loadEmployees();
    parseRouteFromUrl();

    const handlePopState = () => {
      parseRouteFromUrl();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [loadEmployees, parseRouteFromUrl]);

  // Navigation handlers
  const navigateToCard = (matriculaOrId: string) => {
    const cleanId = matriculaOrId.trim();
    setActiveCardIdOrMatricula(cleanId);
    setCurrentView('mobile_card');
    window.history.pushState({}, '', `/card/${encodeURIComponent(cleanId)}`);
  };

  const navigateToAdminGallery = () => {
    setEditingEmployee(null);
    setCurrentView('admin_galeria');
    loadEmployees();
    window.history.pushState({}, '', '/');
  };

  const navigateToCadastro = (employeeToEdit?: FuncionarioWithTreinamentos) => {
    setEditingEmployee(employeeToEdit || null);
    setCurrentView('admin_cadastro');
  };

  const handleAdminLoginSuccess = (user: AdminUser) => {
    setAdminUser(user);
    navigateToAdminGallery();
  };

  const handleLogout = () => {
    dbService.logoutAdmin();
    setAdminUser(null);
    setCurrentView('login');
    window.history.pushState({}, '', '/');
  };

  // Security guard: ensure non-admin users cannot access admin pages
  useEffect(() => {
    if ((currentView === 'admin_galeria' || currentView === 'admin_cadastro') && !adminUser) {
      setCurrentView('login');
      window.history.replaceState({}, '', '/');
    }
  }, [currentView, adminUser]);

  const handleBackFromCard = () => {
    if (adminUser) {
      navigateToAdminGallery();
    } else {
      setCurrentView('login');
      window.history.pushState({}, '', '/');
    }
  };

  const handleCardGenerated = async (savedEmployee: FuncionarioWithTreinamentos) => {
    // 1. Atualização otimista imediata na lista de crachás
    setEmployees((prev) => {
      const targetMatricula = String(savedEmployee.matricula || '').trim().toLowerCase();
      const targetId = String(savedEmployee.id || '').trim().toLowerCase();
      const filtered = prev.filter((e) => {
        const eMatricula = String(e.matricula || '').trim().toLowerCase();
        const eId = String(e.id || '').trim().toLowerCase();
        return (targetMatricula && eMatricula !== targetMatricula) && (targetId && eId !== targetId);
      });
      return [savedEmployee, ...filtered];
    });
    setEditingEmployee(null);

    // 2. Navega imediatamente para a galeria de crachás
    navigateToAdminGallery();

    // 3. Atualiza estado em segundo plano para garantir sincronia total
    try {
      await loadEmployees();
    } catch {}
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900 font-sans antialiased flex flex-col selection:bg-amber-400 selection:text-slate-900">
      {/* Main Content Router */}
      <div className="flex-1 flex flex-col">
        {/* 1. FLUXO DE LOGIN (INICIAL ACCESS) */}
        {currentView === 'login' && (
          <LoginPage
            onAdminLoginSuccess={handleAdminLoginSuccess}
            onOpenEmployeeCard={navigateToCard}
            onOpenQrScanner={() => setIsQrScannerOpen(true)}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
          />
        )}

        {/* 2. PAINEL ADM - CADASTRO E CRIAÇÃO (PAGE 1) */}
        {currentView === 'admin_cadastro' && (
          <AdminLayout
            currentTab="cadastro"
            onSelectTab={(tab) => {
              if (tab === 'galeria') navigateToAdminGallery();
              if (tab === 'cadastro') navigateToCadastro();
            }}
            adminUser={adminUser}
            onLogout={handleLogout}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            employees={employees}
          >
            <CadastroPage
              editingEmployee={editingEmployee}
              onSuccess={handleCardGenerated}
              onCancel={navigateToAdminGallery}
              onGoToGallery={navigateToAdminGallery}
            />
          </AdminLayout>
        )}

        {/* 3. PAINEL ADM - GALERIA DE CARDS (PAGES 2-4+) */}
        {currentView === 'admin_galeria' && (
          <AdminLayout
            currentTab="galeria"
            onSelectTab={(tab) => {
              if (tab === 'galeria') navigateToAdminGallery();
              if (tab === 'cadastro') navigateToCadastro();
            }}
            adminUser={adminUser}
            onLogout={handleLogout}
            onOpenSupabaseModal={() => setIsSupabaseModalOpen(true)}
            employees={employees}
          >
            <GaleriaCardsPage
              employees={employees}
              onRefresh={loadEmployees}
              onEdit={(emp) => navigateToCadastro(emp)}
              onOpenCardView={navigateToCard}
            />
          </AdminLayout>
        )}

        {/* 4. VISÃO DO USUÁRIO (MOBILE CARD) */}
        {currentView === 'mobile_card' && (
          <MobileCardPage
            matriculaOrId={activeCardIdOrMatricula}
            onBack={handleBackFromCard}
            isAdminLoggedIn={Boolean(adminUser)}
          />
        )}
      </div>

      {/* QR Scanner Modal (Image / File) */}
      {isQrScannerOpen && (
        <QrScannerModal
          isOpen={isQrScannerOpen}
          onClose={() => setIsQrScannerOpen(false)}
          onScanSuccess={(matricula) => {
            setIsQrScannerOpen(false);
            navigateToCard(matricula);
          }}
        />
      )}

      {/* Supabase Connection Setup Modal */}
      {isSupabaseModalOpen && (
        <SupabaseSettingsModal
          isOpen={isSupabaseModalOpen}
          onClose={() => setIsSupabaseModalOpen(false)}
          onConnected={() => {
            loadEmployees();
          }}
        />
      )}
    </div>
  );
}
