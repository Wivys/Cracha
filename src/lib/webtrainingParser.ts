import { WebtrainingParsedData, WebtrainingParsedCourse } from '../types';
import { repairCorruptedText, repairCourseObject } from './textSanitizer';

/**
 * Utilitário para extração e processamento de informações do Crachá da Universidade VLI (Webtraining)
 * Suporta requisição multi-gateway em cascata (Direct + Jina Reader + Fallback Gateway)
 * e parsing polimórfico de HTML, Markdown e texto plano.
 */

/**
 * Tenta obter o conteúdo da URL diretamente do navegador via gateways públicos caso a API local falhe
 */
async function fetchClientFallback(targetUrl: string): Promise<string | null> {
  // Tentativa 1: Jina Reader API (JSON)
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 6000);
    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
        'X-Return-Format': 'html',
      },
    });
    clearTimeout(t);
    if (res.ok) {
      const json = await res.json();
      const content = json?.data?.html || json?.data?.content;
      if (content && content.length > 50) {
        return content;
      }
    }
  } catch {
    // Continua para o próximo
  }

  // Tentativa 2: Jina Reader Direto (Markdown/Texto)
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 6000);
    const res = await fetch(`https://r.jina.ai/${targetUrl}`, {
      signal: ac.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const text = await res.text();
      if (text && text.length > 50) {
        return text;
      }
    }
  } catch {
    // Continua para o próximo
  }

  // Tentativa 3: AllOrigins proxy
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, {
      signal: ac.signal,
    });
    clearTimeout(t);
    if (res.ok) {
      const json = await res.json();
      if (json?.contents) {
        return json.contents;
      }
    }
  } catch {
    // Falha silenciosa
  }

  return null;
}

/**
 * Extrai dados via chamada à API do backend com contingência automática no cliente
 */
export async function extractFromWebtrainingUrl(url: string): Promise<WebtrainingParsedData> {
  let cleanUrl = url.trim();

  if (!cleanUrl) {
    throw new Error('Informe a URL do crachá da Universidade VLI.');
  }

  // Previne erros caso o usuário cole sem o protocolo https://
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    cleanUrl = 'https://' + cleanUrl;
  }

  let serverData: WebtrainingParsedData | null = null;
  let serverErrorMessage = '';

  // 1. Primeira linha de ação: Chamada à API local (/api/extract-webtraining)
  try {
    const response = await fetch('/api/extract-webtraining', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: cleanUrl }),
    });

    const responseText = await response.text();
    let json: any = null;
    try {
      json = JSON.parse(responseText);
    } catch {
      // Se a resposta não foi JSON (ex: erro de gateway do Cloud Run)
      serverErrorMessage = 'O servidor intermediário demorou a responder.';
    }

    if (json && json.success && json.data) {
      serverData = json.data;
    } else if (json && json.error) {
      serverErrorMessage = json.error;
    }
  } catch (err: any) {
    serverErrorMessage = err.message || 'Falha de conexão com a API local.';
  }

  // Se a API do servidor retornou os dados com sucesso, finaliza
  if (serverData) {
    return {
      ...serverData,
      nome: repairCorruptedText(serverData.nome),
      cargo: repairCorruptedText(serverData.cargo),
      cursos: (serverData.cursos || []).map(repairCourseObject),
    };
  }

  // 2. Segunda linha de ação: Fallback cliente direto (bypassa firewalls de datacenter)
  try {
    const clientContent = await fetchClientFallback(cleanUrl);
    if (clientContent) {
      const parsed = parseWebtrainingHtml(clientContent);
      if (parsed.cursos.length > 0 || parsed.nome) {
        return parsed;
      }
    }
  } catch {
    // Falha silenciosa no fallback do cliente
  }

  // Se tudo falhar, apresenta mensagem amigável e objetiva
  throw new Error(
    serverErrorMessage ||
      'Não foi possível extrair os dados do link. Verifique se o link do crachá da Universidade VLI está ativo e correto.'
  );
}

/**
 * Analisa e extrai informações diretamente a partir do código HTML, Markdown ou texto
 */
