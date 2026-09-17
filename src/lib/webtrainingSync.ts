import { FuncionarioWithTreinamentos, Treinamento } from '../types';
import { extractFromWebtrainingUrl } from './webtrainingParser';
import { dbService } from './supabase';
import { repairCorruptedText } from './textSanitizer';

/**
 * Utilitário de Sincronização Diária da Universidade VLI (Webtraining)
 *
 * Responsável por:
 * 1. Verificar se a sincronização diária está pendente (uma vez ao dia ou sob demanda)
 * 2. Consultar o link oficial da Universidade VLI
 * 3. Identificar alterações de vencimentos, status e novos cursos
 * 4. Preservar intactos os cursos manuais cadastrados pelo gestor
 * 5. Persistir as atualizações no banco de dados e no armazenamento local
 */

/**
 * Verifica se a sincronização diária é necessária para o colaborador
 * Retorna true se:
 * - Nunca foi sincronizado
 * - Última sincronização foi há mais de 12 horas ou em dia calendário anterior
 */
export function isDailySyncDue(lastSyncIso?: string): boolean {
  if (!lastSyncIso) return true;

  try {
    const lastSyncDate = new Date(lastSyncIso);
    if (isNaN(lastSyncDate.getTime())) return true;

    const now = new Date();

    // Se a data em calendário local for diferente (ex: ontem vs hoje)
    const lastDayStr = `${lastSyncDate.getFullYear()}-${String(lastSyncDate.getMonth() + 1).padStart(2, '0')}-${String(lastSyncDate.getDate()).padStart(2, '0')}`;
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    if (lastDayStr !== todayStr) {
      return true;
    }

    // Se já se passaram mais de 12 horas desde a última checagem
    const diffMs = now.getTime() - lastSyncDate.getTime();
    const diffHours = diffMs / (1000 * 60 * 60);

    return diffHours >= 12;
  } catch {
    return true;
  }
}

/**
 * Formata o momento da última sincronização para exibição amigável
 */
export function formatLastSyncDate(lastSyncIso?: string): string {
  if (!lastSyncIso) return 'Pendente (primeira sincronização)';

  try {
    const syncDate = new Date(lastSyncIso);
    if (isNaN(syncDate.getTime())) return 'Pendente';

    const now = new Date();
    const isToday =
      syncDate.getDate() === now.getDate() &&
      syncDate.getMonth() === now.getMonth() &&
      syncDate.getFullYear() === now.getFullYear();

    const hours = String(syncDate.getHours()).padStart(2, '0');
    const minutes = String(syncDate.getMinutes()).padStart(2, '0');

    if (isToday) {
      return `Hoje às ${hours}:${minutes}`;
    }

    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const isYesterday =
      syncDate.getDate() === yesterday.getDate() &&
      syncDate.getMonth() === yesterday.getMonth() &&
      syncDate.getFullYear() === yesterday.getFullYear();

    if (isYesterday) {
      return `Ontem às ${hours}:${minutes}`;
    }

    const day = String(syncDate.getDate()).padStart(2, '0');
    const month = String(syncDate.getMonth() + 1).padStart(2, '0');
    const year = syncDate.getFullYear();

    return `${day}/${month}/${year} às ${hours}:${minutes}`;
  } catch {
    return 'Data desconhecida';
  }
}

export interface SyncResult {
  updated: boolean;
  employee: FuncionarioWithTreinamentos;
  changesCount: number;
  message: string;
  error?: string;
}

/**
 * Executa a sincronização dos cursos da Universidade VLI para um colaborador
 *
 * @param employee Colaborador a ser sincronizado
 * @param force Se true, força a atualização mesmo que já tenha sido sincronizado hoje
 */
