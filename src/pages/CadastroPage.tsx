import React, { useState, useEffect } from 'react';
import {
  Upload,
  Edit2,
  Trash2,
  CheckCircle2,
  AlertTriangle,
  Plus,
  X,
  GraduationCap,
  Link as LinkIcon,
  Download,
  Infinity,
  ChevronDown,
} from 'lucide-react';
import {
  FuncionarioWithTreinamentos,
  TrainingItem,
  WebtrainingParsedData,
} from '../types';
import { dbService } from '../lib/supabase';
import { VliAvatar } from '../components/VliAvatar';
import { extractFromWebtrainingUrl } from '../lib/webtrainingParser';
import { repairCorruptedText, repairFuncionarioObject } from '../lib/textSanitizer';

interface CadastroPageProps {
  editingEmployee?: FuncionarioWithTreinamentos | null;
  onSuccess: (savedEmployee: FuncionarioWithTreinamentos) => void;
  onCancel: () => void;
  onGoToGallery?: () => void;
}

/**
 * Página de Cadastro e Edição de Crachá VLI
 * - Importação automática via link do crachá da Universidade VLI (Webtraining)
 * - Tópico destacado "Universidade VLi" abaixo dos cursos manuais
 * - Catálogo dinâmico de cursos: inicia vazio no primeiro acesso e preenche com "+ Adicionar Curso Manual"
 */