export function parseWebtrainingHtml(html: string): WebtrainingParsedData {
  if (!html || typeof html !== 'string') {
    throw new Error('Conteúdo da página inválido.');
  }

  // 1. Extração do Nome
  let nome = '';
  const nomeMatch =
    html.match(/<span>([A-ZÀ-Ú\s]{3,})<\/span>/i) ||
    html.match(/<h2[^>]*>Crach[áa]<\/h2>[\s\S]*?<span>([^<]+)<\/span>/i) ||
    html.match(/<strong>Crach[áa]<\/strong><\/h2>[\s\S]*?<p>[\s\S]*?<span>([^<]+)<\/span>/i) ||
    html.match(/Nome:\s*([A-ZÀ-Úa-z\s]{3,})/i) ||
    html.match(/\*\*Nome:\*\*\s*([A-ZÀ-Úa-z\s]{3,})/i) ||
    html.match(/#+\s*Crach[áa][\s\S]*?\n\s*([A-ZÀ-Ú\s]{4,})/i);
  if (nomeMatch && nomeMatch[1]) {
    nome = nomeMatch[1].replace(/Nome:\s*/i, '').replace(/[*#]/g, '').trim();
  }

  // 2. Extração do ID / Matrícula
  let matricula = '';
  const idMatch =
    html.match(/<span>ID:\s*([0-9A-Za-z\-_]+)<\/span>/i) ||
    html.match(/ID:\s*([0-9A-Za-z\-_]+)/i) ||
    html.match(/Matr[íi]cula:\s*([0-9A-Za-z\-_]+)/i) ||
    html.match(/\*\*Matr[íi]cula:\*\*\s*([0-9A-Za-z\-_]+)/i) ||
    html.match(/\*\*ID:\*\*\s*([0-9A-Za-z\-_]+)/i);
  if (idMatch && idMatch[1]) {
    matricula = idMatch[1]
      .replace(/Matr[íi]cula:\s*/i, '')
      .replace(/ID:\s*/i, '')
      .replace(/[*#]/g, '')
      .trim();
  }

  // 3. Extração do Cargo
  let cargo = '';
  const cargoMatch =
    html.match(/<span>Cargo:\s*([^<]+)<\/span>/i) ||
    html.match(/Cargo:\s*([^<\n\r]+)/i) ||
    html.match(/\*\*Cargo:\*\*\s*([^\n\r]+)/i);
  if (cargoMatch && cargoMatch[1]) {
    cargo = cargoMatch[1].replace(/Cargo:\s*/i, '').replace(/[*#]/g, '').trim();
  }

  const cursos: WebtrainingParsedCourse[] = [];

  // 4A. Extração das Atividades / Cursos via tabela HTML clássica (<tr><td>...</td></tr>)
  const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1];
    if (rowContent.includes('<th') || rowContent.includes('Categoria')) {
      continue;
    }

    const tdRegex = /<td[^>]*>([\s\S]*?)<\/td>/gi;
    const tds: string[] = [];
    let tdMatch: RegExpExecArray | null;

    while ((tdMatch = tdRegex.exec(rowContent)) !== null) {
      const cleanText = tdMatch[1].replace(/<[^>]+>/g, '').trim();
      tds.push(cleanText);
    }

    if (tds.length >= 4) {
      const categoria = tds[0] || 'Requisitos Legais';
      const atividade = tds[1] || '';
      const vencimentoTrein = tds[2] || 'Não aplicável';
      const vencimentoAso = tds[3] || 'Não aplicável';
      const statusWeb = tds[4] || 'Liberado';

      if (!atividade) continue;

      let dataValidadeISO = '2030-12-31';
      let statusGeral: 'valido' | 'vencido' = 'valido';

      const dateMatch = vencimentoTrein.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        const [, dia, mes, ano] = dateMatch;
        dataValidadeISO = `${ano}-${mes}-${dia}`;

        const dateObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (dateObj < today) {
          statusGeral = 'vencido';
        }
      }

      if (
        statusWeb.toLowerCase().includes('vencid') ||
        statusWeb.toLowerCase().includes('bloquead')
      ) {
        statusGeral = 'vencido';
      }

      cursos.push(
        repairCourseObject({
          nome_curso: repairCorruptedText(atividade),
          categoria: repairCorruptedText(categoria),
          vencimento_treinamento: repairCorruptedText(vencimentoTrein),
          vencimento_aso: repairCorruptedText(vencimentoAso),
          status_webtraining: repairCorruptedText(statusWeb),
          status: statusGeral,
          data_validade: dataValidadeISO,
          origem: 'universidade_vli',
        })
      );
    }
  }

  // 4B. Extração via tabela Markdown (| col1 | col2 | col3 | ... |)
  if (cursos.length === 0) {
    const lines = html.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.startsWith('|') && trimmed.endsWith('|')) {
        const cols = trimmed
          .split('|')
          .map((c) => c.trim())
          .filter(Boolean);

        if (
          cols.length >= 3 &&
          !cols[0].toLowerCase().includes('categoria') &&
          !cols[0].includes('---')
        ) {
          const categoria = cols[0] || 'Requisitos Legais';
          const atividade = cols[1] || '';
          const vencimentoTrein = cols[2] || 'Não aplicável';
          const vencimentoAso = cols[3] || 'Não aplicável';
          const statusWeb = cols[4] || 'Liberado';

          if (!atividade || atividade.includes('---')) continue;

          let dataValidadeISO = '2030-12-31';
          let statusGeral: 'valido' | 'vencido' = 'valido';

          const dateMatch = vencimentoTrein.match(/(\d{2})\/(\d{2})\/(\d{4})/);
          if (dateMatch) {
            const [, dia, mes, ano] = dateMatch;
            dataValidadeISO = `${ano}-${mes}-${dia}`;
            const dateObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            if (dateObj < today) {
              statusGeral = 'vencido';
            }
          }

          if (
            statusWeb.toLowerCase().includes('vencid') ||
            statusWeb.toLowerCase().includes('bloquead')
          ) {
            statusGeral = 'vencido';
          }

          cursos.push(
            repairCourseObject({
              nome_curso: repairCorruptedText(atividade),
              categoria: repairCorruptedText(categoria),
              vencimento_treinamento: repairCorruptedText(vencimentoTrein),
              vencimento_aso: repairCorruptedText(vencimentoAso),
              status_webtraining: repairCorruptedText(statusWeb),
              status: statusGeral,
              data_validade: dataValidadeISO,
              origem: 'universidade_vli',
            })
          );
        }
      }
    }
  }

  // 4C. Fallback: texto corrido com datas dd/mm/aaaa
  if (cursos.length === 0) {
    const lines = html.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (
        !trimmed ||
        trimmed.toLowerCase().includes('categoria') ||
        trimmed.toLowerCase().includes('vencimento')
      ) {
        continue;
      }

      const dateMatch = trimmed.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        const parts = trimmed.split(/\t+| {2,}/).map((p) => p.trim()).filter(Boolean);
        const nomeCurso = parts[1] && parts[1].length > 3 ? parts[1] : parts[0];

        if (nomeCurso && !nomeCurso.toLowerCase().includes('requisitos') && nomeCurso.length > 2) {
          const [, dia, mes, ano] = dateMatch;
          const dataValidadeISO = `${ano}-${mes}-${dia}`;
          const dateObj = new Date(parseInt(ano, 10), parseInt(mes, 10) - 1, parseInt(dia, 10));
          const today = new Date();
          today.setHours(0, 0, 0, 0);

          cursos.push(
            repairCourseObject({
              nome_curso: repairCorruptedText(nomeCurso),
              categoria: 'Requisitos Legais',
              vencimento_treinamento: dateMatch[0],
              vencimento_aso: 'Não aplicável',
              status_webtraining: 'Liberado',
              status: dateObj < today ? 'vencido' : 'valido',
              data_validade: dataValidadeISO,
              origem: 'universidade_vli',
            })
          );
        }
      }
    }
  }

  return {
    nome: repairCorruptedText(nome),
    matricula,
    cargo: repairCorruptedText(cargo),
    cursos,
    totalCursos: cursos.length,
    fonte: 'Universidade VLi (Webtraining)',
  };
}
