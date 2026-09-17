import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Funcionario, Treinamento, FuncionarioWithTreinamentos, AdminUser } from '../types';
import { repairFuncionarioObject, repairCourseObject } from './textSanitizer';
import { extractBadgeFromCurrentUrl, decodeBadgeToken } from './portableBadge';

/**
 * Módulo de Banco de Dados, Autenticação e Persistência VLI
 * - Gerenciamento de Administrador Definitivo (Primeiro acesso cadastra o admin oficial permanente)
 * - Persistência limpa para produção (sem registros fictícios ou dados demo)
 * - Suporte a armazenamento local seguro e sincronização opcional com Supabase
 */

// Configurações da Nuvem (Supabase) via variáveis de ambiente ou conexão padrão
const DEFAULT_CLOUD_URL = 'https://geaypypffqpmynfxdaul.supabase.co';
const DEFAULT_CLOUD_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYXlweXBmZnFwbXluZnhkYXVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTc5NDcsImV4cCI6MjEwNDQ5Mzk0N30.v9ztxM67zF4nAVdHsUip2NoCstjKq5dPi3HsXWsq8og';

const envSupabaseUrl = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_CLOUD_URL;
const envSupabaseAnonKey = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_CLOUD_KEY;

export const getSupabaseConfig = () => {
  const localUrl = localStorage.getItem('vli_supabase_url');
  const localKey = localStorage.getItem('vli_supabase_anon_key');
  return {
    url: localUrl || envSupabaseUrl || DEFAULT_CLOUD_URL,
    key: localKey || envSupabaseAnonKey || DEFAULT_CLOUD_KEY,
  };
};

export const isCloudConnected = (): boolean => {
  const client = getSupabase();
  return Boolean(client);
};

export const setSupabaseConfig = (url: string, key: string) => {
  clientInstance = null;
  if (url && key) {
    localStorage.setItem('vli_supabase_url', url.trim());
    localStorage.setItem('vli_supabase_anon_key', key.trim());
  } else {
    localStorage.removeItem('vli_supabase_url');
    localStorage.removeItem('vli_supabase_anon_key');
  }
};

let clientInstance: SupabaseClient | null = null;

export const getSupabase = (): SupabaseClient | null => {
  const config = getSupabaseConfig();
  if (config.url && config.key && config.url.startsWith('http')) {
    if (!clientInstance) {
      try {
        clientInstance = createClient(config.url, config.key);
      } catch (err) {
        console.error('Falha ao inicializar o cliente Supabase:', err);
        return null;
      }
    }
    return clientInstance;
  }
  return null;
};

// Chaves de armazenamento local para produção limpa
const LOCAL_STORAGE_KEY = 'vli_database_colaboradores_prod_v1';
const ADMIN_SESSION_KEY = 'vli_admin_session_active_v1';

// Chaves legadas para recuperação de crachás criados anteriormente
const LEGACY_STORAGE_KEYS = [
  'vli_database_colaboradores',
  'vli_colaboradores',
  'vli_funcionarios',
  'colaboradores',
  'funcionarios',
  'vli_cards',
  'cards',
  'vli_employees',
];


/**
 * Lê os colaboradores cadastrados localmente (com suporte a recuperação e migração de chaves legadas)
 */
export const loadLocalStore = (): FuncionarioWithTreinamentos[] => {
  try {
    if (typeof localStorage === 'undefined') return [];

    const map = new Map<string, FuncionarioWithTreinamentos>();

    const getColabKey = (c: any, index: number): string => {
      if (!c) return '';
      const mat = c.matricula !== undefined && c.matricula !== null ? String(c.matricula).trim().toLowerCase() : '';
      const id = c.id !== undefined && c.id !== null ? String(c.id).trim().toLowerCase() : '';
      return mat || id || `idx-${index}`;
    };

    // 1. Chave principal de produção
    const mainRaw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (mainRaw) {
      try {
        const parsed = JSON.parse(mainRaw);
        if (Array.isArray(parsed)) {
          parsed.forEach((item, idx) => {
            if (item && (item.nome || item.matricula)) {
              const repaired = repairFuncionarioObject(item);
              const key = getColabKey(repaired, idx);
              if (key) map.set(key, repaired);
            }
          });
        }
      } catch (err) {
        console.warn('Aviso ao ler LOCAL_STORAGE_KEY:', err);
      }
    }

    // 2. Chaves legadas de versões anteriores
    for (const legacyKey of LEGACY_STORAGE_KEYS) {
      try {
        const legacyRaw = localStorage.getItem(legacyKey);
        if (legacyRaw) {
          const parsed = JSON.parse(legacyRaw);
          if (Array.isArray(parsed)) {
            parsed.forEach((item, idx) => {
              if (item && (item.nome || item.matricula)) {
                const repaired = repairFuncionarioObject(item);
                const key = getColabKey(repaired, idx);
                if (key && !map.has(key)) {
                  map.set(key, repaired);
                }
              }
            });
          }
        }
      } catch {}
    }

    // 3. Varredura de segurança em todas as chaves do localStorage caso o nome da chave tenha variado
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || k === LOCAL_STORAGE_KEY || LEGACY_STORAGE_KEYS.includes(k) || k.startsWith('vli_admin')) continue;
        if (k.toLowerCase().includes('colaborador') || k.toLowerCase().includes('card') || k.toLowerCase().includes('func')) {
          const val = localStorage.getItem(k);
          if (val && val.includes('matricula')) {
            const parsed = JSON.parse(val);
            if (Array.isArray(parsed)) {
              parsed.forEach((item, idx) => {
                if (item && (item.nome || item.matricula)) {
                  const repaired = repairFuncionarioObject(item);
                  const key = getColabKey(repaired, idx);
                  if (key && !map.has(key)) {
                    map.set(key, repaired);
                  }
                }
              });
            }
          }
        }
      }
    } catch {}

    const result = Array.from(map.values());

    // Se encontramos dados e a chave principal estava vazia, salva na chave principal
    if (result.length > 0 && (!mainRaw || mainRaw === '[]')) {
      try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(result));
      } catch {}
    }

    return result;
  } catch (e) {
    console.error('Erro ao ler colaboradores locais:', e);
    return [];
  }
};

