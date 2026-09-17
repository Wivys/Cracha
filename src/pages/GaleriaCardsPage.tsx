import React, { useState, useMemo, useEffect } from 'react';
import { VliLogo } from '../components/VliLogo';
import { QrCodeDisplay } from '../components/QrCodeDisplay';
import { VliAvatar } from '../components/VliAvatar';
import {
  Search,
  ChevronDown,
  Edit2,
  Trash2,
  Plus,
  Globe,
  CheckCircle2,
  AlertTriangle,
  Clock,
  X,
  FileDown,
  RefreshCw,
  GraduationCap,
} from 'lucide-react';
import {
  FuncionarioWithTreinamentos,
  FilterStatus,
} from '../types';
import { dbService, loadLocalStore } from '../lib/supabase';
import {
  formatLastSyncDate,
  syncEmployeeWebtraining,
  syncAllLinkedEmployees,
} from '../lib/webtrainingSync';

interface GaleriaCardsPageProps {
  employees: FuncionarioWithTreinamentos[];
  onRefresh: () => void;
  onEdit: (employee: FuncionarioWithTreinamentos) => void;
  onOpenCardView: (matriculaOrId: string) => void;
}

export const GaleriaCardsPage: React.FC<GaleriaCardsPageProps> = ({
  employees,
  onRefresh,
  onEdit,
  onOpenCardView,
}) => {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('todos');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // Dynamic Course Catalog
  const [catalogoCursos, setCatalogoCursos] = useState<string[]>([]);

  // Quick Action Modals
  const [quickCourseModalEmp, setQuickCourseModalEmp] =
    useState<FuncionarioWithTreinamentos | null>(null);
  const [newCourseName, setNewCourseName] = useState('');
  const [newCourseDate, setNewCourseDate] = useState('2027-08-12');
  const [newCourseStatus, setNewCourseStatus] = useState<'valido' | 'vencido'>('valido');
  const [isAddingCourse, setIsAddingCourse] = useState(false);

  // Load catalog on open
  const openQuickCourseModal = (emp: FuncionarioWithTreinamentos) => {
    dbService.getCatalogoCursos().then((list) => {
      setCatalogoCursos(list || []);
    });
    setNewCourseName('');
    setQuickCourseModalEmp(emp);
  };

  // Deletion confirm
  const [deletingEmp, setDeletingEmp] = useState<FuncionarioWithTreinamentos | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Copied feedback toast
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Sincronização Diária da Universidade VLI
  const [isSyncingAll, setIsSyncingAll] = useState(false);
  const [syncingEmpId, setSyncingEmpId] = useState<string | null>(null);
  const [syncToast, setSyncToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);

  // Refresh employees on mount to ensure cards are always loaded
  useEffect(() => {
    onRefresh();
  }, [onRefresh]);

  // Fallback para armazenamento local caso a prop employees ainda esteja vazia
  const activeEmployees = useMemo(() => {
    if (employees && employees.length > 0) return employees;
    const local = loadLocalStore();
    return local || [];
  }, [employees]);

  // Helper to compute course statuses of an employee
  const getEmployeeStatusSummary = (emp: FuncionarioWithTreinamentos) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const thirtyDaysAhead = new Date();
    thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 30);

    const treinamentos = Array.isArray(emp.treinamentos) ? emp.treinamentos : [];

    const hasExpired = treinamentos.some((t) => {
      if (!t) return false;
      if (t.status === 'vencido') return true;
      if (t.data_validade) {
        const d = new Date(t.data_validade);
        return !isNaN(d.getTime()) && d < today;
      }
      return false;
    });

    const hasExpiringSoon = treinamentos.some((t) => {
      if (!t || !t.data_validade) return false;
      const d = new Date(t.data_validade);
      return !isNaN(d.getTime()) && t.status === 'valido' && d >= today && d <= thirtyDaysAhead;
    });

    return {
      hasExpired,
      hasExpiringSoon,
      total: treinamentos.length,
      validos: treinamentos.filter((t) => {
        if (!t) return false;
        if (t.status !== 'valido') return false;
        if (!t.data_validade) return true;
        const d = new Date(t.data_validade);
        return isNaN(d.getTime()) || d >= today;
      }).length,
    };
  };

  // Filter and Search logic
  const filteredEmployees = useMemo(() => {
    const seenKeys = new Set<string>();
    const term = searchTerm.toLowerCase().trim();

    return activeEmployees.filter((emp, idx) => {
      if (!emp) return false;
      const key = String(emp.matricula || emp.id || `emp-${idx}`).trim().toLowerCase();
      if (!key || seenKeys.has(key)) return false;
      seenKeys.add(key);

      const mat = String(emp.matricula || '').toLowerCase();
      const nm = String(emp.nome || '').toLowerCase();

      const matchSearch = !term || mat.includes(term) || nm.includes(term);
      if (!matchSearch) return false;

      const summary = getEmployeeStatusSummary(emp);

      if (filterStatus === 'vencidos') {
        return summary.hasExpired;
      }
      if (filterStatus === 'a_vencer') {
        return summary.hasExpiringSoon;
      }
      if (filterStatus === 'validos') {
        return !summary.hasExpired;
      }
      return true;
    });
  }, [activeEmployees, searchTerm, filterStatus]);

  // Contagem de colaboradores com link da Universidade VLI
  const linkedEmployeesCount = useMemo(() => {
    return activeEmployees.filter((e) => Boolean(e.webtraining_url && e.webtraining_url.trim())).length;
  }, [activeEmployees]);

  // Sincronização em Massa de todos os colaboradores vinculados
  const handleSyncAllWebtraining = async () => {
    if (isSyncingAll || linkedEmployeesCount === 0) return;
    setIsSyncingAll(true);
    setSyncToast(null);
    try {
      const summary = await syncAllLinkedEmployees(activeEmployees, true);
      onRefresh();
      setSyncToast({
        type: 'success',
        message: `${summary.totalLinked} crachá(s) analisado(s). ${summary.totalChanges} alteração(ões) de cursos/vencimentos atualizada(s)!`,
      });
    } catch (err: any) {
      setSyncToast({
        type: 'error',
        message: err.message || 'Erro ao sincronizar com a Universidade VLI.',
      });
    } finally {
      setIsSyncingAll(false);
      setTimeout(() => setSyncToast(null), 5000);
    }
  };

  // Sincronização individual de um colaborador
  const handleSyncSingle = async (emp: FuncionarioWithTreinamentos) => {
    if (syncingEmpId) return;
    setSyncingEmpId(emp.id);
    try {
      const res = await syncEmployeeWebtraining(emp, true);
      onRefresh();
      setSyncToast({
        type: res.updated ? 'success' : 'info',
        message: res.message,
      });
    } catch (err: any) {
      setSyncToast({
        type: 'error',
        message: err.message || 'Falha ao sincronizar colaborador.',
      });
    } finally {
      setSyncingEmpId(null);
      setTimeout(() => setSyncToast(null), 4000);
    }
  };

  // Action: Copiar Link (ícone de globo) - Link Curto e Limpo
  const handleCopyLink = async (emp: FuncionarioWithTreinamentos) => {
    const url = `${window.location.origin}/card/${encodeURIComponent(emp.matricula || emp.id)}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(emp.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      setCopiedId(emp.id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  };

  // Action: Excluir (lixeira vermelha)
  const handleConfirmDelete = async () => {
    if (!deletingEmp) return;
    setIsDeleting(true);
    try {
      await dbService.deleteFuncionario(deletingEmp.id);
      setDeletingEmp(null);
      onRefresh();
    } catch {
      alert('Erro ao excluir funcionário.');
    } finally {
      setIsDeleting(false);
    }
  };

  // Action: Adicionar Curso (+)
  const handleQuickAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickCourseModalEmp) return;
    const courseName = newCourseName.trim();
    if (!courseName) return;

    setIsAddingCourse(true);
    try {
      await dbService.addTreinamento(quickCourseModalEmp.id, {
        nome_curso: courseName,
        data_validade: newCourseDate,
        status: newCourseStatus,
        carga_horaria: '40h',
      });
      // Registra no catálogo dinâmico
      await dbService.addCursoAoCatalogo(courseName);
      setQuickCourseModalEmp(null);
      onRefresh();
    } catch {
      alert('Erro ao adicionar treinamento.');
    } finally {
      setIsAddingCourse(false);
    }
  };

  return (
    <div className="w-full flex-1 py-6 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* Toast de Link Copiado */}
      {copiedId && (
        <div className="fixed bottom-6 right-6 z-50 bg-[#002B49] text-white px-4 py-2.5 rounded-xl shadow-2xl border-2 border-amber-400 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5">
          <CheckCircle2 className="w-4 h-4 text-amber-400" />
          <span className="text-xs font-bold">Link do crachá copiado com sucesso!</span>
        </div>
      )}

      {/* Toast de Sincronização Diária */}
      {syncToast && (
        <div
          className={`fixed bottom-6 left-6 z-50 px-4 py-2.5 rounded-xl shadow-2xl border flex items-center gap-2 animate-in fade-in slide-in-from-bottom-5 max-w-md ${
            syncToast.type === 'success'
              ? 'bg-emerald-950 text-white border-emerald-400'
              : syncToast.type === 'error'
              ? 'bg-rose-950 text-white border-rose-400'
              : 'bg-[#002B49] text-white border-amber-400'
          }`}
        >
          {syncToast.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
          ) : syncToast.type === 'error' ? (
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0" />
          ) : (
            <RefreshCw className="w-4 h-4 text-amber-400 shrink-0 animate-spin" />
          )}
          <span className="text-xs font-bold">{syncToast.message}</span>
        </div>
      )}

      {/* Top Search & Filter Bar matching "PAINEL ADM - GALERIA DE CARDS (PAGES 2-4+)" */}
      <div className="space-y-3 mb-6">
        {/* Pesquisar por Matrícula Input with Magnifying Glass on the right */}
        <div className="relative max-w-md">
          <input
            id="search-matricula-input"
            type="text"
            placeholder="Pesquisar por Matrícula"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-4 pr-10 py-2 bg-white border border-slate-300 rounded-lg text-xs sm:text-sm font-medium text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002B49] focus:outline-none transition-all shadow-2xs"
          />
          <Search className="w-4 h-4 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>

        {/* Status de Curso: Dropdown "Todos ⌵", Pill "Vencidos", Pill "A Vencer" */}
        <div className="space-y-1.5">
          <span className="block text-xs font-bold text-slate-700">
            Status de Curso
          </span>

          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            {/* Dropdown: Todos ⌵ */}
            <div className="relative">
              <button
                type="button"
                id="filter-dropdown-trigger"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className={`px-3 py-1 bg-white border rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs ${
                  filterStatus === 'todos' || filterStatus === 'validos'
                    ? 'border-slate-400 text-slate-900'
                    : 'border-slate-200 text-slate-600'
                }`}
              >
                <span>{filterStatus === 'validos' ? 'Em Dia' : 'Todos'}</span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-500" />
              </button>

              {isDropdownOpen && (
                <div className="absolute left-0 mt-1 w-32 bg-white border border-slate-200 rounded-lg shadow-lg py-1 z-30">
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('todos');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Todos ({employees.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setFilterStatus('validos');
                      setIsDropdownOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100"
                  >
                    Somente Válidos
                  </button>
                </div>
              )}
            </div>

            {/* Pill: Vencidos (Soft reddish/pink background with dark red text) */}
            <button
              type="button"
              id="filter-vencidos"
              onClick={() =>
                setFilterStatus(filterStatus === 'vencidos' ? 'todos' : 'vencidos')
              }
              className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                filterStatus === 'vencidos'
                  ? 'bg-rose-500 text-white ring-2 ring-rose-300'
                  : 'bg-[#FFE4E6] text-[#BE123C] hover:bg-rose-200 border border-rose-200'
              }`}
            >
              Vencidos
            </button>

            {/* Pill: A Vencer (Soft yellow/cream background with amber/brown text) */}
            <button
              type="button"
              id="filter-a-vencer"
              onClick={() =>
                setFilterStatus(filterStatus === 'a_vencer' ? 'todos' : 'a_vencer')
              }
              className={`px-3.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs ${
                filterStatus === 'a_vencer'
                  ? 'bg-amber-500 text-slate-950 ring-2 ring-amber-300'
                  : 'bg-[#FEF3C7] text-[#92400E] hover:bg-amber-200 border border-amber-200'
              }`}
            >
              A Vencer
            </button>

            {/* Botão de Atualização Diária da Universidade VLI */}
            {linkedEmployeesCount > 0 && (
              <button
                type="button"
                id="btn-sincronizar-todos-webtraining"
                onClick={handleSyncAllWebtraining}
                disabled={isSyncingAll}
                className="ml-auto px-3 py-1 bg-gradient-to-r from-[#002B49] to-blue-900 hover:from-blue-950 hover:to-slate-900 active:scale-98 text-white font-bold text-xs rounded-lg shadow-2xs transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 border border-blue-700/50 shrink-0"
                title="Sincroniza diariamente cursos e vencimentos da Universidade VLI para todos os colaboradores vinculados"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 text-[#FFB81C] ${isSyncingAll ? 'animate-spin' : ''}`}
                />
                <span>
                  {isSyncingAll
                    ? 'Sincronizando...'
                    : `Sincronizar Universidade VLI (${linkedEmployeesCount})`}
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Cards Grid: faithfully matching the cards in 1.jpg */}
      {filteredEmployees.length === 0 ? (
        <div className="bg-white rounded-2xl p-10 text-center border border-slate-200 shadow-2xs max-w-md mx-auto">
          <p className="text-sm font-bold text-slate-700">Nenhum crachá encontrado</p>
          <p className="text-xs text-slate-400 mt-1">
            Verifique o filtro de status ou termo de busca.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
          {filteredEmployees.map((emp, idx) => {
            const cardKey = String(emp.matricula || emp.id || idx);
            const cardUrl = `${window.location.origin}/card/${encodeURIComponent(emp.matricula || emp.id || '')}`;

            return (
              <div
                key={`${emp.id || emp.matricula || idx}-${idx}`}
                id={`card-funcionario-${cardKey}`}
                className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all border border-slate-200 overflow-hidden flex flex-col justify-between"
              >
                <div>
                  {/* Card Header: Dark blue banner with white VLi logo + Subtitle + Yellow divider line */}
                  <div className="bg-[#002B49] text-white px-4 py-3 flex flex-col items-center justify-center text-center">
                    <VliLogo variant="white" size="sm" showSubtitle={true} />
                  </div>

                  {/* Yellow horizontal divider line */}
                  <div className="h-1 bg-[#FFB81C] w-full" />

                  {/* Card Body: Foto/Avatar, Name, Matrícula, QR Code, "ESCANEAR PARA VERIFICAÇÃO" */}
                  <div
                    onClick={() => onOpenCardView(emp.matricula || emp.id)}
                    className="p-4 sm:p-5 flex flex-col items-center text-center cursor-pointer group"
                    title="Clique para abrir a Visão do Usuário (Mobile Card)"
                  >
                    {/* Employee Photo or VLi Avatar with VLi Cap */}
                    <div className="mb-2">
                      <VliAvatar
                        fotoUrl={emp.foto_url}
                        nome={emp.nome || 'Colaborador VLI'}
                        genero={emp.genero}
                        size="md"
                        className="w-16 h-16 rounded-2xl border-2 border-[#FFB81C] shadow-xs group-hover:scale-105 transition-transform"
                      />
                    </div>

                    {/* Centered Employee Name in bold uppercase */}
                    <h3 className="text-xs sm:text-sm font-black text-slate-900 tracking-tight uppercase group-hover:text-[#002B49] transition-colors line-clamp-1">
                      {emp.nome || 'Colaborador VLI'}
                    </h3>

                    {/* Matrícula */}
                    <p className="text-[11px] font-semibold text-slate-600 mt-0.5 font-mono">
                      Matrícula: {emp.matricula || '---'}
                    </p>

                    {/* QR Code */}
                    <div className="my-3 p-1.5 bg-white rounded-lg border border-slate-200 shadow-2xs group-hover:scale-105 transition-transform">
                      <QrCodeDisplay
                        value={cardUrl}
                        size={110}
                        showActions={false}
                        matricula={emp.matricula || ''}
                        nome={emp.nome || ''}
                      />
                    </div>

                    {/* Text under QR: "ESCANEAR PARA VERIFICAÇÃO" */}
                    <span className="text-[9px] font-black text-slate-700 tracking-wider uppercase">
                      ESCANEAR PARA VERIFICAÇÃO
                    </span>
                  </div>
                </div>

                {/* Tag de Sincronização Diária da Universidade VLI */}
                {emp.webtraining_url && (
                  <div className="mx-3 mb-2 px-2 py-1 bg-blue-50/80 border border-blue-200/60 rounded-lg flex items-center justify-between text-[10px]">
                    <span
                      className="flex items-center gap-1 text-[#002B49] font-bold truncate max-w-[170px]"
                      title={`Link ativo da Universidade VLI: ${emp.webtraining_url}`}
                    >
                      <GraduationCap className="w-3 h-3 text-[#FFB81C] shrink-0" />
                      <span className="truncate">{formatLastSyncDate(emp.last_webtraining_sync)}</span>
                    </span>
                    <button
                      type="button"
                      id={`btn-sync-single-${cardKey}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleSyncSingle(emp);
                      }}
                      disabled={syncingEmpId === emp.id}
                      title="Sincronizar com a Universidade VLI agora"
                      className="p-1 hover:bg-blue-100 rounded text-[#002B49] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <RefreshCw
                        className={`w-3 h-3 ${syncingEmpId === emp.id ? 'animate-spin text-amber-500' : ''}`}
                      />
                    </button>
                  </div>
                )}

                {/* Card Footer: 4 distinct action buttons matching 1.jpg */}
                <div className="p-2.5 pt-0 flex items-center justify-center gap-2">
                  {/* 1: Pencil (Editar) - pale yellow/tan background with dark amber icon */}
                  <button
                    type="button"
                    id={`btn-editar-${cardKey}`}
                    onClick={() => onEdit(emp)}
                    className="w-8 h-8 rounded-lg bg-[#FDE68A] hover:bg-[#FCD34D] text-[#92400E] flex items-center justify-center transition-colors shadow-2xs"
                    title="Editar colaborador e cursos"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>

                  {/* 2: Trash (Excluir) - red background with white trash icon */}
                  <button
                    type="button"
                    id={`btn-excluir-${cardKey}`}
                    onClick={() => setDeletingEmp(emp)}
                    className="w-8 h-8 rounded-lg bg-[#DC2626] hover:bg-[#B91C1C] text-white flex items-center justify-center transition-colors shadow-2xs"
                    title="Excluir crachá"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>

                  {/* 3: Plus (+ Adicionar Curso) - dark blue background with white plus icon */}
                  <button
                    type="button"
                    id={`btn-add-curso-${cardKey}`}
                    onClick={() => openQuickCourseModal(emp)}
                    className="w-8 h-8 rounded-lg bg-[#002B49] hover:bg-blue-950 text-white flex items-center justify-center transition-colors shadow-2xs"
                    title="Adicionar curso diretamente"
                  >
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                  </button>

                  {/* 4: Globe (Copiar Link) - pale yellow/tan background with dark amber globe icon */}
                  <button
                    type="button"
                    id={`btn-copiar-link-${cardKey}`}
                    onClick={() => handleCopyLink(emp)}
                    className="w-8 h-8 rounded-lg bg-[#FDE68A] hover:bg-[#FCD34D] text-[#92400E] flex items-center justify-center transition-colors shadow-2xs"
                    title="Copiar link público do crachá"
                  >
                    <Globe className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal: Adicionar Curso (+) */}
      {quickCourseModalEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200">
            <div className="bg-[#002B49] text-white px-5 py-3.5 flex items-center justify-between border-b-2 border-amber-400">
              <div>
                <h3 className="font-extrabold text-sm">+ Adicionar Curso</h3>
                <p className="text-[11px] text-amber-300 font-medium">
                  {quickCourseModalEmp.nome} ({quickCourseModalEmp.matricula})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setQuickCourseModalEmp(null)}
                className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCourse} className="p-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Curso / Norma Regulamentadora
                </label>
                <input
                  type="text"
                  required
                  list="catalogo-cursos-quick-list"
                  placeholder="Ex: NR-10 - Segurança em Eletricidade"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-semibold text-slate-800 focus:ring-2 focus:ring-[#002B49] focus:outline-none"
                />
                <datalist id="catalogo-cursos-quick-list">
                  {catalogoCursos.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
                {catalogoCursos.length > 0 && (
                  <p className="text-[10px] text-slate-500 mt-1">
                    Digite para criar ou selecione um curso previamente cadastrado.
                  </p>
                )}
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Data de Validade
                </label>
                <input
                  type="date"
                  required
                  value={newCourseDate}
                  onChange={(e) => setNewCourseDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono font-medium text-slate-800 focus:ring-2 focus:ring-[#002B49] focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">
                  Status
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setNewCourseStatus('valido')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      newCourseStatus === 'valido'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Válido
                  </button>
                  <button
                    type="button"
                    onClick={() => setNewCourseStatus('vencido')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      newCourseStatus === 'vencido'
                        ? 'bg-rose-100 text-rose-900 border-rose-400'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Vencido
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setQuickCourseModalEmp(null)}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isAddingCourse}
                  className="px-4 py-1.5 bg-[#002B49] hover:bg-blue-950 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
                >
                  {isAddingCourse ? 'Adicionando...' : 'Adicionar ao Card'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Confirmar Exclusão */}
      {deletingEmp && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
          <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-5 border border-slate-200 text-center">
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-xl mx-auto flex items-center justify-center mb-2">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="font-black text-sm text-slate-900">Excluir Card?</h3>
            <p className="text-xs text-slate-500 mt-1">
              Deseja remover <strong>{deletingEmp.nome}</strong> (Matrícula {deletingEmp.matricula})?
            </p>

            <div className="mt-4 flex gap-2">
              <button
                type="button"
                onClick={() => setDeletingEmp(null)}
                className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="flex-1 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-lg transition-colors shadow-xs"
              >
                {isDeleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
