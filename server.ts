import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { decodeHtmlBuffer, repairCorruptedText, repairCourseObject } from './src/lib/textSanitizer';

/**
 * Servidor Express integrado com Vite e rotas de API com persistência
 * - Porta 3000 em host 0.0.0.0 (padrão do contêiner)
 * - Persistência de crachás/colaboradores em arquivo local (data/colaboradores.json)
 * - Persistência do catálogo dinâmico de cursos (data/catalogo_cursos.json)
 * - Rota /api/extract-webtraining para extração da Universidade VLI sem restrição de CORS
 */
async function startServer() {
  const app = express();
  const PORT = 3000;

  // Diretório de dados persistentes
  const dataDir = path.join(process.cwd(), 'data');
  if (!fs.existsSync(dataDir)) {
    try {
      fs.mkdirSync(dataDir, { recursive: true });
    } catch (e) {
      console.warn('Não foi possível criar a pasta data:', e);
    }
  }

  const colaboradoresFile = path.join(dataDir, 'colaboradores.json');
  const catalogoCursosFile = path.join(dataDir, 'catalogo_cursos.json');

  // Helpers de leitura e escrita com tratamento de erro
  const readColaboradores = (): any[] => {
    try {
      if (fs.existsSync(colaboradoresFile)) {
        const raw = fs.readFileSync(colaboradoresFile, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err) {
      console.warn('Aviso ao ler colaboradores.json:', err);
    }
    return [];
  };

  const writeColaboradores = (list: any[]) => {
    try {
      fs.writeFileSync(colaboradoresFile, JSON.stringify(list, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erro ao escrever em colaboradores.json:', err);
    }
  };

  const readCatalogoCursos = (): string[] => {
    try {
      if (fs.existsSync(catalogoCursosFile)) {
        const raw = fs.readFileSync(catalogoCursosFile, 'utf-8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
      }
    } catch (err) {
      console.warn('Aviso ao ler catalogo_cursos.json:', err);
    }
    return [];
  };

  const writeCatalogoCursos = (cursos: string[]) => {
    try {
      fs.writeFileSync(catalogoCursosFile, JSON.stringify(cursos, null, 2), 'utf-8');
    } catch (err) {
      console.error('Erro ao escrever em catalogo_cursos.json:', err);
    }
  };

  app.use(express.json({ limit: '10mb' }));

  // Rota de verificação de integridade
  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // 1. Listar todos os colaboradores
  app.get('/api/colaboradores', (_req, res) => {
    const list = readColaboradores();
    res.json({ success: true, data: list });
  });

  // 2. Buscar colaborador por ID ou Matrícula (utilizado na leitura do QR Code)
  app.get('/api/colaboradores/:idOrMatricula', (req, res) => {
    const param = String(req.params.idOrMatricula || '').trim().toLowerCase();
    const cleanDigits = param.replace(/\D/g, '');

    const list = readColaboradores();
    const found = list.find((c) => {
      if (!c) return false;
      const cId = String(c.id || '').toLowerCase();
      const cMat = String(c.matricula || '').toLowerCase();
      const matchId = cId === param;
      const matchMat = cMat === param;
      const cDigits = String(c.matricula || '').replace(/\D/g, '');
      const matchDigits = cleanDigits.length > 0 && cDigits === cleanDigits;
      return matchId || matchMat || matchDigits;
    });

    if (!found) {
      return res.status(404).json({
        success: false,
        error: `Colaborador com identificação "${req.params.idOrMatricula}" não encontrado no servidor.`,
      });
    }

    return res.json({ success: true, data: found });
  });

  // 3. Salvar ou atualizar colaborador (upsert)
  app.post('/api/colaboradores', (req, res) => {
    const payload = req.body;
    if (!payload || !payload.nome || !payload.matricula) {
      return res.status(400).json({
        success: false,
        error: 'Dados obrigatórios ausentes (nome ou matrícula).',
      });
    }

    const list = readColaboradores();
    const id = payload.id || `vli-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
    const fullRecord = {
      ...payload,
      id,
      created_at: payload.created_at || new Date().toISOString(),
      treinamentos: Array.isArray(payload.treinamentos) ? payload.treinamentos : [],
    };

    const targetMat = String(payload.matricula).toLowerCase();
    const targetId = String(id).toLowerCase();

    const index = list.findIndex(
      (c) =>
        (c.id && String(c.id).toLowerCase() === targetId) ||
        (c.matricula && String(c.matricula).toLowerCase() === targetMat)
    );

    if (index >= 0) {
      list[index] = { ...list[index], ...fullRecord };
    } else {
      list.unshift(fullRecord);
    }

    writeColaboradores(list);
    return res.json({ success: true, data: fullRecord });
  });

  // 4. Sincronizar lote de colaboradores do navegador para o servidor
  app.post('/api/colaboradores/sync', (req, res) => {
    const { colaboradores } = req.body;
    if (!Array.isArray(colaboradores)) {
      return res.status(400).json({ success: false, error: 'Lista inválida.' });
    }

    const current = readColaboradores();
    const map = new Map<string, any>();

    const getSafeKey = (c: any, index: number) => {
      if (!c) return '';
      const mat = c.matricula !== undefined && c.matricula !== null ? String(c.matricula).trim().toLowerCase() : '';
      const id = c.id !== undefined && c.id !== null ? String(c.id).trim().toLowerCase() : '';
      return mat || id || `idx-${index}`;
    };

    // Colaboradores existentes no servidor
    current.forEach((c, idx) => {
      const key = getSafeKey(c, idx);
      if (key) {
        map.set(key, c);
      }
    });

    // Mesclar do navegador
    colaboradores.forEach((c, idx) => {
      const key = getSafeKey(c, idx);
      if (key) {
        if (!map.has(key)) {
          map.set(key, c);
        } else {
          const existing = map.get(key);
          const trainExisting = Array.isArray(existing.treinamentos) ? existing.treinamentos : [];
          const trainNew = Array.isArray(c.treinamentos) ? c.treinamentos : [];
          map.set(key, {
            ...existing,
            ...c,
            treinamentos: trainNew.length >= trainExisting.length ? trainNew : trainExisting,
          });
        }
      }
    });

    const merged = Array.from(map.values());
    writeColaboradores(merged);
    return res.json({ success: true, count: merged.length });
  });

  // 5. Excluir colaborador
  app.delete('/api/colaboradores/:id', (req, res) => {
    const id = req.params.id;
    const list = readColaboradores();
    const filtered = list.filter((c) => c.id !== id && c.matricula !== id);
    writeColaboradores(filtered);
    return res.json({ success: true });
  });

  // 6. Catálogo dinâmico de cursos adicionados
  app.get('/api/catalogo-cursos', (_req, res) => {
    const cursos = readCatalogoCursos();
    res.json({ success: true, data: cursos });
  });

  app.post('/api/catalogo-cursos', (req, res) => {
    const { nome_curso } = req.body;
    if (!nome_curso || typeof nome_curso !== 'string' || !nome_curso.trim()) {
      return res.status(400).json({ success: false, error: 'Nome do curso inválido.' });
    }

    const trimmed = nome_curso.trim();
    const cursos = readCatalogoCursos();
    const exists = cursos.some((c) => c.toLowerCase() === trimmed.toLowerCase());

    if (!exists) {
      cursos.push(trimmed);
      writeCatalogoCursos(cursos);
    }

    return res.json({ success: true, data: cursos });
  });

  app.delete('/api/catalogo-cursos/:nome', (req, res) => {
    const target = decodeURIComponent(req.params.nome || '').trim().toLowerCase();
    const cursos = readCatalogoCursos();
    const filtered = cursos.filter((c) => c.trim().toLowerCase() !== target);
    writeCatalogoCursos(filtered);
    return res.json({ success: true, data: filtered });
  });

  // 7. Rota para extração de dados do link do crachá da Universidade VLI (Webtraining)
  app.post('/api/extract-webtraining', async (req, res) => {
    try {
      const { url, htmlContent } = req.body;

      let html = '';

      if (url && typeof url === 'string') {
        let targetUrl = url.trim();
        // Correção de protocolo automática se o usuário colou sem http:// ou https://
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = 'https://' + targetUrl;
        }

        // Timeout estrito de 7s para evitar que o proxy Cloud Run / Nginx retorne 504 "A server error occurred"
        const abortController = new AbortController();
        const timeoutTimer = setTimeout(() => abortController.abort(), 7000);

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
          return res.status(200).json({
            success: false,
            blocked: true,
            error:
              'O servidor corporativo da Universidade VLI demorou para responder ou bloqueou o acesso externo direto (firewall corporativo). Utilize a opção de colar o código HTML da página abaixo.',
          });
        } finally {
          clearTimeout(timeoutTimer);
        }

        if (!fetchResponse.ok) {
          return res.status(200).json({
            success: false,
            blocked: true,
            error: `O servidor da Universidade VLI retornou status ${fetchResponse.status}: ${fetchResponse.statusText}. Abra o link no navegador e cole o código HTML da página.`,
          });
        }

        // Detecta se a página foi redirecionada para a tela de erro do Webtraining
        const finalUrl = fetchResponse.url || '';
        if (finalUrl.includes('erro.asp') || finalUrl.includes('errcode=')) {
          return res.status(200).json({
            success: false,
            blocked: true,
            error:
              'O crachá no Webtraining está expirado ou o link é inválido (erro de acesso no sistema da Universidade VLI). Abra o link no navegador e copie o código HTML da página.',
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
              'A Universidade VLI retornou "Erro Desconhecido" para este crachá (sessão expirada). Abra o crachá no navegador corporativo e cole o código HTML da página.',
          });
        }
      } else if (htmlContent && typeof htmlContent === 'string') {
        html = repairCorruptedText(htmlContent);
      } else {
        return res.status(200).json({
          success: false,
          error: 'É necessário fornecer uma URL ou o conteúdo HTML da página.',
        });
      }

      // Extração de Nome, Matrícula/ID e Cargo
      let nome = '';
      let matricula = '';
      let cargo = '';

      const nomeMatch =
        html.match(/<span>([A-ZÀ-Ú\s]{3,})<\/span>/i) ||
        html.match(/<h2[^>]*>Crach[áa]<\/h2>[\s\S]*?<span>([^<]+)<\/span>/i) ||
        html.match(/<strong>Crach[áa]<\/strong><\/h2>[\s\S]*?<p>[\s\S]*?<span>([^<]+)<\/span>/i);
      if (nomeMatch && nomeMatch[1]) {
        nome = repairCorruptedText(nomeMatch[1].trim());
      }

      const idMatch =
        html.match(/<span>ID:\s*([0-9A-Za-z\-_]+)<\/span>/i) ||
        html.match(/ID:\s*([0-9A-Za-z\-_]+)/i);
      if (idMatch && idMatch[1]) {
        matricula = idMatch[1].trim();
      }

      const cargoMatch =
        html.match(/<span>Cargo:\s*([^<]+)<\/span>/i) ||
        html.match(/Cargo:\s*([^<\n\r]+)/i);
      if (cargoMatch && cargoMatch[1]) {
        cargo = repairCorruptedText(cargoMatch[1].trim());
      }

      // Extração das Atividades / Cursos da tabela #tabelaCracha
      const cursos: Array<{
        nome_curso: string;
        categoria: string;
        vencimento_treinamento: string;
        vencimento_aso: string;
        status_webtraining: string;
        status: 'valido' | 'vencido';
        data_validade: string;
        origem: 'universidade_vli';
      }> = [];

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

          if (
            statusWeb.toLowerCase().includes('vencid') ||
            statusWeb.toLowerCase().includes('bloquead')
          ) {
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

      return res.json({
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
      console.error('Erro na extração do link Webtraining:', err);
      return res.status(500).json({
        success: false,
        error: `Falha ao processar o link: ${err.message || 'Erro interno'}`,
      });
    }
  });

  // Configuração do Vite middleware para desenvolvimento ou arquivos estáticos em produção
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Servidor VLI] Executando com sucesso em http://0.0.0.0:${PORT}`);
  });
}

startServer();
