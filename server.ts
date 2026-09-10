import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

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
    const param = (req.params.idOrMatricula || '').trim().toLowerCase();
    const cleanDigits = param.replace(/\D/g, '');

    const list = readColaboradores();
    const found = list.find((c) => {
      if (!c) return false;
      const matchId = (c.id || '').toLowerCase() === param;
      const matchMat = (c.matricula || '').toLowerCase() === param;
      const cDigits = (c.matricula || '').replace(/\D/g, '');
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

    const index = list.findIndex(
      (c) =>
        (c.id && c.id === id) ||
        (c.matricula && c.matricula.toLowerCase() === payload.matricula.toLowerCase())
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

    // Colaboradores existentes no servidor
    for (const c of current) {
      if (c && c.matricula) {
        map.set(c.matricula.toLowerCase(), c);
      }
    }

    // Mesclar do navegador
    for (const c of colaboradores) {
      if (c && c.matricula) {
        const key = c.matricula.toLowerCase();
        if (!map.has(key)) {
          map.set(key, c);
        }
      }
    }

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

  // 7. Rota para extração de dados do link do crachá da Universidade VLI (Webtraining)
  app.post('/api/extract-webtraining', async (req, res) => {
    try {
      const { url, htmlContent } = req.body;

      let html = '';

      if (url && typeof url === 'string') {
        const targetUrl = url.trim();
        // Validação básica de URL
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          return res.status(400).json({
            success: false,
            error: 'URL inválida. A URL deve iniciar com http:// ou https://',
          });
        }

        const fetchResponse = await fetch(targetUrl, {
          headers: {
            'User-Agent':
              'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          },
        });

        if (!fetchResponse.ok) {
          return res.status(fetchResponse.status).json({
            success: false,
            error: `O servidor da Universidade VLI retornou status ${fetchResponse.status}: ${fetchResponse.statusText}`,
          });
        }

        const buffer = await fetchResponse.arrayBuffer();
        const decoderUtf8 = new TextDecoder('utf-8');
        let decodedText = decoderUtf8.decode(buffer);

        if (decodedText.includes('') || decodedText.includes('Crach')) {
          const decoderLatin = new TextDecoder('iso-8859-1');
          decodedText = decoderLatin.decode(buffer);
        }

        html = decodedText;
      } else if (htmlContent && typeof htmlContent === 'string') {
        html = htmlContent;
      } else {
        return res.status(400).json({
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
        nome = nomeMatch[1].trim();
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
        cargo = cargoMatch[1].trim();
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
