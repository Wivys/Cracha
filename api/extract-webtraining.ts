import { decodeHtmlBuffer, repairCorruptedText, repairCourseObject } from '../src/lib/textSanitizer';

/**
 * Busca o conteúdo da página do Webtraining utilizando estratégias em cascata
 * para superar firewalls corporativos, restrições geográficas e bloqueios de datacenter.
 */
async function fetchWebtrainingWithFallback(targetUrl: string): Promise<{ content: string; type: 'html' | 'markdown' } | null> {
  // 1. TENTATIVA DIRETA: Cabeçalhos idênticos aos do Google Chrome no Windows
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 3500);

    const directRes = await fetch(targetUrl, {
      signal: ac.signal,
      redirect: 'follow',
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        Accept:
          'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
        'Sec-Ch-Ua-Mobile': '?0',
        'Sec-Ch-Ua-Platform': '"Windows"',
        'Sec-Fetch-Dest': 'document',
        'Sec-Fetch-Mode': 'navigate',
        'Sec-Fetch-Site': 'none',
        'Sec-Fetch-User': '?1',
        'Upgrade-Insecure-Requests': '1',
        Referer: 'https://universidadevli.webtraining.com.br/',
      },
    });
    clearTimeout(t);

    const finalUrl = directRes.url || '';
    if (directRes.ok && !finalUrl.includes('erro.asp') && !finalUrl.includes('errcode=')) {
      const buffer = await directRes.arrayBuffer();
      const contentType = directRes.headers.get('content-type') || '';
      const html = decodeHtmlBuffer(buffer, contentType);
      if (html.length > 200 && !html.includes('Erro Desconhecido')) {
        return { content: html, type: 'html' };
      }
    }
  } catch {
    // Falha ou timeout na conexão direta; aciona o gateway Jina
  }

  // 2. TENTATIVA VIA GATEWAY JINA READER (Renderiza páginas dinâmicas e bypassa firewalls)
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 5000);

    const jinaRes = await fetch(`https://r.jina.ai/${targetUrl}`, {
      signal: ac.signal,
      headers: {
        Accept: 'application/json',
        'X-Return-Format': 'html',
      },
    });
    clearTimeout(t);

    if (jinaRes.ok) {
      const json = await jinaRes.json();
      const rawHtml = json?.data?.html;
      const rawMarkdown = json?.data?.content;

      if (rawHtml && rawHtml.length > 100 && !rawHtml.includes('Erro Desconhecido')) {
        return { content: rawHtml, type: 'html' };
      }
      if (rawMarkdown && rawMarkdown.length > 100 && !rawMarkdown.includes('Erro Desconhecido')) {
        return { content: rawMarkdown, type: 'markdown' };
      }
    }
  } catch {
    // Falha no Jina; aciona o proxy alternativo
  }

  // 3. TENTATIVA VIA ALLORIGINS (Proxy de conteúdo HTTP)
  try {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), 4500);

    const proxyRes = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(targetUrl)}`, {
      signal: ac.signal,
    });
    clearTimeout(t);

    if (proxyRes.ok) {
      const json = await proxyRes.json();
      if (json?.contents && json.contents.length > 200) {
        return { content: json.contents, type: 'html' };
      }
    }
  } catch {
    // Falha em todos os gateways
  }

  return null;
}

export default async function handler(req: any, res: any) {
  // Cabeçalhos CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Método não permitido. Use POST.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {
        // mantém como string se falhar
      }
    }

    const { url, htmlContent } = body || {};
    let pageContent = '';

    if (url && typeof url === 'string') {
      let targetUrl = url.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      const fetched = await fetchWebtrainingWithFallback(targetUrl);
      if (!fetched || !fetched.content) {
        return res.status(200).json({
          success: false,
          blocked: true,
          error:
            'Não foi possível estabelecer contato com a Universidade VLI para este link. Verifique se o endereço do crachá está correto.',
        });
      }

      pageContent = fetched.content;
    } else if (htmlContent && typeof htmlContent === 'string') {
      pageContent = repairCorruptedText(htmlContent);
    } else {
      return res.status(200).json({
        success: false,
        error: 'É necessário fornecer a URL do crachá da Universidade VLI.',
      });
    }

    // 1. Extração de Nome
    let nome = '';
    const nomeMatch =
      pageContent.match(/<span>([A-ZÀ-Ú\s]{3,})<\/span>/i) ||
      pageContent.match(/<h2[^>]*>Crach[áa]<\/h2>[\s\S]*?<span>([^<]+)<\/span>/i) ||
      pageContent.match(/<strong>Crach[áa]<\/strong><\/h2>[\s\S]*?<p>[\s\S]*?<span>([^<]+)<\/span>/i) ||
      pageContent.match(/Nome:\s*([A-ZÀ-Úa-z\s]{3,})/i) ||
      pageContent.match(/\*\*Nome:\*\*\s*([A-ZÀ-Úa-z\s]{3,})/i) ||
      pageContent.match(/#+\s*Crach[áa][\s\S]*?\n\s*([A-ZÀ-Ú\s]{4,})/i);
    if (nomeMatch && nomeMatch[1]) {
      nome = repairCorruptedText(nomeMatch[1].replace(/Nome:\s*/i, '').replace(/[*#]/g, '').trim());
    }

    // 2. Extração de Matrícula / ID
    let matricula = '';
    const idMatch =
      pageContent.match(/<span>ID:\s*([0-9A-Za-z\-_]+)<\/span>/i) ||
      pageContent.match(/ID:\s*([0-9A-Za-z\-_]+)/i) ||
      pageContent.match(/Matr[íi]cula:\s*([0-9A-Za-z\-_]+)/i) ||
      pageContent.match(/\*\*Matr[íi]cula:\*\*\s*([0-9A-Za-z\-_]+)/i) ||
      pageContent.match(/\*\*ID:\*\*\s*([0-9A-Za-z\-_]+)/i);
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
      pageContent.match(/<span>Cargo:\s*([^<]+)<\/span>/i) ||
      pageContent.match(/Cargo:\s*([^<\n\r]+)/i) ||
      pageContent.match(/\*\*Cargo:\*\*\s*([^\n\r]+)/i);
    if (cargoMatch && cargoMatch[1]) {
      cargo = repairCorruptedText(cargoMatch[1].replace(/Cargo:\s*/i, '').replace(/[*#]/g, '').trim());
    }

    // 4. Extração dos Cursos (Suporte a HTML, Markdown e texto puro)
    const cursos: any[] = [];

    // 4A. Tabela HTML (<tr><td>...)
    const rowRegex = /<tr[^>]*>([\s\S]*?)<\/tr>/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRegex.exec(pageContent)) !== null) {
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

    // 4B. Tabela Markdown (| col1 | col2 | ...)
    if (cursos.length === 0) {
      const lines = pageContent.split(/\r?\n/);
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
            const categoria = repairCorruptedText(cols[0] || 'Requisitos Legais');
            const atividade = repairCorruptedText(cols[1] || '');
            const vencimentoTrein = repairCorruptedText(cols[2] || 'Não aplicável');
            const vencimentoAso = repairCorruptedText(cols[3] || 'Não aplicável');
            const statusWeb = repairCorruptedText(cols[4] || 'Liberado');

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
      }
    }

    // 4C. Fallback: texto puro com datas dd/mm/aaaa
    if (cursos.length === 0) {
      const lines = pageContent.split(/\r?\n/);
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
    return res.status(200).json({
      success: false,
      blocked: true,
      error: `Não foi possível processar o link da Universidade VLI: ${err.message || 'Erro inesperado'}.`,
    });
  }
}
