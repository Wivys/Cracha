import { decodeHtmlBuffer, repairCorruptedText, repairCourseObject } from '../src/lib/textSanitizer';

export default async function handler(req: any, res: any) {
  // Configuração de cabeçalhos CORS para permitir requisições sem atrito
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
        // Se falhar o parse, body continua como string
      }
    }

    const { url, htmlContent } = body || {};
    let html = '';

    if (url && typeof url === 'string') {
      let targetUrl = url.trim();
      if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
        targetUrl = 'https://' + targetUrl;
      }

      // Timeout de 6 segundos para evitar que funções Vercel estourem o limite
      const abortController = new AbortController();
      const timeoutTimer = setTimeout(() => abortController.abort(), 6000);

      let fetchResponse: any;
      try {
        fetchResponse = await fetch(targetUrl, {
          signal: abortController.signal,
          redirect: 'follow',
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
            Accept:
              'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
            'Cache-Control': 'no-cache',
            Pragma: 'no-cache',
            Referer: 'https://universidadevli.webtraining.com.br/',
          },
        });
      } catch (fetchErr: any) {
        clearTimeout(timeoutTimer);
        // Retorna status 200 com flag de erro para evitar que a Vercel logue 500 no navegador
        return res.status(200).json({
          success: false,
          blocked: true,
          error:
            'O servidor corporativo da Universidade VLI restringiu o acesso externo direto ou o tempo limite esgotou. Como a rede corporativa possui firewall, abra o link no seu navegador e utilize a opção "Colar HTML" abaixo.',
        });
      } finally {
        clearTimeout(timeoutTimer);
      }

      if (!fetchResponse.ok) {
        return res.status(200).json({
          success: false,
          blocked: true,
          error: `O servidor da Universidade VLI retornou status ${fetchResponse.status}. Abra o link no navegador e cole o código HTML da página.`,
        });
      }

      // Detecta se a página foi redirecionada para a tela de erro do Webtraining
      const finalUrl = fetchResponse.url || '';
      if (finalUrl.includes('erro.asp') || finalUrl.includes('errcode=')) {
        return res.status(200).json({
          success: false,
          blocked: true,
          error:
            'O crachá no Webtraining está expirado ou o link é inválido. Abra o link no navegador e copie o código HTML da página.',
        });
      }

      const buffer = await fetchResponse.arrayBuffer();
      const contentType = fetchResponse.headers.get('content-type') || '';
      html = decodeHtmlBuffer(buffer, contentType);

      if (html.includes('Erro Desconhecido') || html.includes('erro.asp?errcode')) {
        return res.status(200).json({
          success: false,
          blocked: true,
          error:
            'A Universidade VLI retornou "Erro Desconhecido" para este link (sessão expirada). Abra o crachá no navegador corporativo e cole o código HTML da página.',
        });
      }
    } else if (htmlContent && typeof htmlContent === 'string') {
      html = repairCorruptedText(htmlContent);
    } else {
      return res.status(200).json({
        success: false,
        error: 'É necessário fornecer a URL do crachá ou o código HTML da página.',
      });
    }

    // 1. Extração do Nome
    let nome = '';
    const nomeMatch =
      html.match(/<span>([A-ZÀ-Ú\s]{3,})<\/span>/i) ||
      html.match(/<h2[^>]*>Crach[áa]<\/h2>[\s\S]*?<span>([^<]+)<\/span>/i) ||
      html.match(/<strong>Crach[áa]<\/strong><\/h2>[\s\S]*?<p>[\s\S]*?<span>([^<]+)<\/span>/i) ||
      html.match(/Nome:\s*([A-ZÀ-Úa-z\s]{3,})/i);
    if (nomeMatch && nomeMatch[1]) {
      nome = repairCorruptedText(nomeMatch[1].trim());
    }

    // 2. Extração de Matrícula / ID
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
      cargo = repairCorruptedText(cargoMatch[1].trim());
    }

    // 4. Extração dos Cursos da tabela #tabelaCracha
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
    return res.status(200).json({
      success: false,
      blocked: true,
      error: `Não foi possível processar o link: ${err.message || 'Erro de conexão'}. Utilize a opção de colar o código HTML da página.`,
    });
  }
}

