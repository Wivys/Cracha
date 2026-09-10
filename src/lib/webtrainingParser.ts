import { WebtrainingParsedData, WebtrainingParsedCourse } from '../types';

/**
 * Utilitário para extração e processamento de informações do Crachá da Universidade VLI (Webtraining)
 * Exemplo de estrutura de URL: https://universidadevli.webtraining.com.br/crachap.asp?p=XX&v=XXXXX&z=XXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX
 */

/**
 * Extrai dados via chamada à API do backend (/api/extract-webtraining)
 */
export async function extractFromWebtrainingUrl(url: string): Promise<WebtrainingParsedData> {
  const cleanUrl = url.trim();

  if (!cleanUrl) {
    throw new Error('Informe a URL do crachá da Universidade VLI.');
  }

  // Chamar o endpoint no backend Express para contornar restrições de CORS
  const response = await fetch('/api/extract-webtraining', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: cleanUrl }),
  });

  const json = await response.json();

  if (!response.ok || !json.success) {
    throw new Error(json.error || 'Falha ao extrair dados da Universidade VLI.');
  }

  return json.data;
}

/**
 * Analisa e extrai informações diretamente a partir do código HTML da página do Webtraining
 * Útil para contingência caso o usuário cole o código fonte ou em caso de rede interna
 */
export function parseWebtrainingHtml(html: string): WebtrainingParsedData {
  if (!html || typeof html !== 'string') {
    throw new Error('Conteúdo HTML inválido.');
  }

  // 1. Extração do Nome
  let nome = '';
  const nomeMatch =
    html.match(/<span>([A-ZÀ-Ú\s]{3,})<\/span>/i) ||
    html.match(/<h2[^>]*>Crach[áa]<\/h2>[\s\S]*?<span>([^<]+)<\/span>/i) ||
    html.match(/<strong>Crach[áa]<\/strong><\/h2>[\s\S]*?<p>[\s\S]*?<span>([^<]+)<\/span>/i);
  if (nomeMatch && nomeMatch[1]) {
    nome = nomeMatch[1].trim();
  }

  // 2. Extração do ID / Matrícula
  let matricula = '';
  const idMatch =
    html.match(/<span>ID:\s*([0-9A-Za-z\-_]+)<\/span>/i) ||
    html.match(/ID:\s*([0-9A-Za-z\-_]+)/i);
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

      cursos.push({
        nome_curso: atividade,
        categoria,
        vencimento_treinamento: vencimentoTrein,
        vencimento_aso: vencimentoAso,
        status_webtraining: statusWeb,
        status: statusGeral,
        data_validade: dataValidadeISO,
        origem: 'universidade_vli',
      });
    }
  }

  return {
    nome,
    matricula,
    cargo,
    cursos,
    totalCursos: cursos.length,
    fonte: 'Universidade VLi (Webtraining)',
  };
}
