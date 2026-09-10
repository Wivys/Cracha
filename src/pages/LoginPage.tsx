import React, { useState, useEffect } from 'react';
import { VliLogo } from '../components/VliLogo';
import { Lock, QrCode, ArrowRight, ShieldCheck, UserCheck, KeyRound, Upload } from 'lucide-react';
import { dbService } from '../lib/supabase';
import { AdminUser } from '../types';

interface LoginPageProps {
  onAdminLoginSuccess: (user: AdminUser) => void;
  onOpenEmployeeCard: (matriculaOrId: string) => void;
  onOpenQrScanner: () => void;
  onOpenSupabaseModal: () => void;
}

/**
 * Página de Acesso / Login VLI
 * - Login Administrativo: Primeiro acesso cadastra o Administrador Definitivo; acessos seguintes validam contra esse admin oficial
 * - Acesso do Funcionário: Exclusivo por Matrícula, Leitura de QR Code do Card ou Link direto
 */
export const LoginPage: React.FC<LoginPageProps> = ({
  onAdminLoginSuccess,
  onOpenEmployeeCard,
  onOpenQrScanner,
  onOpenSupabaseModal,
}) => {
  // Estado para detecção de primeiro acesso do administrador
  const [hasMasterAdmin, setHasMasterAdmin] = useState(false);
  const [adminInfo, setAdminInfo] = useState<{ usuario: string; nome: string } | null>(null);

  // Estados do formulário administrativo
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [firstAdminSuccessMsg, setFirstAdminSuccessMsg] = useState<string | null>(null);

  // Estados do acesso do colaborador
  const [matriculaInput, setMatriculaInput] = useState('');
  const [employeeLoading, setEmployeeLoading] = useState(false);
  const [employeeError, setEmployeeError] = useState<string | null>(null);

  // Estados do acesso por link direto
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [directLinkInput, setDirectLinkInput] = useState('');

  // Verifica se já existe um administrador permanente cadastrado
  useEffect(() => {
    const isRegistered = dbService.hasRegisteredAdmin();
    setHasMasterAdmin(isRegistered);
    if (isRegistered) {
      setAdminInfo(dbService.getRegisteredAdminInfo());
    }
  }, []);

  // Submissão do login administrativo
  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adminEmail.trim() || !adminPassword) {
      setAdminError('Preencha o usuário e a senha.');
      return;
    }

    setAdminLoading(true);
    setAdminError(null);

    try {
      const res = await dbService.loginAdmin(adminEmail, adminPassword);
      if (res.success && res.user) {
        if (res.isFirstAdminRegistered) {
          setFirstAdminSuccessMsg('Administrador definitivo cadastrado com sucesso!');
        }
        onAdminLoginSuccess(res.user);
      } else {
        setAdminError(res.error || 'Credenciais inválidas. Tente novamente.');
      }
    } catch (err: any) {
      setAdminError(err.message || 'Erro ao autenticar.');
    } finally {
      setAdminLoading(false);
    }
  };

  // Busca do colaborador por matrícula
  const handleEmployeeSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const query = matriculaInput.trim();
    if (!query) {
      setEmployeeError('Digite o número da matrícula.');
      return;
    }

    setEmployeeLoading(true);
    setEmployeeError(null);

    try {
      const funcionario = await dbService.getFuncionarioByIdOrMatricula(query);
      if (funcionario) {
        onOpenEmployeeCard(funcionario.matricula || funcionario.id);
      } else {
        setEmployeeError(`Matrícula "${query}" não localizada no sistema.`);
      }
    } catch {
      setEmployeeError('Erro ao consultar colaborador.');
    } finally {
      setEmployeeLoading(false);
    }
  };

  // Submissão de link direto
  const handleDirectLinkSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!directLinkInput.trim()) return;
    const clean = directLinkInput.trim();
    const parts = clean.split('/');
    const lastPart = parts[parts.length - 1];
    onOpenEmployeeCard(lastPart || clean);
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col justify-between relative overflow-hidden py-8 px-4 sm:px-6">
      {/* Imagem de fundo sutil com padrão industrial */}
      <div
        className="absolute inset-0 bg-cover bg-center pointer-events-none opacity-20 filter blur-xs"
        style={{
          backgroundImage:
            'url("https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1600&q=80")',
        }}
      />
      <div className="absolute inset-0 bg-gradient-to-b from-white/70 via-slate-100/90 to-slate-200/90 pointer-events-none" />

      {/* Botão sutil superior para configuração do Supabase */}
      <div className="relative z-20 flex justify-end max-w-md mx-auto w-full">
        <button
          type="button"
          onClick={onOpenSupabaseModal}
          className="text-[11px] font-semibold text-slate-500 hover:text-[#002B49] transition-colors cursor-pointer"
        >
          Banco de Dados / Supabase
        </button>
      </div>

      {/* Container Principal */}
      <div className="relative z-10 max-w-[360px] sm:max-w-[400px] mx-auto w-full flex flex-col items-center my-auto space-y-6">
        {/* Logotipo Oficial da VLI */}
        <div className="my-2">
          <VliLogo size="lg" />
        </div>

        {/* CARD 1: Login Administrativo (Com suporte a Primeiro Acesso Definitivo) */}
        <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Cabeçalho do Card */}
          <div className="bg-[#002B49] text-white px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg border border-white/30 flex items-center justify-center shrink-0">
                {hasMasterAdmin ? <Lock className="w-4 h-4 text-white" /> : <ShieldCheck className="w-4 h-4 text-[#FFB81C]" />}
              </div>
              <div>
                <h2 className="text-sm sm:text-base font-extrabold tracking-tight">
                  {hasMasterAdmin ? 'Login Administrativo' : 'Cadastro de Administrador'}
                </h2>
                {!hasMasterAdmin && (
                  <span className="text-[10px] text-[#FFB81C] font-bold block uppercase tracking-wider">
                    Primeiro Acesso Definitivo
                  </span>
                )}
              </div>
            </div>

            {hasMasterAdmin && (
              <span className="inline-flex items-center gap-1 text-[9px] font-bold bg-white/10 text-amber-300 px-2 py-0.5 rounded-full border border-white/20">
                <UserCheck className="w-2.5 h-2.5" /> Definitivo
              </span>
            )}
          </div>

          {/* Faixa divisória amarela */}
          <div className="h-1 bg-[#FFB81C] w-full" />

          {/* Mensagem explicativa se for o primeiro acesso */}
          {!hasMasterAdmin ? (
            <div className="bg-amber-50/80 px-5 py-3 border-b border-amber-200/80 text-[11px] text-amber-950 flex items-start gap-2">
              <KeyRound className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
              <div>
                <strong className="font-bold text-amber-900">Primeiro Acesso:</strong> O usuário e senha inseridos agora serão salvos como as credenciais <strong>definitivas</strong> do administrador deste sistema.
              </div>
            </div>
          ) : (
            <div className="bg-slate-50 px-5 py-2 border-b border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
              <span>Administrador configurado</span>
              <span className="font-mono text-[10px] text-[#002B49] font-bold">
                {adminInfo?.usuario ? `(${adminInfo.usuario})` : 'Ativo'}
              </span>
            </div>
          )}

          {/* Formulário de Login / Cadastro de Administrador */}
          <form onSubmit={handleAdminSubmit} className="p-5 space-y-3.5">
            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                {hasMasterAdmin ? 'Usuário ou E-mail' : 'Defina seu Usuário ou E-mail'}
              </label>
              <input
                id="admin-usuario-input"
                type="text"
                placeholder={hasMasterAdmin ? 'Digite seu usuário' : 'Ex: admin ou seu.email@vli.com.br'}
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#002B49] focus:outline-none transition-all"
                required
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider mb-1">
                {hasMasterAdmin ? 'Senha de Acesso' : 'Defina sua Senha Definitiva'}
              </label>
              <input
                id="admin-senha-input"
                type="password"
                placeholder={hasMasterAdmin ? 'Digite sua senha' : 'Mínimo de 4 caracteres'}
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-2.5 bg-slate-50/70 border border-slate-300 rounded-xl text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#002B49] focus:outline-none transition-all"
                required
              />
            </div>

            {adminError && (
              <p className="text-xs text-rose-600 font-semibold px-1">{adminError}</p>
            )}

            {firstAdminSuccessMsg && (
              <p className="text-xs text-emerald-600 font-semibold px-1">{firstAdminSuccessMsg}</p>
            )}

            <button
              type="submit"
              disabled={adminLoading}
              className="w-full py-2.5 bg-[#002B49] hover:bg-blue-950 text-white font-bold text-xs sm:text-sm rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>
                {adminLoading
                  ? 'Processando...'
                  : hasMasterAdmin
                  ? 'Entrar no Painel'
                  : 'Cadastrar Administrador e Acessar'}
              </span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </form>
        </div>

        {/* CARD 2: Acesso de Funcionário (Login estritamente por Matrícula ou QR Code do Card) */}
        <div className="w-full bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden">
          {/* Cabeçalho */}
          <div className="bg-[#002B49] text-white px-5 py-3.5 flex items-center gap-3">
            <div className="w-7 h-7 rounded-lg border border-white/30 flex items-center justify-center shrink-0">
              <QrCode className="w-4 h-4 text-white" />
            </div>
            <h2 className="text-base font-extrabold tracking-tight">Acesso de Funcionário</h2>
          </div>

          {/* Faixa divisória amarela */}
          <div className="h-1 bg-[#FFB81C] w-full" />

          {/* Conteúdo */}
          <div className="p-5 text-center space-y-4">
            {/* 1. LOGIN EXCLUSIVO POR MATRÍCULA */}
            <form onSubmit={handleEmployeeSearch} className="text-left space-y-2.5">
              <div>
                <label className="block text-xs font-black text-slate-700 uppercase tracking-wide">
                  Login por Matrícula
                </label>
                <p className="text-[11px] text-slate-500 mb-1.5">
                  Acesso rápido individual sem necessidade de senha
                </p>
              </div>

              <div className="relative">
                <input
                  id="matricula-search-input"
                  type="text"
                  placeholder="Digite sua Matrícula (ex: XXXXXX)"
                  value={matriculaInput}
                  onChange={(e) => setMatriculaInput(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-300 rounded-xl text-sm font-semibold text-slate-900 placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-[#002B49] focus:outline-none transition-all uppercase tracking-wider"
                />
              </div>

              {employeeError && (
                <p className="text-xs text-rose-600 font-semibold">{employeeError}</p>
              )}

              <button
                type="submit"
                id="btn-entrar-por-matricula"
                disabled={employeeLoading}
                className="w-full py-2.5 px-4 bg-[#002B49] hover:bg-blue-950 active:bg-blue-900 text-white rounded-xl text-sm font-extrabold shadow-sm transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                {employeeLoading ? (
                  <span>Localizando crachá...</span>
                ) : (
                  <>
                    <span>Entrar com Matrícula</span>
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Separador */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Ou escaneie seu crachá
              </span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* 2. SEGUNDA FORMA: LEITURA DE QR CODE (IMAGEM / ARQUIVO) */}
            <button
              type="button"
              id="btn-leitura-rapida-qr"
              onClick={onOpenQrScanner}
              className="w-full py-2.5 px-4 bg-slate-50 hover:bg-slate-100 active:bg-slate-200 border border-slate-200 rounded-xl transition-all group flex flex-col items-center justify-center cursor-pointer"
              title="Carregue a imagem do QR Code gerado no card do colaborador"
            >
              <span className="text-xs font-extrabold text-slate-600 group-hover:text-[#002B49]">
                2ª Forma: Leitura de QR Code
              </span>
              <span className="text-sm font-black text-slate-900 group-hover:text-[#002B49] flex items-center gap-1.5 mt-0.5">
                <QrCode className="w-4 h-4 text-[#002B49]" />
                Carregar Imagem com QR Code
              </span>
              <span className="text-[10px] text-slate-400 mt-0.5">
                Envie o print ou arquivo do QR Code para acesso direto
              </span>
            </button>

            {/* 3. ACESSO POR LINK DIRETO */}
            <div className="pt-1">
              {!showLinkInput ? (
                <button
                  type="button"
                  id="btn-acessar-por-link"
                  onClick={() => setShowLinkInput(true)}
                  className="text-xs font-bold text-[#002B49] hover:underline cursor-pointer"
                >
                  Acessar por Link do Crachá
                </button>
              ) : (
                <form onSubmit={handleDirectLinkSubmit} className="space-y-2 text-left">
                  <label className="block text-[11px] font-bold text-slate-600">
                    Insira o link ou token do crachá:
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="http://... ou Matrícula"
                      value={directLinkInput}
                      onChange={(e) => setDirectLinkInput(e.target.value)}
                      className="flex-1 px-3 py-1.5 text-xs bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#002B49]"
                    />
                    <button
                      type="submit"
                      className="px-3 py-1.5 bg-[#002B49] text-white text-xs font-bold rounded-lg hover:bg-blue-950 transition-colors"
                    >
                      Abrir
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Rodapé institucional */}
      <footer className="relative z-10 text-center text-xs text-slate-400 mt-6">
        <p>VLI - Logística Integrada • Conectando e Protegendo</p>
      </footer>
    </div>
  );
};