/**
 * Salva a lista de colaboradores localmente
 */
export const saveLocalStore = (data: FuncionarioWithTreinamentos[]) => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(data));
    }
  } catch (e) {
    console.error('Erro ao salvar colaboradores locais:', e);
  }
};

/**
 * Verifica se uma string possui o formato válido de UUID do Postgres
 */
export function isUuid(val?: string | null): boolean {
  if (!val || typeof val !== 'string') return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(val.trim());
}

/**
 * Formata datas com segurança para o tipo DATE do Postgres / Supabase
 * Converte DD/MM/AAAA para YYYY-MM-DD e valores infinitos/indeterminados para '2099-12-31'
 */
export function toSafeDateForSupabase(dateStr?: string | null): string {
  if (!dateStr || typeof dateStr !== 'string') return '2099-12-31';
  const clean = dateStr.trim();
  const lower = clean.toLowerCase();
  if (
    lower === '' ||
    lower.includes('indeterminado') ||
    lower.includes('permanente') ||
    lower.includes('infinito') ||
    lower.includes('sem exp') ||
    lower.includes('∞')
  ) {
    return '2099-12-31';
  }

  // DD/MM/YYYY
  const brMatch = clean.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0');
    const month = brMatch[2].padStart(2, '0');
    const year = brMatch[3];
    return `${year}-${month}-${day}`;
  }

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
    return clean;
  }

  const parsed = new Date(clean);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().split('T')[0];
  }

  return '2099-12-31';
}

/**
 * Serviço de Banco de Dados e Autenticação VLI
 */
