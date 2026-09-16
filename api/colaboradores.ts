import fs from 'fs';
import path from 'path';

// Em ambientes serverless (Vercel), /tmp é gravável
const TMP_FILE = path.join('/tmp', 'vli_colaboradores.json');

// Memória em cache para instâncias ativas
let memoryCache: any[] = [];

function readStore(): any[] {
  try {
    if (fs.existsSync(TMP_FILE)) {
      const content = fs.readFileSync(TMP_FILE, 'utf-8');
      const parsed = JSON.parse(content);
      if (Array.isArray(parsed) && parsed.length > 0) {
        memoryCache = parsed;
        return parsed;
      }
    }
  } catch (e) {
    console.warn('Aviso ao ler /tmp/vli_colaboradores.json:', e);
  }
  return memoryCache;
}

function writeStore(data: any[]): void {
  try {
    memoryCache = data;
    fs.writeFileSync(TMP_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.warn('Aviso ao gravar em /tmp/vli_colaboradores.json:', e);
  }
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const currentList = readStore();

  // GET: Listar ou buscar por id / matricula
  if (req.method === 'GET') {
    const queryParam = (
      req.query?.idOrMatricula ||
      req.query?.matricula ||
      req.query?.id ||
      ''
    ).trim().toLowerCase();

    if (queryParam) {
      const cleanDigits = queryParam.replace(/\D/g, '');
      const found = currentList.find((c: any) => {
        if (!c) return false;
        const cId = String(c.id || '').toLowerCase();
        const cMat = String(c.matricula || '').toLowerCase();
        const cDigits = cMat.replace(/\D/g, '');
        return (
          cId === queryParam ||
          cMat === queryParam ||
          (cleanDigits.length > 0 && cDigits === cleanDigits)
        );
      });

      if (found) {
        return res.status(200).json({ success: true, data: found });
      }

      return res.status(404).json({
        success: false,
        error: `Colaborador com identificação "${queryParam}" não encontrado no servidor.`,
      });
    }

    return res.status(200).json({ success: true, data: currentList });
  }

  // POST: Salvar ou sincronizar colaboradores
  if (req.method === 'POST') {
    const body = req.body || {};

    // 1. Sincronização em lote
    if (Array.isArray(body.colaboradores)) {
      const map = new Map<string, any>();
      currentList.forEach((c) => {
        const key = String(c.matricula || c.id || '').toLowerCase();
        if (key) map.set(key, c);
      });

      body.colaboradores.forEach((c: any) => {
        const key = String(c.matricula || c.id || '').toLowerCase();
        if (key) {
          const existing = map.get(key);
          map.set(key, { ...existing, ...c });
        }
      });

      const updated = Array.from(map.values());
      writeStore(updated);
      return res.status(200).json({ success: true, count: updated.length, data: updated });
    }

    // 2. Colaborador único
    if (body.nome && body.matricula) {
      const id = body.id || `vli-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 6)}`;
      const fullRecord = {
        ...body,
        id,
        created_at: body.created_at || new Date().toISOString(),
        treinamentos: Array.isArray(body.treinamentos) ? body.treinamentos : [],
      };

      const targetMat = String(body.matricula).toLowerCase();
      const targetId = String(id).toLowerCase();

      const index = currentList.findIndex(
        (c: any) =>
          (c.id && String(c.id).toLowerCase() === targetId) ||
          (c.matricula && String(c.matricula).toLowerCase() === targetMat)
      );

      let updatedList: any[];
      if (index >= 0) {
        updatedList = [...currentList];
        updatedList[index] = { ...updatedList[index], ...fullRecord };
      } else {
        updatedList = [fullRecord, ...currentList];
      }

      writeStore(updatedList);
      return res.status(200).json({ success: true, data: fullRecord });
    }

    return res.status(400).json({
      success: false,
      error: 'Formato de dados inválido para salvar colaborador.',
    });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
