import React, { useState } from 'react';
import { Database, X, Check, Copy, AlertCircle, RefreshCw, Key, ExternalLink } from 'lucide-react';
import { getSupabaseConfig, setSupabaseConfig, SUPABASE_SQL_SCHEMA, getSupabase } from '../lib/supabase';

interface SupabaseSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfigChanged: () => void;
}

export const SupabaseSettingsModal: React.FC<SupabaseSettingsModalProps> = ({
  isOpen,
  onClose,
  onConfigChanged,
}) => {
  const currentConfig = getSupabaseConfig();
  const [url, setUrl] = useState(currentConfig.url);
  const [key, setKey] = useState(currentConfig.key);
  const [copiedSql, setCopiedSql] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const isConnectedToLive = Boolean(getSupabase());

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsTesting(true);
    setTestResult(null);

    try {
      setSupabaseConfig(url, key);
      const client = getSupabase();
      if (client) {
        // Simple ping
        const { error } = await client.from('funcionarios').select('id').limit(1);
        if (error && error.code !== 'PGRST116') {
          setTestResult({
            success: false,
            message: `Conectou ao Supabase, mas retornou aviso: ${error.message}. Verifique se rodou o script SQL das tabelas.`,
          });
        } else {
          setTestResult({
            success: true,
            message: 'Conexão com o Supabase estabelecida com sucesso!',
          });
        }
      } else {
        setTestResult({
          success: true,
          message: 'Configuração salva. Modo de armazenamento local ativo com persistência completa.',
        });
      }
      onConfigChanged();
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Falha na verificação: ${err.message || err}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopySql = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_SQL_SCHEMA);
      setCopiedSql(true);
      setTimeout(() => setCopiedSql(false), 2000);
    } catch {
      // Fallback
    }
  };

  const handleResetToDemo = () => {
    setUrl('');
    setKey('');
    setSupabaseConfig('', '');
    setTestResult({
      success: true,
      message: 'Restaurado para o armazenamento local demonstrativo VLI.',
    });
    onConfigChanged();
  };

  return (
    <div
      id="supabase-settings-modal"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in"
    >
      <div className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-200 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-[#002B49] text-white px-6 py-4 flex items-center justify-between border-b-2 border-amber-400">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-400/20 border border-amber-400 flex items-center justify-center text-amber-400">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-lg">Integração Supabase & Banco de Dados</h3>
              <p className="text-xs text-amber-200">
                Tabelas: <code className="font-mono bg-blue-950/50 px-1 py-0.5 rounded">admin_users</code>,{' '}
                <code className="font-mono bg-blue-950/50 px-1 py-0.5 rounded">funcionarios</code> e{' '}
                <code className="font-mono bg-blue-950/50 px-1 py-0.5 rounded">treinamentos</code>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm text-slate-700">
          {/* Status banner */}
          <div
            className={`p-4 rounded-xl border flex items-start gap-3 ${
              isConnectedToLive
                ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                : 'bg-amber-50 border-amber-200 text-amber-900'
            }`}
          >
            <div
              className={`w-3 h-3 rounded-full mt-1 shrink-0 ${
                isConnectedToLive ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <div className="text-xs">
              <p className="font-bold text-sm">
                {isConnectedToLive
                  ? 'Conectado ao Supabase Remoto'
                  : 'Modo Demonstrativo com Persistência Local Ativo'}
              </p>
              <p className="mt-0.5 text-slate-600">
                {isConnectedToLive
                  ? 'Os dados de funcionários, crachás e treinamentos estão sincronizando diretamente com seu projeto Supabase.'
                  : 'O sistema está funcionando com banco de dados local pré-populado com crachás da VLI. Para conectar ao seu próprio projeto Supabase, insira a URL e a Anon Key abaixo.'}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Supabase Project URL
              </label>
              <input
                type="url"
                placeholder="https://seu-projeto.supabase.co"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#002B49] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                Supabase Anon / Public API Key
              </label>
              <input
                type="password"
                placeholder="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
                value={key}
                onChange={(e) => setKey(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-mono focus:ring-2 focus:ring-[#002B49] focus:outline-none"
              />
            </div>

            {testResult && (
              <div
                className={`p-3 rounded-lg text-xs font-medium ${
                  testResult.success
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {testResult.message}
              </div>
            )}

            <div className="flex items-center gap-2 pt-2">
              <button
                type="submit"
                disabled={isTesting}
                className="inline-flex items-center gap-2 px-4 py-2 bg-[#002B49] hover:bg-blue-950 text-white rounded-lg font-bold text-xs shadow-xs transition-colors"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                <span>Salvar Credenciais</span>
              </button>

              <button
                type="button"
                onClick={handleResetToDemo}
                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-xs transition-colors"
              >
                Usar Demonstração Local
              </button>
            </div>
          </form>

          {/* SQL Script Section */}
          <div className="pt-4 border-t border-slate-200">
            <div className="flex items-center justify-between mb-2">
              <div>
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-800">
                  Script de Tabelas SQL (Supabase)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Copie este script e execute no SQL Editor do seu Supabase para criar as tabelas.
                </p>
              </div>
              <button
                type="button"
                onClick={handleCopySql}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-amber-400 hover:bg-amber-300 text-[#002B49] font-bold text-xs rounded-lg transition-colors shadow-xs"
              >
                {copiedSql ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedSql ? 'Copiado!' : 'Copiar SQL'}</span>
              </button>
            </div>

            <pre className="p-3 bg-slate-900 text-slate-200 rounded-xl text-[11px] font-mono overflow-x-auto max-h-48 border border-slate-800 selection:bg-amber-400 selection:text-slate-950">
              {SUPABASE_SQL_SCHEMA}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-800 font-semibold text-xs rounded-lg transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