export const dbService = {
  /**
   * Checagem se o sistema possui conexão ou administradores cadastrados
   */
  hasRegisteredAdmin(): boolean {
    return false;
  },

  /**
   * Checagem assíncrona se há administradores registrados no Supabase
   */
  async checkHasRegisteredAdminAsync(): Promise<{ hasAdmin: boolean; info?: { usuario: string; nome: string; registeredAt: string } | null }> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        // 1. Tabela 'vli_admin'
        const { data: vliData } = await supabase.from('vli_admin').select('usuario, nome, created_at').limit(1);
        if (vliData && vliData.length > 0) {
          return {
            hasAdmin: true,
            info: {
              usuario: vliData[0].usuario,
              nome: vliData[0].nome || 'Administrador VLI',
              registeredAt: vliData[0].created_at || new Date().toISOString(),
            },
          };
        }

        // 2. Tabela 'administradores'
        const { data: admData } = await supabase.from('administradores').select('usuario, nome, created_at').limit(1);
        if (admData && admData.length > 0) {
          return {
            hasAdmin: true,
            info: {
              usuario: admData[0].usuario,
              nome: admData[0].nome || 'Administrador VLI',
              registeredAt: admData[0].created_at || new Date().toISOString(),
            },
          };
        }
      } catch {
        // Tabela ainda não existente no Supabase
      }
    }

    return { hasAdmin: false, info: null };
  },

  /**
   * Realiza login administrativo EXCLUSIVAMENTE via Supabase.
   * Não há adição ou cadastro automático de senhas pelo site.
   * A conta e a senha do Administrador devem ser criadas e gerenciadas no Supabase.
   */
  async loginAdmin(
    usuario: string,
    senha: string
  ): Promise<{ success: boolean; user?: AdminUser; error?: string }> {
    const cleanUser = usuario.trim();
    if (!cleanUser || !senha) {
      return { success: false, error: 'Preencha o usuário e a senha.' };
    }

    // Remove qualquer credencial legada antiga armazenada em versões anteriores
    try {
      localStorage.removeItem('vli_admin_master_credential_v1');
    } catch {}

    const supabase = getSupabase();
    if (!supabase) {
      return {
        success: false,
        error: 'Conexão com o Supabase necessária. Configure a URL e a chave de acesso.',
      };
    }

    try {
      // A. Consulta na tabela 'vli_admin' criada no Supabase
      const { data: vliRows, error: vliErr } = await supabase
        .from('vli_admin')
        .select('*')
        .ilike('usuario', cleanUser)
        .limit(1);

      if (!vliErr && vliRows && vliRows.length > 0) {
        const row = vliRows[0];
        const senhaEsperada = row.senha ?? row.password ?? row.senha_hash;
        if (senhaEsperada && String(senhaEsperada) === String(senha)) {
          const userSession: AdminUser = {
            id: row.id ? String(row.id) : 'admin-supabase',
            email: row.usuario.includes('@') ? row.usuario : `${row.usuario}@vli-logistica.com.br`,
            nome: row.nome || 'Administrador VLI',
            role: 'admin',
            definitive: true,
            registeredAt: row.created_at || new Date().toISOString(),
          };
          localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(userSession));
          return { success: true, user: userSession };
        } else {
          return { success: false, error: 'Usuário ou senha incorretos.' };
        }
      }

      // B. Consulta na tabela 'administradores' (caso o usuário tenha criado com esse nome)
      const { data: admRows, error: admErr } = await supabase
        .from('administradores')
        .select('*')
        .ilike('usuario', cleanUser)
        .limit(1);

      if (!admErr && admRows && admRows.length > 0) {
        const row = admRows[0];
        const senhaEsperada = row.senha ?? row.password ?? row.senha_hash;
        if (senhaEsperada && String(senhaEsperada) === String(senha)) {
          const userSession: AdminUser = {
            id: row.id ? String(row.id) : 'admin-supabase',
            email: row.usuario.includes('@') ? row.usuario : `${row.usuario}@vli-logistica.com.br`,
            nome: row.nome || 'Administrador VLI',
            role: 'admin',
            definitive: true,
            registeredAt: row.created_at || new Date().toISOString(),
          };
          localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(userSession));
          return { success: true, user: userSession };
        } else {
          return { success: false, error: 'Usuário ou senha incorretos.' };
        }
      }

      // C. Consulta no Supabase Auth nativo (Authentication -> Users)
      try {
        const emailToTry = cleanUser.includes('@') ? cleanUser : `${cleanUser}@vli-logistica.com.br`;
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: emailToTry,
          password: senha,
        });
        if (!authError && authData.user) {
          const userSession: AdminUser = {
            id: authData.user.id,
            email: authData.user.email || emailToTry,
            nome: authData.user.user_metadata?.nome || 'Administrador VLI',
            role: 'admin',
            definitive: true,
            registeredAt: authData.user.created_at || new Date().toISOString(),
          };
          localStorage.setItem(ADMIN_SESSION_KEY, JSON.stringify(userSession));
          return { success: true, user: userSession };
        }
      } catch {}
    } catch (sbErr) {
      console.warn('Erro ao consultar autenticação no Supabase:', sbErr);
    }

    return {
      success: false,
      error: 'Usuário ou senha incorretos.',
    };
  },

  /**
   * Altera a senha do administrador (desabilitado no site, exclusivo pelo Supabase)
   */
  changeAdminPassword(): { success: boolean; error?: string } {
    return {
      success: false,
      error: 'A gestão e troca de senhas deve ser feita diretamente no Supabase.',
    };
  },

  /**
   * Obtém a sessão do administrador logado
   */
  getCurrentAdmin(): AdminUser | null {
    try {
      const raw = localStorage.getItem(ADMIN_SESSION_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  },

  /**
   * Encerra a sessão do administrador
   */
  logoutAdmin() {
    localStorage.removeItem(ADMIN_SESSION_KEY);
    const supabase = getSupabase();
    if (supabase) {
      supabase.auth.signOut().catch(() => {});
    }
  },

  /**
   * Busca todos os colaboradores cadastrados
   * - Consulta Supabase, Servidor Express (/api/colaboradores) e Local Storage
   * - Une todas as fontes garantindo que nenhum crachá seja perdido
   */
  async getFuncionarios(): Promise<FuncionarioWithTreinamentos[]> {
    let supabaseList: FuncionarioWithTreinamentos[] = [];
    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data: funcData, error: funcError } = await supabase
          .from('funcionarios')
          .select('*')
          .order('created_at', { ascending: false });

        if (!funcError && Array.isArray(funcData) && funcData.length > 0) {
          const { data: trainData } = await supabase
            .from('treinamentos')
            .select('*');

          supabaseList = funcData.map((f: Funcionario) =>
            repairFuncionarioObject({
              ...f,
              treinamentos: (trainData || []).filter((t: Treinamento) => t.funcionario_id === f.id),
            })
          );
        }
      } catch (err) {
        console.warn('Aviso: Utilizando busca híbrida para colaboradores:', err);
      }
    }

    // Carregar do servidor Express (acessível por outros dispositivos na rede)
    let serverList: FuncionarioWithTreinamentos[] = [];
    try {
      const res = await fetch('/api/colaboradores');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          serverList = json.data.map(repairFuncionarioObject);
        }
      }
    } catch {}

    const localList = loadLocalStore();

    // Mescla dados de todas as fontes preservando o crachá mais completo e recente
    const mergedMap = new Map<string, FuncionarioWithTreinamentos>();

    const getItemKey = (c: any, index: number) => {
      if (!c) return '';
      const mat = c.matricula !== undefined && c.matricula !== null ? String(c.matricula).trim().toLowerCase() : '';
      const id = c.id !== undefined && c.id !== null ? String(c.id).trim().toLowerCase() : '';
      return mat || id || `item-${index}`;
    };

    // 1. Supabase (nuvem)
    supabaseList.forEach((c, idx) => {
      const key = getItemKey(c, idx);
      if (key) mergedMap.set(key, repairFuncionarioObject(c));
    });

    // 2. Servidor Express
    serverList.forEach((c, idx) => {
      const key = getItemKey(c, idx);
      if (key) {
        if (!mergedMap.has(key)) {
          mergedMap.set(key, repairFuncionarioObject(c));
        } else {
          const existing = mergedMap.get(key)!;
          const trainExisting = Array.isArray(existing.treinamentos) ? existing.treinamentos : [];
          const trainNew = Array.isArray(c.treinamentos) ? c.treinamentos : [];
          mergedMap.set(key, repairFuncionarioObject({
            ...c,
            ...existing,
            foto_url: existing.foto_url || c.foto_url || null,
            treinamentos: (trainExisting.length >= trainNew.length ? trainExisting : trainNew).map(repairCourseObject),
          }));
        }
      }
    });

    // 3. Local Storage (gravação do navegador ativo)
    localList.forEach((c, idx) => {
      const key = getItemKey(c, idx);
      if (key) {
        if (!mergedMap.has(key)) {
          mergedMap.set(key, repairFuncionarioObject(c));
        } else {
          const existing = mergedMap.get(key)!;
          const trainExisting = Array.isArray(existing.treinamentos) ? existing.treinamentos : [];
          const trainNew = Array.isArray(c.treinamentos) ? c.treinamentos : [];
          mergedMap.set(key, repairFuncionarioObject({
            ...existing,
            ...c,
            foto_url: c.foto_url || existing.foto_url || null,
            treinamentos: (trainNew.length >= trainExisting.length ? trainNew : trainExisting).map(repairCourseObject),
          }));
        }
      }
    });

    const merged = Array.from(mergedMap.values());

    if (merged.length > 0) {
      saveLocalStore(merged);
      try {
        fetch('/api/colaboradores/sync', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ colaboradores: merged }),
        }).catch(() => {});
      } catch {}
      return merged;
    }

    return localList;
  },

  /**
   * Busca um colaborador por ID ou Matrícula
   * - Consulta cache local do navegador
   * - Consulta nuvem Supabase em tempo real (permite abrir crachá em qualquer celular)
   * - Consulta servidor /api/colaboradores
   * - Suporta decodificação de token portátil compartilhado via link (?d=...)
   */
  async getFuncionarioByIdOrMatricula(
    idOrMatricula: string
  ): Promise<FuncionarioWithTreinamentos | null> {
    const query = idOrMatricula.trim().toLowerCase();

    // 1. Consulta rápida no armazenamento local do dispositivo
    const localList = loadLocalStore();
    const foundLocal = localList.find((f) => {
      const matchId = (f.id || '').toLowerCase() === query;
      const matchMatricula = (f.matricula || '').toLowerCase() === query;
      const cleanDigitsF = (f.matricula || '').replace(/\D/g, '');
      const cleanDigitsQ = query.replace(/\D/g, '');
      const matchClean = cleanDigitsF && cleanDigitsQ && cleanDigitsF === cleanDigitsQ;
      return matchId || matchMatricula || matchClean;
    });

    if (foundLocal) {
      return repairFuncionarioObject(foundLocal);
    }

    // 2. Consulta em Nuvem (Supabase) - Permite que qualquer celular com o link curto acesse o crachá
    const supabase = getSupabase();
    if (supabase) {
      try {
        let func: any = null;

        // Se a busca for um UUID válido, consulta diretamente pelo ID
        if (isUuid(idOrMatricula)) {
          const { data, error } = await supabase
            .from('funcionarios')
            .select('*')
            .eq('id', idOrMatricula.trim())
            .maybeSingle();
          if (!error && data) {
            func = data;
          }
        }

        // Se não encontrou por ID (ou não era UUID), busca pela matrícula
        if (!func) {
          const { data, error } = await supabase
            .from('funcionarios')
            .select('*')
            .ilike('matricula', idOrMatricula.trim())
            .maybeSingle();
          if (!error && data) {
            func = data;
          }
        }

        if (func) {
          const { data: trainings } = await supabase
            .from('treinamentos')
            .select('*')
            .eq('funcionario_id', func.id);

          const repaired = repairFuncionarioObject({
            ...func,
            treinamentos: (trainings || []).map(repairCourseObject),
          });

          const current = loadLocalStore();
          const exists = current.some(
            (c) => c.id === repaired.id || String(c.matricula).toLowerCase() === String(repaired.matricula).toLowerCase()
          );
          if (!exists) {
            saveLocalStore([repaired, ...current]);
          }

          return repaired;
        }
      } catch (err) {
        console.warn('Aviso: Consulta remota na nuvem:', err);
      }
    }

    // 3. Consulta no servidor (/api/colaboradores via caminho e query param)
    try {
      let res = await fetch(`/api/colaboradores/${encodeURIComponent(query)}`);
      if (!res.ok) {
        res = await fetch(`/api/colaboradores?idOrMatricula=${encodeURIComponent(query)}`);
      }
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          const repaired = repairFuncionarioObject(json.data);
          const current = loadLocalStore();
          const exists = current.some(
            (c) => c.id === repaired.id || String(c.matricula).toLowerCase() === String(repaired.matricula).toLowerCase()
          );
          if (!exists) {
            saveLocalStore([repaired, ...current]);
          }
          return repaired;
        }
      }
    } catch {
      // Ignora falhas de rede e segue para as opções seguintes
    }

    // 4. Fallback portátil: Tenta extrair dados se houver ?d= na URL ou se o parâmetro for token
    const fromUrl = extractBadgeFromCurrentUrl();
    if (fromUrl) {
      const repaired = repairFuncionarioObject(fromUrl);
      const current = loadLocalStore();
      const exists = current.some(
        (c) => c.id === repaired.id || String(c.matricula).toLowerCase() === String(repaired.matricula).toLowerCase()
      );
      if (!exists) {
        saveLocalStore([repaired, ...current]);
      }
      return repaired;
    }

    if (idOrMatricula.length > 50) {
      const decoded = decodeBadgeToken(idOrMatricula);
      if (decoded) {
        const repaired = repairFuncionarioObject(decoded);
        const current = loadLocalStore();
        const exists = current.some(
          (c) => c.id === repaired.id || String(c.matricula).toLowerCase() === String(repaired.matricula).toLowerCase()
        );
        if (!exists) {
          saveLocalStore([repaired, ...current]);
        }
        return repaired;
      }
    }

    return null;
  },

  /**
   * Salva ou atualiza colaborador de forma unificada
   * - Persiste no Supabase (se configurado) tratando conflitos de matrícula, id e schema
   * - Garante persistência instantânea no Local Storage do navegador
   * - Persiste no servidor Express (/api/colaboradores) para sincronização e acesso via QR Code
   */
  async saveFuncionarioComplete(data: {
    id?: string;
    nome: string;
    matricula: string;
    cargo?: string;
    unidade?: string;
    foto_url: string | null;
    genero?: 'M' | 'H';
    webtraining_url?: string;
    last_webtraining_sync?: string;
    treinamentos: Array<{
      nome_curso: string;
      data_validade: string;
      status: 'valido' | 'vencido';
      carga_horaria?: string;
      origem?: 'manual' | 'universidade_vli';
      categoria?: string;
      vencimento_treinamento?: string;
      vencimento_aso?: string;
      status_webtraining?: string;
    }>;
  }): Promise<FuncionarioWithTreinamentos> {
    const supabase = getSupabase();
    const cleanMatricula = (data.matricula || '').trim();
    const nowIso = new Date().toISOString();

    // 1. Tentar salvar/atualizar no Supabase
    let supabaseFuncId: string | null = null;
    if (supabase) {
      try {
        // Verifica se já existe colaborador com mesma matrícula ou ID
        let existingFunc: any = null;

        if (data.id && isUuid(data.id)) {
          const { data: recs } = await supabase
            .from('funcionarios')
            .select('id, matricula')
            .eq('id', data.id.trim())
            .limit(1);
          if (recs && recs.length > 0) {
            existingFunc = recs[0];
          }
        }

        if (!existingFunc && cleanMatricula) {
          const { data: recs } = await supabase
            .from('funcionarios')
            .select('id, matricula')
            .ilike('matricula', cleanMatricula)
            .limit(1);
          if (recs && recs.length > 0) {
            existingFunc = recs[0];
          }
        }

        let unidadePayload = (data.unidade || 'Malha Operacional VLI').trim();
        if (data.genero) {
          unidadePayload += ` || genero:${data.genero}`;
        }
        if (data.webtraining_url) {
          unidadePayload += ` || webtraining:${JSON.stringify({
            url: data.webtraining_url.trim(),
            lastSync: data.last_webtraining_sync || nowIso,
          })}`;
        }

        const payload: any = {
          nome: data.nome.trim(),
          matricula: cleanMatricula,
          foto_url: data.foto_url || null,
          cargo: data.cargo || 'Operador Ferroviário / Logística',
          unidade: unidadePayload,
        };

        let savedSupabaseFunc: any = null;

        if (existingFunc) {
          supabaseFuncId = existingFunc.id;
          const { data: updateData, error: updateErr } = await supabase
            .from('funcionarios')
            .update(payload)
            .eq('id', existingFunc.id)
            .select()
            .maybeSingle();

          if (updateErr) throw updateErr;
          savedSupabaseFunc = updateData || { ...existingFunc, ...payload };
        } else {
          if (data.id && isUuid(data.id)) {
            payload.id = data.id.trim();
          }
          const { data: insertData, error: insertErr } = await supabase
            .from('funcionarios')
            .insert(payload)
            .select()
            .maybeSingle();

          if (insertErr) throw insertErr;
          savedSupabaseFunc = insertData;
          supabaseFuncId = savedSupabaseFunc?.id || null;
        }

        // Salvar treinamentos no Supabase
        if (supabaseFuncId && Array.isArray(data.treinamentos)) {
          await supabase.from('treinamentos').delete().eq('funcionario_id', supabaseFuncId);

          if (data.treinamentos.length > 0) {
            const trnPayload = data.treinamentos.map((t) => ({
              funcionario_id: supabaseFuncId,
              nome_curso: t.nome_curso,
              data_validade: toSafeDateForSupabase(t.data_validade),
              status: t.status === 'vencido' ? 'vencido' : 'valido',
              carga_horaria: t.carga_horaria || '20h',
              categoria: t.categoria || null,
              vencimento_treinamento: t.vencimento_treinamento || null,
              vencimento_aso: t.vencimento_aso || null,
              status_webtraining: t.status_webtraining || null,
              origem: t.origem || 'manual',
            }));

            let trnRes = await supabase.from('treinamentos').insert(trnPayload);
            if (trnRes.error) {
              // Se falhou por ausência de colunas extras na tabela, insere apenas as colunas padrão
              const basicPayload = trnPayload.map((t) => ({
                funcionario_id: t.funcionario_id,
                nome_curso: t.nome_curso,
                data_validade: t.data_validade,
                status: t.status,
                carga_horaria: t.carga_horaria,
              }));
              await supabase.from('treinamentos').insert(basicPayload);
            }
          }
        }
      } catch (err) {
        console.warn('Aviso: Erro ao persistir no Supabase, salvando localmente e no servidor:', err);
      }
    }

    // 2. Montar o objeto completo do colaborador
    const finalId = data.id || supabaseFuncId || `vli-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const complete: FuncionarioWithTreinamentos = {
      id: finalId,
      nome: data.nome.trim(),
      matricula: cleanMatricula,
      foto_url: data.foto_url || null,
      cargo: data.cargo || 'Operação Ferroviária & Logística',
      unidade: data.unidade || 'Corredor Centro-Leste',
      genero: data.genero || 'H',
      webtraining_url: data.webtraining_url ? data.webtraining_url.trim() : undefined,
      last_webtraining_sync: data.last_webtraining_sync || (data.webtraining_url ? nowIso : undefined),
      created_at: nowIso,
      treinamentos: (data.treinamentos || []).map((t, idx) => ({
        id: `trn-${Date.now()}-${idx}`,
        funcionario_id: finalId,
        nome_curso: t.nome_curso,
        data_validade: t.data_validade,
        status: t.status === 'vencido' ? 'vencido' : 'valido',
        carga_horaria: t.carga_horaria || '20h',
        origem: t.origem || 'manual',
        categoria: t.categoria,
        vencimento_treinamento: t.vencimento_treinamento,
        vencimento_aso: t.vencimento_aso,
        status_webtraining: t.status_webtraining,
      })),
    };

    // 3. Salvar no Local Storage (sem duplicar por id ou matrícula)
    const currentList = loadLocalStore();
    const cleanMatLower = cleanMatricula.toLowerCase();
    const filteredList = currentList.filter((f) => {
      const isSameId = (f.id || '').toLowerCase() === finalId.toLowerCase();
      const isSameMat = cleanMatLower && (f.matricula || '').trim().toLowerCase() === cleanMatLower;
      return !isSameId && !isSameMat;
    });

    const updatedLocalList = [complete, ...filteredList];
    saveLocalStore(updatedLocalList);

    // 4. Salvar no servidor Express
    try {
      await fetch('/api/colaboradores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(complete),
      });
    } catch {}

    return complete;
  },

  /**
   * Cria um novo colaborador com seus treinamentos
   */
  async createFuncionario(
    funcionario: Omit<Funcionario, 'id' | 'created_at'>,
    treinamentos: Omit<Treinamento, 'id' | 'funcionario_id'>[]
  ): Promise<FuncionarioWithTreinamentos> {
    return this.saveFuncionarioComplete({
      ...funcionario,
      treinamentos: treinamentos as any,
    });
  },

  /**
   * Atualiza dados de um colaborador e substitui seus treinamentos
   */
  async updateFuncionario(
    id: string,
    funcionario: Partial<Funcionario>,
    treinamentos?: Treinamento[]
  ): Promise<FuncionarioWithTreinamentos | null> {
    return this.saveFuncionarioComplete({
      id,
      nome: funcionario.nome || '',
      matricula: funcionario.matricula || '',
      cargo: funcionario.cargo,
      unidade: funcionario.unidade,
      foto_url: funcionario.foto_url || null,
      genero: funcionario.genero,
      treinamentos: (treinamentos || []) as any,
    });
  },

  /**
   * Alias de compatibilidade para salvamento completo
   */
  async saveFuncionarioComTreinamentos(data: Parameters<typeof dbService.saveFuncionarioComplete>[0]) {
    return this.saveFuncionarioComplete(data);
  },

  /**
   * Exclui um colaborador do banco de dados
   */
  async deleteFuncionario(id: string): Promise<boolean> {
    const supabase = getSupabase();
    if (supabase) {
      try {
        let targetUuid: string | null = isUuid(id) ? id.trim() : null;

        if (!targetUuid) {
          const { data: recs } = await supabase
            .from('funcionarios')
            .select('id')
            .ilike('matricula', id.trim())
            .limit(1);
          if (recs && recs.length > 0) {
            targetUuid = recs[0].id;
          }
        }

        if (targetUuid) {
          await supabase.from('treinamentos').delete().eq('funcionario_id', targetUuid);
          const { error } = await supabase.from('funcionarios').delete().eq('id', targetUuid);
          if (error) throw error;
        }
      } catch (err) {
        console.warn('Erro ao deletar no Supabase:', err);
      }
    }

    const current = loadLocalStore();
    const filtered = current.filter((f) => f.id !== id);
    saveLocalStore(filtered);

    try {
      fetch(`/api/colaboradores/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      }).catch(() => {});
    } catch {}

    return true;
  },

  /**
   * Catálogo de cursos cadastrados pelo usuário.
   * No primeiro acesso não deve mostrar nenhum curso prévio;
   * Cursos passam a aparecer conforme são adicionados via "+ Adicionar Curso Manual".
   */
  async getCatalogoCursos(): Promise<string[]> {
    try {
      const res = await fetch('/api/catalogo-cursos');
      if (res.ok) {
        const json = await res.json();
        if (json.success && Array.isArray(json.data)) {
          localStorage.setItem('vli_catalogo_cursos_adicionados', JSON.stringify(json.data));
          return json.data;
        }
      }
    } catch {}

    try {
      const raw = localStorage.getItem('vli_catalogo_cursos_adicionados');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}

    return [];
  },

  /**
   * Adiciona um novo curso ao catálogo dinâmico do sistema
   */
  async addCursoAoCatalogo(nomeCurso: string): Promise<string[]> {
    const trimmed = nomeCurso.trim();
    if (!trimmed) return this.getCatalogoCursos();

    let current: string[] = [];
    try {
      const raw = localStorage.getItem('vli_catalogo_cursos_adicionados');
      if (raw) current = JSON.parse(raw) || [];
    } catch {}

    if (!current.some((c) => c.toLowerCase() === trimmed.toLowerCase())) {
      current.push(trimmed);
      localStorage.setItem('vli_catalogo_cursos_adicionados', JSON.stringify(current));
    }

    try {
      await fetch('/api/catalogo-cursos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nome_curso: trimmed }),
      });
    } catch {}

    return current;
  },

  /**
   * Remove um curso do catálogo dinâmico de cursos
   * Remove do LocalStorage, do servidor Express e do Supabase
   */
  async removeCursoDoCatalogo(nomeCurso: string): Promise<string[]> {
    const trimmed = nomeCurso.trim();
    if (!trimmed) return this.getCatalogoCursos();

    let current: string[] = [];
    try {
      const raw = localStorage.getItem('vli_catalogo_cursos_adicionados');
      if (raw) current = JSON.parse(raw) || [];
    } catch {}

    const filtered = current.filter((c) => c.trim().toLowerCase() !== trimmed.toLowerCase());
    localStorage.setItem('vli_catalogo_cursos_adicionados', JSON.stringify(filtered));

    // Remove do servidor Express
    try {
      await fetch(`/api/catalogo-cursos/${encodeURIComponent(trimmed)}`, {
        method: 'DELETE',
      });
    } catch {}

    // Remove do Supabase se configurado
    const supabase = getSupabase();
    if (supabase) {
      try {
        await supabase.from('catalogo_cursos').delete().ilike('nome', trimmed);
      } catch (err) {
        console.warn('Aviso ao excluir do catálogo no Supabase:', err);
      }
    }

    return filtered;
  },

  /**
   * Adiciona um treinamento avulso a um colaborador existente
   */
  async addTreinamento(
    funcionarioId: string,
    treinamento: Omit<Treinamento, 'id' | 'funcionario_id'>
  ): Promise<Treinamento> {
    const newTrn: Treinamento = {
      id: `trn-${Date.now()}-${Math.random().toString(36).substring(2, 5)}`,
      funcionario_id: funcionarioId,
      nome_curso: treinamento.nome_curso,
      data_validade: treinamento.data_validade,
      status: treinamento.status,
      carga_horaria: treinamento.carga_horaria || '20h',
      origem: treinamento.origem || 'manual',
      categoria: treinamento.categoria,
      vencimento_treinamento: treinamento.vencimento_treinamento,
      vencimento_aso: treinamento.vencimento_aso,
      status_webtraining: treinamento.status_webtraining,
    };

    const supabase = getSupabase();
    if (supabase) {
      try {
        const { data, error } = await supabase
          .from('treinamentos')
          .insert(newTrn)
          .select()
          .single();
        if (!error && data) return data;
      } catch (err) {
        console.warn('Aviso ao inserir no Supabase:', err);
      }
    }

    const current = loadLocalStore();
    const target = current.find((f) => f.id === funcionarioId);
    if (target) {
      target.treinamentos.push(newTrn);
      saveLocalStore(current);
    }
    return newTrn;
  },

  /**
   * Converte uma imagem de foto para base64 seguro
   */
  async uploadFoto(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  },
};