export async function syncEmployeeWebtraining(
  employee: FuncionarioWithTreinamentos,
  force = false
): Promise<SyncResult> {
  const url = (employee.webtraining_url || '').trim();

  if (!url) {
    return {
      updated: false,
      employee,
      changesCount: 0,
      message: 'Colaborador não possui link da Universidade VLI vinculado.',
    };
  }

  // Se não foi forçado e não precisa sincronizar hoje
  if (!force && !isDailySyncDue(employee.last_webtraining_sync)) {
    return {
      updated: false,
      employee,
      changesCount: 0,
      message: `Já atualizado hoje (${formatLastSyncDate(employee.last_webtraining_sync)}).`,
    };
  }

  try {
    // 1. Extração dos dados mais atualizados da Universidade VLI
    const parsedData = await extractFromWebtrainingUrl(url);

    // 2. Separa os cursos manuais já existentes para não perdê-los
    const currentTrainings = Array.isArray(employee.treinamentos) ? employee.treinamentos : [];
    const manualCourses = currentTrainings.filter((t) => t.origem !== 'universidade_vli');
    const existingVliCourses = currentTrainings.filter((t) => t.origem === 'universidade_vli');

    // 3. Monta a lista de cursos vindos da Universidade VLI
    const newVliCourses: Treinamento[] = (parsedData.cursos || []).map((c, idx) => ({
      id: `trn-vli-${Date.now()}-${idx}`,
      funcionario_id: employee.id,
      nome_curso: repairCorruptedText(c.nome_curso),
      data_validade: c.data_validade,
      status: c.status,
      carga_horaria: '40h',
      origem: 'universidade_vli',
      categoria: repairCorruptedText(c.categoria),
      vencimento_treinamento: repairCorruptedText(c.vencimento_treinamento),
      vencimento_aso: repairCorruptedText(c.vencimento_aso),
      status_webtraining: repairCorruptedText(c.status_webtraining),
    }));

    // 4. Detecção de mudanças para feedback ao usuário
    let changesCount = 0;
    const existingMap = new Map<string, Treinamento>();
    existingVliCourses.forEach((t) => {
      existingMap.set(t.nome_curso.toLowerCase().trim(), t);
    });

    newVliCourses.forEach((n) => {
      const existing = existingMap.get(n.nome_curso.toLowerCase().trim());
      if (!existing) {
        changesCount++; // Novo curso adicionado
      } else if (
        existing.data_validade !== n.data_validade ||
        existing.status !== n.status ||
        existing.vencimento_treinamento !== n.vencimento_treinamento ||
        existing.status_webtraining !== n.status_webtraining
      ) {
        changesCount++; // Vencimento ou status alterado
      }
    });

    // Se cursos foram removidos ou a contagem mudou
    if (newVliCourses.length !== existingVliCourses.length && changesCount === 0) {
      changesCount = Math.abs(newVliCourses.length - existingVliCourses.length);
    }

    // 5. Unifica: cursos manuais preservados + cursos da universidade atualizados
    const combinedTrainings = [...manualCourses, ...newVliCourses];

    const nowIso = new Date().toISOString();

    // 6. Atualiza e persiste o colaborador
    const saved = await dbService.saveFuncionarioComplete({
      id: employee.id,
      nome: employee.nome,
      matricula: employee.matricula,
      cargo: employee.cargo,
      unidade: employee.unidade,
      foto_url: employee.foto_url,
      genero: employee.genero,
      webtraining_url: url,
      last_webtraining_sync: nowIso,
      treinamentos: combinedTrainings.map((t) => ({
        nome_curso: t.nome_curso,
        data_validade: t.data_validade,
        status: t.status,
        carga_horaria: t.carga_horaria || '40h',
        origem: t.origem || 'manual',
        categoria: t.categoria,
        vencimento_treinamento: t.vencimento_treinamento,
        vencimento_aso: t.vencimento_aso,
        status_webtraining: t.status_webtraining,
      })),
    });

    const successMessage =
      changesCount > 0
        ? `${changesCount} alteração(ões) de curso/vencimento atualizada(s) da Universidade VLI!`
        : `Sincronização diária concluída. Todos os ${newVliCourses.length} cursos estão atualizados.`;

    return {
      updated: true,
      employee: saved,
      changesCount,
      message: successMessage,
    };
  } catch (err: any) {
    const errorMsg = err.message || 'Falha ao conectar à Universidade VLI.';
    return {
      updated: false,
      employee,
      changesCount: 0,
      message: errorMsg,
      error: errorMsg,
    };
  }
}

/**
 * Sincroniza em lote todos os colaboradores que possuem link vinculado
 */
export async function syncAllLinkedEmployees(
  employees: FuncionarioWithTreinamentos[],
  force = false
): Promise<{
  totalLinked: number;
  updatedCount: number;
  totalChanges: number;
  results: Array<{ id: string; nome: string; message: string; updated: boolean }>;
}> {
  const linked = employees.filter((e) => Boolean(e.webtraining_url && e.webtraining_url.trim()));

  const results: Array<{ id: string; nome: string; message: string; updated: boolean }> = [];
  let updatedCount = 0;
  let totalChanges = 0;

  for (const emp of linked) {
    // Se não é forçado e não precisa sincronizar hoje, pula
    if (!force && !isDailySyncDue(emp.last_webtraining_sync)) {
      continue;
    }

    const res = await syncEmployeeWebtraining(emp, force);
    if (res.updated) {
      updatedCount++;
      totalChanges += res.changesCount;
    }
    results.push({
      id: emp.id,
      nome: emp.nome,
      message: res.message,
      updated: res.updated,
    });
  }

  return {
    totalLinked: linked.length,
    updatedCount,
    totalChanges,
    results,
  };
}