export const CadastroPage: React.FC<CadastroPageProps> = ({
  editingEmployee,
  onSuccess,
  onCancel,
  onGoToGallery,
}) => {
  // Campos principais do colaborador
  const [nome, setNome] = useState('');
  const [matricula, setMatricula] = useState('');
  const [cargo, setCargo] = useState('');
  const [unidade, setUnidade] = useState('');
  const [fotoUrl, setFotoUrl] = useState<string | null>(null);
  const [genero, setGenero] = useState<'M' | 'H'>('H');
  const [isUploading, setIsUploading] = useState(false);

  // Extração via Universidade VLI (Webtraining)
  const [webtrainingUrl, setWebtrainingUrl] = useState('');
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractionFeedback, setExtractionFeedback] = useState<{
    tipo: 'sucesso' | 'erro';
    mensagem: string;
  } | null>(null);

  // Catálogo dinâmico de cursos adicionados (inicia vazio no primeiro acesso)
  const [catalogoCursos, setCatalogoCursos] = useState<string[]>([]);

  // Lista de treinamentos (no primeiro acesso e novo card inicia totalmente vazia conforme solicitado)
  const [trainings, setTrainings] = useState<TrainingItem[]>(() => {
    if (editingEmployee && editingEmployee.treinamentos) {
      return editingEmployee.treinamentos.map((t, idx) => ({
        id: t.id || String(idx),
        nome_curso: t.nome_curso,
        data_validade: t.data_validade,
        status: t.status,
        carga_horaria: t.carga_horaria,
        origem: t.origem || 'manual',
        categoria: t.categoria,
        vencimento_treinamento: t.vencimento_treinamento,
        vencimento_aso: t.vencimento_aso,
        status_webtraining: t.status_webtraining,
      }));
    }
    return [];
  });

  const [selectedCourseToAdd, setSelectedCourseToAdd] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Fecha o dropdown ao clicar fora
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Modais de Curso
  const [editingTraining, setEditingTraining] = useState<TrainingItem | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [modalCourseName, setModalCourseName] = useState('');
  const [modalCourseDate, setModalCourseDate] = useState('2027-08-12');
  const [modalCourseInfinite, setModalCourseInfinite] = useState(false);
  const [modalCourseStatus, setModalCourseStatus] = useState<'valido' | 'vencido'>('valido');

  // Carrega catálogo dinâmico de cursos previamente cadastrados
  useEffect(() => {
    dbService.getCatalogoCursos().then((list) => {
      setCatalogoCursos((list || []).map(repairCorruptedText));
    });
  }, []);

  // Inicialização no modo de edição ou novo cadastro
  useEffect(() => {
    if (editingEmployee) {
      const repaired = repairFuncionarioObject(editingEmployee);
      setNome(repaired.nome);
      setMatricula(repaired.matricula);
      setCargo(repaired.cargo || 'Operador Ferroviário / Logística');
      setUnidade(repaired.unidade || 'Corredor Centro-Leste');
      setFotoUrl(repaired.foto_url);
      setGenero(repaired.genero === 'M' ? 'M' : 'H');
      setTrainings(
        (repaired.treinamentos || []).map((t, idx) => ({
          id: t.id || String(idx),
          nome_curso: repairCorruptedText(t.nome_curso),
          data_validade: t.data_validade,
          status: t.status,
          carga_horaria: t.carga_horaria,
          origem: t.origem || 'manual',
          categoria: repairCorruptedText(t.categoria),
          vencimento_treinamento: repairCorruptedText(t.vencimento_treinamento),
          vencimento_aso: repairCorruptedText(t.vencimento_aso),
          status_webtraining: repairCorruptedText(t.status_webtraining),
        }))
      );
    } else {
      setNome('');
      setMatricula('');
      setCargo('');
      setUnidade('');
      setFotoUrl(null);
      setGenero('H');
      setTrainings([]); // No primeiro acesso ou novo card, a lista começa limpa sem nenhum curso
    }
  }, [editingEmployee]);

  // Upload da foto do colaborador
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setFormError(null);
    try {
      const uploadedUrl = await dbService.uploadFoto(file);
      setFotoUrl(uploadedUrl);
    } catch (err) {
      console.error(err);
      setFormError('Erro ao carregar a imagem do crachá.');
    } finally {
      setIsUploading(false);
    }
  };

  // Extração de dados da Universidade VLI através da URL fornecida
  const handleExtractFromWebtraining = async (urlOverride?: string) => {
    const targetUrl = (urlOverride || webtrainingUrl).trim();
    if (!targetUrl) {
      setExtractionFeedback({
        tipo: 'erro',
        mensagem: 'Por favor, insira o link do crachá da Universidade VLI.',
      });
      return;
    }

    setIsExtracting(true);
    setExtractionFeedback(null);

    try {
      const parsedData: WebtrainingParsedData = await extractFromWebtrainingUrl(targetUrl);

      // Preenchimento inteligente dos dados do colaborador
      if (parsedData.nome && (!nome || nome.trim() === '')) {
        setNome(parsedData.nome);
      }
      if (parsedData.matricula && (!matricula || matricula.trim() === '')) {
        setMatricula(parsedData.matricula);
      }
      if (parsedData.cargo && (!cargo || cargo.trim() === '')) {
        setCargo(parsedData.cargo);
      }

      // Adiciona os cursos extraídos marcados com origem universidade_vli
      if (parsedData.cursos && parsedData.cursos.length > 0) {
        const novosCursos: TrainingItem[] = parsedData.cursos.map((c, idx) => ({
          id: `trn-vli-${Date.now()}-${idx}`,
          nome_curso: c.nome_curso,
          data_validade: c.data_validade,
          status: c.status,
          carga_horaria: '40h',
          origem: 'universidade_vli',
          categoria: c.categoria,
          vencimento_treinamento: c.vencimento_treinamento,
          vencimento_aso: c.vencimento_aso,
          status_webtraining: c.status_webtraining,
        }));

        // Remove duplicatas já existentes na lista
        const idsExistentes = new Set(trainings.map((t) => t.nome_curso.toLowerCase()));
        const cursosFiltrados = novosCursos.filter(
          (c) => !idsExistentes.has(c.nome_curso.toLowerCase())
        );

        setTrainings((prev) => [...prev, ...cursosFiltrados]);

        setExtractionFeedback({
          tipo: 'sucesso',
          mensagem: `${cursosFiltrados.length} treinamentos da Universidade VLi importados com sucesso!`,
        });
      } else {
        setExtractionFeedback({
          tipo: 'sucesso',
          mensagem: 'Dados do colaborador extraídos. Nenhuma atividade identificada na página.',
        });
      }
    } catch (err: any) {
      console.error('Erro na extração:', err);
      setExtractionFeedback({
        tipo: 'erro',
        mensagem: err.message || 'Falha ao conectar à Universidade VLI.',
      });
    } finally {
      setIsExtracting(false);
    }
  };

  // Seleção e adição de curso a partir da lista suspensa
  const handleSelectCourseFromCatalog = (cursoNome: string) => {
    if (!cursoNome) return;

    const exists = trainings.some((t) => t.nome_curso.toLowerCase() === cursoNome.toLowerCase());
    if (!exists) {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 2);
      const dateStr = nextYear.toISOString().split('T')[0];

      setTrainings([
        ...trainings,
        {
          id: `trn-${Date.now()}`,
          nome_curso: cursoNome,
          data_validade: dateStr,
          status: 'valido',
          origem: 'manual',
        },
      ]);
    }
    setIsDropdownOpen(false);
  };

  // Exclui apenas 1 curso específico da lista suspensa e das opções futuras
  const handleDeleteCourseFromCatalog = async (cursoNome: string) => {
    try {
      const updated = await dbService.removeCursoDoCatalogo(cursoNome);
      setCatalogoCursos(updated.map(repairCorruptedText));
    } catch (err) {
      console.error('Erro ao deletar curso do catálogo:', err);
    }
  };

  // Seleção de curso no dropdown manual (legado / fallback)
  const handleDropdownSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    if (!value) return;

    const exists = trainings.some((t) => t.nome_curso.toLowerCase() === value.toLowerCase());
    if (!exists) {
      const nextYear = new Date();
      nextYear.setFullYear(nextYear.getFullYear() + 2);
      const dateStr = nextYear.toISOString().split('T')[0];

      setTrainings([
        ...trainings,
        {
          id: `trn-${Date.now()}`,
          nome_curso: value,
          data_validade: dateStr,
          status: 'valido',
          origem: 'manual',
        },
      ]);
    }
    setSelectedCourseToAdd('');
  };

  // Remoção de um treinamento da lista
  const handleRemoveTraining = (id: string) => {
    setTrainings(trainings.filter((t) => t.id !== id));
  };

  // Salvar curso editado no modal
  const handleSaveEditedTraining = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTraining) return;

    setTrainings(trainings.map((t) => (t.id === editingTraining.id ? editingTraining : t)));
    setEditingTraining(null);
  };

  // Adicionar novo curso manual via modal e cadastrá-lo no catálogo para futuros cards
  const handleAddNewCourseFromModal = (e: React.FormEvent) => {
    e.preventDefault();
    const courseName = modalCourseName.trim();
    if (!courseName) return;

    // 1. Adiciona à lista de cursos do card atual
    setTrainings((prev) => [
      ...prev,
      {
        id: `trn-${Date.now()}`,
        nome_curso: courseName,
        data_validade: modalCourseDate,
        status: modalCourseStatus,
        origem: 'manual',
      },
    ]);

    // 2. Registra no catálogo dinâmico de cursos disponíveis
    dbService.addCursoAoCatalogo(courseName).then((updatedCatalog) => {
      setCatalogoCursos(updatedCatalog);
    });

    setIsAddModalOpen(false);
    setModalCourseName('');
  };

  // Formatador de data para exibição DD/MM/AAAA ou Infinito (∞)
  const formatDateDisplay = (dateStr: string) => {
    if (!dateStr || dateStr === 'permanente' || dateStr === 'indeterminado' || dateStr === 'infinito') {
      return '∞ Sem Expiração';
    }
    try {
      const parts = dateStr.split('-');
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
      return new Date(dateStr).toLocaleDateString('pt-BR');
    } catch {
      return dateStr;
    }
  };

  // Submissão do formulário: [ Gerar Card ]
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!nome.trim() || !matricula.trim()) {
      setFormError('Preencha o Nome Completo e a Matrícula do colaborador.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const result = await dbService.saveFuncionarioComTreinamentos({
        id: editingEmployee?.id,
        nome: repairCorruptedText(nome.trim().toUpperCase()),
        matricula: matricula.trim(),
        cargo: repairCorruptedText(cargo.trim() || editingEmployee?.cargo || 'Operador Ferroviário / Logística'),
        unidade: repairCorruptedText(unidade.trim() || editingEmployee?.unidade || 'Corredor Centro-Leste'),
        foto_url: fotoUrl,
        genero,
        treinamentos: trainings.map((t) => ({
          nome_curso: repairCorruptedText(t.nome_curso),
          data_validade: t.data_validade,
          status: t.status,
          carga_horaria: t.carga_horaria || '40h',
          origem: t.origem || 'manual',
          categoria: repairCorruptedText(t.categoria),
          vencimento_treinamento: repairCorruptedText(t.vencimento_treinamento),
          vencimento_aso: repairCorruptedText(t.vencimento_aso),
          status_webtraining: repairCorruptedText(t.status_webtraining),
        })),
      });

      onSuccess(result);
    } catch (err: any) {
      setFormError(err.message || 'Erro ao gerar o crachá no banco de dados.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Separação dos cursos manuais e dos cursos importados da Universidade VLi
  const cursosManuais = trainings.filter((t) => t.origem !== 'universidade_vli');
  const cursosUniversidadeVLi = trainings.filter((t) => t.origem === 'universidade_vli');

  return (
    <div className="w-full flex-1 flex justify-center py-6 sm:py-8 px-4 sm:px-6">
      <div className="w-full max-w-[540px] bg-white rounded-2xl shadow-xl border border-slate-200 p-6 sm:p-7 flex flex-col justify-between">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SEÇÃO 1: Extração Automática via Link Universidade VLI (Webtraining) */}
          <div className="bg-gradient-to-r from-blue-50/80 via-slate-50 to-amber-50/50 border border-blue-200/80 rounded-2xl p-4 shadow-2xs">
            <div className="flex items-center justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-[#002B49] text-white flex items-center justify-center shrink-0">
                  <GraduationCap className="w-3.5 h-3.5 text-[#FFB81C]" />
                </div>
                <h3 className="text-xs sm:text-sm font-extrabold text-[#002B49] tracking-tight">
                  Importar da Universidade VLi
                </h3>
              </div>
            </div>

            <p className="text-[11px] text-slate-600 mb-2.5">
              Cole o link do crachá do Webtraining para extrair automaticamente nome, matrícula, cargo e cursos válidos.
            </p>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <input
                  type="url"
                  placeholder="https://universidadevli.webtraining.com.br/crachap.asp?p=XX&v=XXXXX&z=..."
                  value={webtrainingUrl}
                  onChange={(e) => setWebtrainingUrl(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 bg-white border border-slate-300 rounded-xl text-xs font-mono text-slate-800 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002B49] focus:outline-none"
                />
                <LinkIcon className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              </div>

              <button
                type="button"
                id="btn-extrair-webtraining"
                onClick={() => handleExtractFromWebtraining()}
                disabled={isExtracting}
                className="px-4 py-2 bg-[#002B49] hover:bg-blue-950 text-white font-extrabold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-50"
              >
                {isExtracting ? (
                  <>
                    <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>Extraindo...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-3.5 h-3.5 text-[#FFB81C]" />
                    <span>Extrair Informações</span>
                  </>
                )}
              </button>
            </div>

            {/* Feedback da Extração */}
            {extractionFeedback && (
              <div
                className={`mt-2.5 px-3 py-2 rounded-xl text-xs flex items-center justify-between gap-2 ${
                  extractionFeedback.tipo === 'sucesso'
                    ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                    : 'bg-rose-50 text-rose-800 border border-rose-200'
                }`}
              >
                <div className="flex items-center gap-2">
                  {extractionFeedback.tipo === 'sucesso' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  )}
                  <span className="font-semibold text-[11px]">{extractionFeedback.mensagem}</span>
                </div>
              </div>
            )}
          </div>

          {/* SEÇÃO 2: Foto do Funcionário e Dados Pessoais */}
          <div className="grid grid-cols-12 gap-4 items-start">
            {/* Foto do Funcionário */}
            <div className="col-span-5 flex flex-col">
              <label className="text-xs font-bold text-slate-800 mb-1.5 block">
                Foto do Funcionário
              </label>

              <label
                htmlFor="foto-input"
                className="relative w-full aspect-square bg-slate-100/80 hover:bg-slate-100 border border-slate-300 rounded-xl flex flex-col items-center justify-center p-1 text-center cursor-pointer transition-all overflow-hidden group shadow-2xs"
                title="Clique para carregar ou alterar a foto do crachá"
              >
                {fotoUrl ? (
                  <>
                    <img
                      src={fotoUrl}
                      alt="Foto Funcionário"
                      className="w-full h-full object-cover rounded-lg"
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 rounded-lg">
                      <Upload className="w-4 h-4" />
                      <span>Alterar Foto</span>
                    </div>
                  </>
                ) : (
                  <>
                    <VliAvatar
                      fotoUrl={null}
                      nome={nome || 'Colaborador VLI'}
                      genero={genero}
                      size="badge"
                      className="w-full h-full rounded-lg"
                    />
                    <div className="absolute inset-0 bg-[#002B49]/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white text-[10px] font-bold gap-1 rounded-lg">
                      <Upload className="w-4 h-4 text-[#FFB81C]" />
                      <span>{isUploading ? 'Enviando...' : 'Carregar Foto'}</span>
                      <span className="text-[8px] font-normal text-slate-200">
                        ou manter avatar VLi
                      </span>
                    </div>
                  </>
                )}

                <input
                  id="foto-input"
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </label>

              {/* 2 Botões abaixo do AVATAR: "H" e "M" (H homem e M mulher) do tamanho da letra */}
              <div className="flex items-center justify-center gap-1.5 mt-2">
                <button
                  type="button"
                  id="btn-avatar-h"
                  onClick={() => setGenero('H')}
                  title="H - Homem (Avatar ferroviário VLi 8-bit)"
                  className={`w-6 h-6 rounded font-black text-xs flex items-center justify-center transition-all ${
                    genero === 'H'
                      ? 'bg-[#002B49] text-[#FFB81C] ring-2 ring-[#FF7A00] shadow-xs scale-105'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  H
                </button>
                <button
                  type="button"
                  id="btn-avatar-m"
                  onClick={() => setGenero('M')}
                  title="M - Mulher (Avatar ferroviária VLi 8-bit)"
                  className={`w-6 h-6 rounded font-black text-xs flex items-center justify-center transition-all ${
                    genero === 'M'
                      ? 'bg-[#002B49] text-[#FFB81C] ring-2 ring-[#FF7A00] shadow-xs scale-105'
                      : 'bg-white text-slate-600 border border-slate-300 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  M
                </button>
              </div>

              {fotoUrl && (
                <button
                  type="button"
                  onClick={() => setFotoUrl(null)}
                  className="mt-2 w-full text-[10px] font-semibold text-rose-700 hover:text-rose-800 flex items-center justify-center gap-1 py-1.5 px-2 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 transition-colors"
                  title="Remover a foto enviada e utilizar o avatar padrão VLi"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remover Foto (Usar Avatar)</span>
                </button>
              )}
            </div>

            {/* Nome Completo e Matrícula */}
            <div className="col-span-7 flex flex-col justify-between space-y-2.5 pt-0.5">
              <div>
                <label className="text-xs font-bold text-slate-800 mb-1 block">
                  Nome Completo
                </label>
                <input
                  id="nome-completo-input"
                  type="text"
                  required
                  placeholder="Nome Completo do Colaborador"
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002B49] focus:outline-none transition-all uppercase"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-800 mb-1 block">
                  Matrícula / ID
                </label>
                <input
                  id="matricula-input"
                  type="text"
                  required
                  placeholder="Número de Matrícula (ex: XXXXXX)"
                  value={matricula}
                  onChange={(e) => setMatricula(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl text-xs sm:text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#002B49] focus:outline-none transition-all uppercase font-mono"
                />
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-600 mb-1 block">
                  Cargo (Opcional)
                </label>
                <input
                  id="cargo-input"
                  type="text"
                  placeholder="Ex: Operador Mantenedor I"
                  value={cargo}
                  onChange={(e) => setCargo(e.target.value)}
                  className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 placeholder:text-slate-400 focus:ring-1 focus:ring-[#002B49] focus:outline-none uppercase"
                />
              </div>
            </div>
          </div>

          {/* SEÇÃO 3: Cursos e Treinamentos Manuais */}
          <div className="space-y-3 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-800 block">
                Cursos e Treinamentos
              </label>
              <span className="text-[11px] text-slate-400 font-medium">
                {cursosManuais.length} adicionado(s)
              </span>
            </div>

            {/* Lista suspensa personalizada com catálogo dinâmico de cursos e exclusão individual */}
            <div className="relative" ref={dropdownRef}>
              <button
                type="button"
                id="select-cursos-dropdown-trigger"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                disabled={catalogoCursos.length === 0}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-xl text-xs font-medium text-slate-700 focus:ring-2 focus:ring-[#002B49] focus:outline-none flex items-center justify-between cursor-pointer disabled:bg-slate-50 disabled:text-slate-400 text-left transition-colors"
              >
                <span className="truncate">
                  {catalogoCursos.length === 0
                    ? 'Nenhum curso cadastrado ainda (clique em "+ Adicionar Curso Manual")'
                    : 'Selecione um curso prévio para adicionar ao card...'}
                </span>
                <ChevronDown
                  className={`w-4 h-4 text-slate-500 shrink-0 ml-2 transition-transform duration-200 ${
                    isDropdownOpen ? 'rotate-180 text-[#002B49]' : ''
                  }`}
                />
              </button>

              {/* Lista suspensa aberta */}
              {isDropdownOpen && catalogoCursos.length > 0 && (
                <div
                  id="cursos-dropdown-menu"
                  className="absolute left-0 right-0 top-full mt-1.5 bg-white border border-slate-200 rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-slate-100 animate-in fade-in"
                >
                  <div className="px-3 py-1.5 bg-slate-50 text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                    <span>Cursos Salvos ({catalogoCursos.length})</span>
                    <span className="text-[9px] font-normal text-slate-400">Ícone de lixeira para excluir</span>
                  </div>
                  {catalogoCursos.map((cursoNome) => (
                    <div
                      key={cursoNome}
                      className="flex items-center justify-between px-3 py-2 hover:bg-slate-50 transition-colors group cursor-pointer"
                      onClick={() => handleSelectCourseFromCatalog(cursoNome)}
                    >
                      <span className="text-xs text-slate-800 font-medium truncate pr-2 group-hover:text-[#002B49]">
                        {cursoNome}
                      </span>
                      <button
                        type="button"
                        id={`btn-delete-curso-${cursoNome.replace(/\s+/g, '-').toLowerCase()}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteCourseFromCatalog(cursoNome);
                        }}
                        className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer shrink-0"
                        title={`Deletar "${cursoNome}" das opções futuras`}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Lista dos Cursos Manuais */}
            <div className="space-y-2 pt-1">
              {cursosManuais.length === 0 && (
                <div className="p-3 bg-slate-50 border border-dashed border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">
                    Nenhum curso avulso adicionado a este crachá.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Adicione pelo botão abaixo ou importe da Universidade VLi.
                  </p>
                </div>
              )}

              {cursosManuais.map((trn) => (
                <div
                  key={trn.id}
                  className="bg-white border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-slate-300 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <h4 className="text-xs font-bold text-slate-900 leading-tight">
                        {trn.nome_curso}
                      </h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        Validade: {formatDateDisplay(trn.data_validade)}
                      </p>
                      <div className="flex items-center gap-1 mt-1 text-[11px] font-bold text-emerald-600">
                        {trn.status === 'valido' ? (
                          <>
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 fill-emerald-100" />
                            <span>Válido</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                            <span className="text-rose-600">Vencido</span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-1 shrink-0 pt-0.5">
                      <button
                        type="button"
                        onClick={() => setEditingTraining(trn)}
                        className="p-1 text-slate-500 hover:text-[#002B49] rounded transition-colors cursor-pointer"
                        title="Editar curso"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveTraining(trn.id)}
                        className="p-1 text-rose-500 hover:text-rose-700 rounded transition-colors cursor-pointer"
                        title="Excluir curso"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Botão: + Adicionar Curso Manualmente */}
            <button
              type="button"
              id="btn-adicionar-curso-formulario"
              onClick={() => {
                setModalCourseName('');
                setIsAddModalOpen(true);
              }}
              className="w-full py-2 bg-[#FFB81C] hover:bg-[#F5A800] text-slate-950 font-bold text-xs sm:text-sm rounded-xl transition-all shadow-2xs flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4 text-slate-950 stroke-[2.5]" />
              <span>Adicionar Curso Manual</span>
            </button>
          </div>

          {/* SEÇÃO 4: TÓPICO UNIVERSIDADE VLI (ADICIONADO ABAIXO DOS CURSOS ADICIONADOS) */}
          <div className="space-y-3 pt-3 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[#002B49] text-[#FFB81C] flex items-center justify-center">
                  <GraduationCap className="w-3.5 h-3.5" />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-extrabold text-[#002B49] tracking-tight">
                    Universidade VLi
                  </h3>
                  <span className="text-[10px] text-slate-500 block">
                    Treinamentos oficiais e requisitos legais integrados
                  </span>
                </div>
              </div>

              <span className="text-[10px] font-extrabold px-2.5 py-1 bg-amber-50 text-amber-900 border border-amber-200 rounded-full">
                {cursosUniversidadeVLi.length} atividade(s)
              </span>
            </div>

            {/* Lista dos Cursos da Universidade VLi */}
            <div className="space-y-2">
              {cursosUniversidadeVLi.length === 0 ? (
                <div className="p-3 bg-slate-50/70 border border-dashed border-slate-200 rounded-xl text-center">
                  <p className="text-xs text-slate-500 font-medium">
                    Nenhum curso importado da Universidade VLi ainda.
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    Utilize o campo de importação acima para carregar automaticamente.
                  </p>
                </div>
              ) : (
                cursosUniversidadeVLi.map((trn) => (
                  <div
                    key={trn.id}
                    className="bg-white border-l-4 border-l-[#002B49] border border-slate-200 rounded-xl p-3 shadow-2xs hover:border-slate-300 transition-all"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {trn.categoria && (
                          <span className="text-[9px] uppercase tracking-wider font-extrabold text-blue-900 bg-blue-50 px-1.5 py-0.5 rounded inline-block mb-1">
                            {trn.categoria}
                          </span>
                        )}

                        <h4 className="text-xs font-bold text-slate-900 leading-snug break-words">
                          {trn.nome_curso}
                        </h4>

                        <div className="grid grid-cols-2 gap-2 mt-2 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                          <div>
                            <span className="text-slate-400 block text-[9px] font-semibold">
                              Vencimento trein.:
                            </span>
                            <span className="font-bold text-slate-700">
                              {trn.vencimento_treinamento || formatDateDisplay(trn.data_validade)}
                            </span>
                          </div>

                          <div>
                            <span className="text-slate-400 block text-[9px] font-semibold">
                              Vencimento ASO:
                            </span>
                            <span className="font-bold text-slate-700">
                              {trn.vencimento_aso || 'Não aplicável'}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 mt-2">
                          <span
                            className={`inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md ${
                              trn.status === 'valido'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {trn.status === 'valido' ? (
                              <>
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                <span>{trn.status_webtraining || 'Liberado'}</span>
                              </>
                            ) : (
                              <>
                                <AlertTriangle className="w-3 h-3 text-rose-600" />
                                <span>{trn.status_webtraining || 'Vencido'}</span>
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1 shrink-0 pt-0.5">
                        <button
                          type="button"
                          onClick={() => setEditingTraining(trn)}
                          className="p-1 text-slate-500 hover:text-[#002B49] rounded transition-colors cursor-pointer"
                          title="Editar atividade"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveTraining(trn.id)}
                          className="p-1 text-rose-500 hover:text-rose-700 rounded transition-colors cursor-pointer"
                          title="Excluir atividade"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {formError && (
            <p className="text-xs text-rose-600 font-semibold px-1">{formError}</p>
          )}

          {/* Botão de Finalização: [ Gerar Card ] */}
          <div className="pt-2">
            <button
              type="submit"
              id="btn-gerar-card"
              disabled={isSubmitting}
              className="w-full py-3 bg-[#002B49] hover:bg-blue-950 text-white font-extrabold text-sm sm:text-base rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer tracking-wide"
            >
              <span>{isSubmitting ? 'Gerando Card...' : '[ Gerar Card ]'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Modal: Adicionar Novo Curso Manualmente */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-[#002B49]">Adicionar Curso Manual</h3>
              <button
                type="button"
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddNewCourseFromModal} className="space-y-3 pt-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nome do Curso / Norma
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: NR-10 - Segurança em Eletricidade"
                  value={modalCourseName}
                  onChange={(e) => setModalCourseName(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002B49] focus:outline-none"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Data de Validade
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#002B49] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={modalCourseInfinite}
                      onChange={(e) => {
                        setModalCourseInfinite(e.target.checked);
                        if (e.target.checked) {
                          setModalCourseDate('permanente');
                        } else {
                          setModalCourseDate('2027-08-12');
                        }
                      }}
                      className="rounded text-[#002B49] focus:ring-[#002B49]"
                    />
                    <span>Sem Expiração (∞)</span>
                  </label>
                </div>

                {modalCourseInfinite ? (
                  <div className="w-full px-3 py-2 text-xs bg-blue-50 border border-blue-200 text-blue-900 font-bold rounded-lg flex items-center gap-2">
                    <Infinity className="w-4 h-4 stroke-[2.5]" />
                    <span>Curso Permanente / Sem Expiração (∞)</span>
                  </div>
                ) : (
                  <input
                    type="date"
                    required
                    value={modalCourseDate}
                    onChange={(e) => setModalCourseDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002B49] focus:outline-none font-mono"
                  />
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Status
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalCourseStatus('valido')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      modalCourseStatus === 'valido'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Válido
                  </button>
                  <button
                    type="button"
                    onClick={() => setModalCourseStatus('vencido')}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      modalCourseStatus === 'vencido'
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
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#002B49] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Editar Curso Existente */}
      {editingTraining && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-2xs">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl border border-slate-200">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <h3 className="font-extrabold text-sm text-[#002B49]">Editar Treinamento</h3>
              <button
                type="button"
                onClick={() => setEditingTraining(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditedTraining} className="space-y-3 pt-3">
              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Nome do Curso / Atividade
                </label>
                <input
                  type="text"
                  required
                  value={editingTraining.nome_curso}
                  onChange={(e) =>
                    setEditingTraining({ ...editingTraining, nome_curso: e.target.value })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002B49] focus:outline-none"
                />
              </div>

              {editingTraining.origem === 'universidade_vli' && (
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Categoria (Universidade VLi)
                  </label>
                  <input
                    type="text"
                    value={editingTraining.categoria || ''}
                    onChange={(e) =>
                      setEditingTraining({ ...editingTraining, categoria: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002B49] focus:outline-none"
                  />
                </div>
              )}

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Data de Validade
                  </label>
                  <label className="inline-flex items-center gap-1.5 text-[10px] font-bold text-[#002B49] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={
                        editingTraining.data_validade === 'permanente' ||
                        editingTraining.data_validade === 'indeterminado' ||
                        editingTraining.data_validade === 'infinito' ||
                        !editingTraining.data_validade
                      }
                      onChange={(e) => {
                        if (e.target.checked) {
                          setEditingTraining({ ...editingTraining, data_validade: 'permanente' });
                        } else {
                          setEditingTraining({ ...editingTraining, data_validade: '2027-08-12' });
                        }
                      }}
                      className="rounded text-[#002B49] focus:ring-[#002B49]"
                    />
                    <span>Sem Expiração (∞)</span>
                  </label>
                </div>

                {editingTraining.data_validade === 'permanente' ||
                editingTraining.data_validade === 'indeterminado' ||
                editingTraining.data_validade === 'infinito' ||
                !editingTraining.data_validade ? (
                  <div className="w-full px-3 py-2 text-xs bg-blue-50 border border-blue-200 text-blue-900 font-bold rounded-lg flex items-center gap-2">
                    <Infinity className="w-4 h-4 stroke-[2.5]" />
                    <span>Curso Permanente / Sem Expiração (∞)</span>
                  </div>
                ) : (
                  <input
                    type="date"
                    required
                    value={editingTraining.data_validade}
                    onChange={(e) =>
                      setEditingTraining({ ...editingTraining, data_validade: e.target.value })
                    }
                    className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#002B49] focus:outline-none font-mono"
                  />
                )}
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-700 block mb-1">
                  Status
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setEditingTraining({ ...editingTraining, status: 'valido' })
                    }
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      editingTraining.status === 'valido'
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-400'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Válido / Liberado
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setEditingTraining({ ...editingTraining, status: 'vencido' })
                    }
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                      editingTraining.status === 'vencido'
                        ? 'bg-rose-100 text-rose-900 border-rose-400'
                        : 'bg-slate-50 text-slate-600 border-slate-200'
                    }`}
                  >
                    Vencido / Bloqueado
                  </button>
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setEditingTraining(null)}
                  className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 bg-[#002B49] text-white text-xs font-bold rounded-lg cursor-pointer"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