/**
 * Script SQL para inicialização das tabelas no Supabase (caso desejado)
 */
export const SUPABASE_SQL_SCHEMA = `-- Script SQL para Configuração do Banco de Dados no Supabase
-- Copie e cole no "SQL Editor" do seu painel Supabase

-- 1. Habilitar extensões úteis
create extension if not exists "uuid-ossp";

-- 2. Tabela de Funcionários VLI
create table if not exists public.funcionarios (
  id uuid primary key default uuid_generate_v4(),
  nome text not null,
  matricula text unique not null,
  foto_url text,
  cargo text default 'Operador Ferroviário / Portuário',
  unidade text default 'Corredor Centro-Leste',
  genero text default 'H',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Garantir coluna genero caso a tabela já exista
alter table public.funcionarios add column if not exists genero text default 'H';

-- 3. Tabela de Treinamentos e Normas
create table if not exists public.treinamentos (
  id uuid primary key default uuid_generate_v4(),
  funcionario_id uuid references public.funcionarios(id) on delete cascade not null,
  nome_curso text not null,
  data_validade date not null,
  status text not null check (status in ('valido', 'vencido')),
  carga_horaria text default '20h',
  categoria text,
  vencimento_treinamento text,
  vencimento_aso text,
  status_webtraining text,
  origem text default 'manual',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabela de Catálogo Dinâmico de Cursos
create table if not exists public.catalogo_cursos (
  id uuid primary key default uuid_generate_v4(),
  nome text unique not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Tabela de Usuários Administradores
create table if not exists public.admin_users (
  id uuid primary key default uuid_generate_v4(),
  username text unique not null,
  password_hash text not null,
  is_default boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Índices de Busca Rápida por Matrícula e Status
create index if not exists idx_funcionarios_matricula on public.funcionarios (matricula);
create index if not exists idx_treinamentos_funcionario on public.treinamentos (funcionario_id);
create index if not exists idx_treinamentos_status on public.treinamentos (status);
create index if not exists idx_catalogo_cursos_nome on public.catalogo_cursos (nome);

-- 7. Políticas de Segurança (Row Level Security)
alter table public.funcionarios enable row level security;
alter table public.treinamentos enable row level security;
alter table public.catalogo_cursos enable row level security;
alter table public.admin_users enable row level security;

-- Leitura pública dos crachás e treinamentos para conferência via QR Code
create policy "Permitir leitura pública de funcionários para verificação de crachá"
  on public.funcionarios for select using (true);

create policy "Permitir leitura pública de treinamentos para verificação"
  on public.treinamentos for select using (true);

create policy "Permitir leitura pública do catálogo de cursos"
  on public.catalogo_cursos for select using (true);

create policy "Permitir gestão de funcionários"
  on public.funcionarios for all using (true);

create policy "Permitir gestão de treinamentos"
  on public.treinamentos for all using (true);

create policy "Permitir gestão do catálogo de cursos"
  on public.catalogo_cursos for all using (true);

create policy "Permitir gestão de admin_users"
  on public.admin_users for all using (true);
`;
