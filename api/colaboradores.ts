import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://geaypypffqpmynfxdaul.supabase.co';
const SUPABASE_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdlYXlweXBmZnFwbXluZnhkYXVsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg5MTc5NDcsImV4cCI6MjEwNDQ5Mzk0N30.v9ztxM67zF4nAVdHsUip2NoCstjKq5dPi3HsXWsq8og';

let supabaseClient: any = null;
function getClient() {
  if (!supabaseClient && SUPABASE_URL && SUPABASE_KEY) {
    try {
      supabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY);
    } catch (e) {
      console.warn('Erro ao inicializar Supabase no handler API:', e);
    }
  }
  return supabaseClient;
}

export default async function handler(req: any, res: any) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const supabase = getClient();

  // GET: Buscar colaborador por ID ou Matrícula
  if (req.method === 'GET') {
    const queryParam = (
      req.query?.idOrMatricula ||
      req.query?.matricula ||
      req.query?.id ||
      ''
    ).trim();

    if (queryParam && supabase) {
      try {
        const { data: func } = await supabase
          .from('funcionarios')
          .select('*')
          .or(`id.eq.${queryParam},matricula.ilike.${queryParam}`)
          .maybeSingle();

        if (func) {
          const { data: trainings } = await supabase
            .from('treinamentos')
            .select('*')
            .eq('funcionario_id', func.id);

          return res.status(200).json({
            success: true,
            data: {
              ...func,
              treinamentos: trainings || [],
            },
          });
        }
      } catch (err: any) {
        console.warn('Erro na busca Supabase:', err.message);
      }

      return res.status(404).json({
        success: false,
        error: `Colaborador "${queryParam}" não encontrado.`,
      });
    }

    // Se não passou query, lista todos
    if (supabase) {
      try {
        const { data: funcs } = await supabase.from('funcionarios').select('*');
        return res.status(200).json({ success: true, data: funcs || [] });
      } catch (err: any) {
        return res.status(500).json({ success: false, error: err.message });
      }
    }

    return res.status(200).json({ success: true, data: [] });
  }

  // POST: Salvar colaborador
  if (req.method === 'POST') {
    const body = req.body || {};
    if (body.nome && body.matricula && supabase) {
      try {
        const payload = {
          nome: body.nome.trim(),
          matricula: body.matricula.trim(),
          cargo: body.cargo || 'Operação Ferroviária & Logística',
          unidade: body.unidade || 'Corredor Centro-Leste',
          foto_url: body.foto_url || null,
          genero: body.genero || 'H',
        };

        const { data: existing } = await supabase
          .from('funcionarios')
          .select('id')
          .or(`matricula.ilike.${body.matricula}`)
          .maybeSingle();

        let funcId = existing?.id;
        if (funcId) {
          await supabase.from('funcionarios').update(payload).eq('id', funcId);
        } else {
          const { data: inserted } = await supabase.from('funcionarios').insert(payload).select('id').maybeSingle();
          funcId = inserted?.id || `vli-${body.matricula}`;
        }

        if (funcId && Array.isArray(body.treinamentos)) {
          await supabase.from('treinamentos').delete().eq('funcionario_id', funcId);
          if (body.treinamentos.length > 0) {
            const trns = body.treinamentos.map((t: any) => ({
              funcionario_id: funcId,
              nome_curso: t.nome_curso,
              data_validade: t.data_validade,
              status: t.status === 'vencido' ? 'vencido' : 'valido',
              carga_horaria: t.carga_horaria || '20h',
              origem: t.origem || 'manual',
              categoria: t.categoria || null,
            }));
            await supabase.from('treinamentos').insert(trns);
          }
        }

        return res.status(200).json({ success: true, id: funcId });
      } catch (err: any) {
        console.warn('Erro ao salvar no Supabase via API:', err.message);
      }
    }

    return res.status(200).json({ success: true, received: true });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
