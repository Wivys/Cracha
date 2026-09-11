import { WebtrainingParsedData, WebtrainingParsedCourse } from '../types';
import { repairCorruptedText, repairCourseObject } from './textSanitizer';

/**
 * Utilitário para extração e processamento de informações do Crachá da Universidade VLI (Webtraining)
 * Exemplo de estrutura de URL: https://universidadevli.webtraining.com.br/crachap.asp?p=XX&v=XXXXX&z=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 */

/**
 * Extrai dados via chamada à API do backend (/api/extract-webtraining)
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

  let response: Response;
  try {
    // Chamar o endpoint no backend Express com proteção contra CORS e timeout
    response = await fetch('/api/extract-webtraining', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ url: cleanUrl }),
    });
  } catch (networkErr: any) {
    throw new Error(
      'Não foi possível estabelecer conexão com o servidor local. Verifique sua conexão e tente novamente.'
    );
  }

  let responseText = '';
  try {
    responseText = await response.text();
  } catch {
    throw new Error('Falha ao ler resposta da Universidade VLI.');
  }

  // Parse defensivo de JSON para evitar o erro "Unexpected token 'A', 'A server e'... is not valid JSON"
  let json: any = null;
  try {
    json = JSON.parse(responseText);
  } catch {
    // Caso o proxy ou a nuvem tenha devolvido uma página de erro HTML ou texto plano
    if (
      responseText.toLowerCase().includes('server error') ||
      response.status === 500 ||
      response.status === 502 ||
      response.status === 504
    ) {
      throw new Error(
        'O servidor corporativo da Universidade VLI restringiu o acesso externo ao link ou a requisição expirou. Utilize a opção "Colar HTML" abaixo para importar os dados diretamente do navegador.'
      );
    }
    throw new Error(
      `Resposta inesperada do servidor (código ${response.status}). Utilize a opção de colar o HTML da página.`
    );
  }

  if (response.status === 500) {
    throw new Error(
      json?.error ||
        'O servidor da nuvem não pôde acessar o sistema interno da Universidade VLI (firewall corporativo). Utilize a opção "Colar HTML" abaixo para importar os dados diretamente.'
    );
  }

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Falha ao extrair dados da Universidade VLI.');
  }

  const rawData: WebtrainingParsedData = json.data;
  return {
    ...rawData,
    nome: repairCorruptedText(rawData.nome),
    cargo: repairCorruptedText(rawData.cargo),
    cursos: (rawData.cursos || []).map(repairCourseObject),
  };
}

/**
 * Analisa e extrai informações diretamente a partir do código HTML ou texto da página do Webtraining
 * Útil para contingência caso o usuário cole o código fonte ou em caso de rede interna corporativa
 */
export function parseWebtrainingHtml(html: string): WebtrainingParsedData {
  if (!html || typeof html !== 'string') {
    throw new Error('Conteúdo HTML ou texto inválido.');
  }

  // 1. Extração do Nome
  let nome = '';
  const nomeMatch =
    html.match(/<span>([A-ZÀ-Ú\s]{3,})<\/span>/i) ||
    html.match(/<h2[^>]*>Crach[áa]<\/h2>[\s\S]*?<span>([^<]+)<\/span>/i) ||
    html.match(/<strong>Crach[áa]<\/strong><\/h2>[\s\S]*?<p>[\s\S]*?<span>([^<]+)<\/span>/i) ||
    html.match(/Nome:\s*([A-ZÀ-Úa-z\s]{3,})/i);
  if (nomeMatch && nomeMatch[1]) {
    nome = nomeMatch[1].trim();
  }

  // 2. Extração do ID / Matrícula
  let matricula = '';
  const idMatch =
    html.match(/<span>ID:\s*([0-9A-Za-z\-_]+)<\/span>/i) ||
    html.match(/ID:\s*([0-9A-Za-z\-_]+)/i) ||
    html.match(/Matr[íi]cula:\s*([0-9A-Za-z\-_]+)/i);
  if (idMatch && idMatch[1]) {
    matricula = idMatch[1].trim();
  }

  // 3. Extração do Cargo
  let cargo = '';
  const cargoMatch =
    html.match(/<span>Cargo:\s*([^<]+)<\/span>/i) ||
    html.match(/Cargo:\s*([^<\n\r]+)/i);
  if (cargoMatch && cargoMatch[1]) {
    cargo = cargoMatch[1].trim();
  }

  // 4. Extração das Atividades / Cursos da tabela
  const cursos: WebtrainingParsedCourse[] = [];
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

  // Fallback: se não encontrou em <tr><td> (ex: texto copiado diretamente da página)
  if (cursos.length === 0) {
    const lines = html.split(/\r?\n/);
    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.toLowerCase().includes('categoria') || trimmed.toLowerCase().includes('vencimento')) {
        continue;
      }

      const dateMatch = trimmed.match(/(\d{2})\/(\d{2})\/(\d{4})/);
      if (dateMatch) {
        // Tenta separar por tabulação ou múltiplos espaços
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
