import type { FuncionarioWithTreinamentos, Treinamento } from '../types';

/**
 * Utilitário de Codificação Portátil de Crachá VLI
 * Permite que um crachá digital seja compartilhado via link (WhatsApp, E-mail, QR Code)
 * e aberto em QUALQUER celular, tablet ou computador instantaneamente,
 * sem depender de banco de dados prévio ou configuração de servidor.
 */

interface MinifiedBadge {
  i: string; // id
  n: string; // nome
  m: string; // matricula
  c?: string; // cargo
  u?: string; // unidade
  g?: 'H' | 'M'; // genero
  w?: string; // webtraining_url
  s?: string; // last_webtraining_sync
  t: Array<[
    string, // 0: nome_curso
    string, // 1: data_validade
    number, // 2: 1 = valido, 0 = vencido
    string, // 3: carga_horaria
    number, // 4: 1 = universidade_vli, 0 = manual
    string, // 5: categoria
    string, // 6: vencimento_treinamento
    string, // 7: vencimento_aso
    string  // 8: status_webtraining
  ]>;
}

/**
 * Converte string para base64url compatível com navegadores e UTF-8
 */
export function toBase64Url(str: string): string {
  try {
    const bytes = new TextEncoder().encode(str);
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary)
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
  } catch (err) {
    console.error('Erro ao codificar Base64URL:', err);
    return '';
  }
}

/**
 * Decodifica base64url compatível com navegadores e UTF-8
 */
export function fromBase64Url(base64Url: string): string {
  try {
    let base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    while (base64.length % 4) {
      base64 += '=';
    }
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return new TextDecoder().decode(bytes);
  } catch (err) {
    console.error('Erro ao decodificar Base64URL:', err);
    return '';
  }
}

/**
 * Codifica um objeto FuncionarioWithTreinamentos em um token compacto
 */
export function encodeBadgeToken(employee: FuncionarioWithTreinamentos): string {
  if (!employee) return '';

  const minified: MinifiedBadge = {
    i: employee.id || `vli-${employee.matricula || Date.now()}`,
    n: String(employee.nome || '').trim().toUpperCase(),
    m: String(employee.matricula || '').trim(),
    c: employee.cargo ? String(employee.cargo).trim().toUpperCase() : '',
    u: employee.unidade ? String(employee.unidade).trim() : '',
    g: employee.genero === 'M' ? 'M' : 'H',
    w: employee.webtraining_url ? String(employee.webtraining_url).trim() : undefined,
    s: employee.last_webtraining_sync ? String(employee.last_webtraining_sync).trim() : undefined,
    t: (employee.treinamentos || []).map((t) => [
      String(t.nome_curso || '').trim(),
      String(t.data_validade || '').trim(),
      t.status === 'vencido' ? 0 : 1,
      String(t.carga_horaria || '').trim(),
      t.origem === 'universidade_vli' ? 1 : 0,
      String(t.categoria || '').trim(),
      String(t.vencimento_treinamento || '').trim(),
      String(t.vencimento_aso || '').trim(),
      String(t.status_webtraining || '').trim(),
    ]),
  };

  const jsonStr = JSON.stringify(minified);
  return toBase64Url(jsonStr);
}

/**
 * Decodifica um token em um objeto FuncionarioWithTreinamentos completo
 */
export function decodeBadgeToken(token: string): FuncionarioWithTreinamentos | null {
  if (!token || typeof token !== 'string') return null;

  try {
    const jsonStr = fromBase64Url(token.trim());
    if (!jsonStr) return null;

    const m = JSON.parse(jsonStr) as MinifiedBadge;
    if (!m || !m.n || !m.m) return null;

    const empId = m.i || `vli-${m.m}`;

    const treinamentos: Treinamento[] = (m.t || []).map((item, idx) => ({
      id: `tr-${m.m}-${idx}-${Date.now().toString(36)}`,
      funcionario_id: empId,
      nome_curso: item[0] || 'Treinamento Operacional',
      data_validade: item[1] || '2099-12-31',
      status: item[2] === 0 ? 'vencido' : 'valido',
      carga_horaria: item[3] || undefined,
      origem: item[4] === 1 ? 'universidade_vli' : 'manual',
      categoria: item[5] || undefined,
      vencimento_treinamento: item[6] || undefined,
      vencimento_aso: item[7] || undefined,
      status_webtraining: item[8] || undefined,
    }));

    return {
      id: empId,
      nome: m.n,
      matricula: m.m,
      cargo: m.c || 'COLABORADOR VLI',
      unidade: m.u || 'CORREDOR CENTRO-LESTE',
      genero: m.g || 'H',
      foto_url: null,
      webtraining_url: m.w || undefined,
      last_webtraining_sync: m.s || undefined,
      created_at: new Date().toISOString(),
      treinamentos,
    };
  } catch (err) {
    console.error('Falha ao decodificar token do crachá:', err);
    return null;
  }
}

/**
 * Gera a URL completa para compartilhamento do crachá.
 * Inclui o parâmetro ?d= com o crachá serializado, garantindo que qualquer
 * celular consiga abrir o crachá mesmo sem banco de dados ou em redes isoladas.
 */
export function buildShareableBadgeUrl(
  employee: FuncionarioWithTreinamentos,
  origin = typeof window !== 'undefined' ? window.location.origin : ''
): string {
  if (!employee) return '';
  const identifier = employee.matricula || employee.id;
  const token = encodeBadgeToken(employee);
  const baseUrl = `${origin}/card/${encodeURIComponent(identifier)}`;

  if (token) {
    return `${baseUrl}?d=${token}`;
  }
  return baseUrl;
}

/**
 * Tenta extrair e decodificar dados do crachá a partir da URL atual ou de uma string
 */
export function extractBadgeFromCurrentUrl(): FuncionarioWithTreinamentos | null {
  if (typeof window === 'undefined') return null;

  try {
    const params = new URLSearchParams(window.location.search);
    const dataParam = params.get('d') || params.get('data') || params.get('token');

    if (dataParam) {
      return decodeBadgeToken(dataParam);
    }

    // Tenta no hash (#card/108167?d=...)
    if (window.location.hash.includes('d=')) {
      const hashQuery = window.location.hash.split('?')[1];
      if (hashQuery) {
        const hashParams = new URLSearchParams(hashQuery);
        const hashData = hashParams.get('d') || hashParams.get('data');
        if (hashData) {
          return decodeBadgeToken(hashData);
        }
      }
    }
  } catch (e) {
    console.warn('Aviso ao extrair crachá da URL:', e);
  }

  return null;
}
