import { decodeHtmlBuffer, repairCorruptedText, repairCourseObject } from '../src/lib/textSanitizer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Use POST.' });
  }

  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ success: false, error: 'URL do crachá é obrigatória.' });
    }

    const cleanUrl = url.trim();
    if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
      return res.status(400).json({ success: false, error: 'URL inválida. Deve iniciar com http:// ou https://' });
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 12000);

    const response = await fetch(cleanUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
    });

    clearTimeout(timeout);

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: `Não foi possível acessar a página do crachá (Status ${response.status}).`,
      });
    }

    // Decodifica o buffer binário preservando a codificação ISO-8859-1 / Windows-1252 do Webtraining
    const buffer = await response.arrayBuffer();
    const contentType = response.headers.get('content-type') || '';
    const html = decodeHtmlBuffer(buffer, contentType);

    // 1. Extração do Nome
    let nome = '';
    const nomeMatch =
      html.match(/<span>([A-ZÀ-Ú\s]{3,})<\/span>/i) ||
      html.match(/<h2[^>]*>Crach[áa]<\/h2>[\s\S]*?<span>([^<]+)<\/span>/i) ||
      html.match(/<strong>Crach[áa]<\/strong><\/h2>[\s\S]*?<p>[\s\S]*?<span>([^<]+)<\/span>/i);
    if (nomeMatch && nomeMatch[1]) {
      nome = repairCorruptedText(nomeMatch[1].trim());
    }

    // 2. Extração de Matrícula / ID
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
      cargo = repairCorruptedText(cargoMatch[1].trim());
    }

    // 4. Extração dos Cursos da tabela
    const cursos: any[] = [];
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
        const categoria = repairCorruptedText(tds[0] || 'Requisitos Legais');
        const atividade = repairCorruptedText(tds[1] || '');
        const vencimentoTrein = repairCorruptedText(tds[2] || 'Não aplicável');
        const vencimentoAso = repairCorruptedText(tds[3] || 'Não aplicável');
        const statusWeb = repairCorruptedText(tds[4] || 'Liberado');

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

        if (statusWeb.toLowerCase().includes('vencid') || statusWeb.toLowerCase().includes('bloquead')) {
          statusGeral = 'vencido';
        }

        cursos.push(
          repairCourseObject({
            nome_curso: atividade,
            categoria,
            vencimento_treinamento: vencimentoTrein,
            vencimento_aso: vencimentoAso,
            status_webtraining: statusWeb,
            status: statusGeral,
            data_validade: dataValidadeISO,
            origem: 'universidade_vli',
          })
        );
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        nome,
        matricula,
        cargo,
        cursos,
        totalCursos: cursos.length,
        fonte: 'Universidade VLi (Webtraining)',
      },
    });
  } catch (err: any) {
    return res.status(500).json({
      success: false,
      error: `Falha ao processar o link: ${err.message || 'Erro interno'}`,
    });
  }
}
