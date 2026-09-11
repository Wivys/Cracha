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

      let pageContent = '';

      if (url && typeof url === 'string') {
        let targetUrl = url.trim();
        if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
          targetUrl = 'https://' + targetUrl;
        }

        // 1. Tentativa Direta (headers reais de navegador)
        let directSuccess = false;
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
              pageContent = html;
              directSuccess = true;
            }
          }
        } catch {
          // Direct fetch falhou ou timeout; aciona gateway alternativo
        }

        // 2. Gateway Jina Reader (bypassa firewalls de datacenter e renderiza páginas externas)
        if (!directSuccess) {
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
                pageContent = rawHtml;
                directSuccess = true;
              } else if (rawMarkdown && rawMarkdown.length > 100 && !rawMarkdown.includes('Erro Desconhecido')) {
                pageContent = rawMarkdown;
                directSuccess = true;
              }
            }
          } catch {
            // Falha no gateway Jina
          }
        }

        // 3. Gateway AllOrigins Proxy
        if (!directSuccess) {
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
                pageContent = json.contents;
                directSuccess = true;
              }
            }
          } catch {
            // Falha no proxy
          }
        }

        if (!pageContent) {
          return res.status(200).json({
            success: false,
            blocked: true,
            error: 'Não foi possível conectar ao servidor da Universidade VLI. Verifique se o link está ativo.',
          });
        }
      } else if (htmlContent && typeof htmlContent === 'string') {
        pageContent = repairCorruptedText(htmlContent);
      } else {
        return res.status(200).json({
          success: false,
          error: 'É necessário fornecer a URL do crachá da Universidade VLI.',
        });
      }

      // Extração de Nome, Matrícula/ID e Cargo
      let nome = '';
      let matricula = '';
      let cargo = '';

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

      const idMatch =
        pageContent.match(/<span>ID:\s*([0-9A-Za-z\-_]+)<\/span>/i) ||
        pageContent.match(/ID:\s*([0-9A-Za-z\-_]+)/i) ||
        pageContent.match(/Matr[íi]cula:\s*([0-9A-Za-z\-_]+)/i) ||
        pageContent.match(/\*\*Matr[íi]cula:\*\*\s*([0-9A-Za-z\-_]+)/i) ||
        pageContent.match(/\*\*ID:\*\*\s*([0-9A-Za-z\-_]+)/i);
      if (idMatch && idMatch[1]) {
        matricula = idMatch[1].replace(/Matr[íi]cula:\s*/i, '').replace(/ID:\s*/i, '').replace(/[*#]/g, '').trim();
      }

      const cargoMatch =
        pageContent.match(/<span>Cargo:\s*([^<]+)<\/span>/i) ||
        pageContent.match(/Cargo:\s*([^<\n\r]+)/i) ||
        pageContent.match(/\*\*Cargo:\*\*\s*([^\n\r]+)/i);
      if (cargoMatch && cargoMatch[1]) {
        cargo = repairCorruptedText(cargoMatch[1].replace(/Cargo:\s*/i, '').replace(/[*#]/g, '').trim());
      }

      // Extração das Atividades / Cursos da tabela
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

      // 4C. Fallback: texto corrido com datas dd/mm/aaaa
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
      return res.status(200).json({
        success: false,
        error: `Falha ao processar o link: ${err.message || 'Erro inesperado'}`,
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
