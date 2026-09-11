/**
 * Utilitário para correção e sanitização de codificação de texto (Encoding/Mojibake)
 * Resolve erros de caracteres corrompidos (ex: "reas Classificadas Intermedirio" -> "Áreas Classificadas Intermediário")
 * decorrentes de páginas legado da Universidade VLI codificadas em ISO-8859-1 / Windows-1252.
 */

// Mapeamento de termos e expressões comuns em treinamentos ferroviários VLI
const KNOWN_REPLACEMENTS: [RegExp, string][] = [
  // Específico para o erro reportado: "reas Classificadas Intermedirio"
  [/\uFFFDreas\s+Classificadas\s+Intermedi\uFFFDrio/gi, 'Áreas Classificadas Intermediário'],
  [/\uFFFDreas\s+Classificadas/gi, 'Áreas Classificadas'],
  [/Intermedi\uFFFDrio/gi, 'Intermediário'],
  [/Intermedi\uFFFDrigo/gi, 'Intermediário'],
  [/B\uFFFDsico/gi, 'Básico'],
  [/Avan\uFFFDado/gi, 'Avançado'],
  [/Avan\uFFFDada/gi, 'Avançada'],
  [/Seguran\uFFFDca/gi, 'Segurança'],
  [/Seguran\uFFFDa/gi, 'Segurança'],
  [/Eletricit\uFFFDrio/gi, 'Eletricitário'],
  [/Eletricit\uFFFDria/gi, 'Eletricitária'],
  [/Ferrovi\uFFFDrio/gi, 'Ferroviário'],
  [/Ferrovi\uFFFDria/gi, 'Ferroviária'],
  [/Espa\uFFFDos\s+Confinados/gi, 'Espaços Confinados'],
  [/Espa\uFFFDo/gi, 'Espaço'],
  [/Ve\uFFFDculos/gi, 'Veículos'],
  [/Ve\uFFFDculo/gi, 'Veículo'],
  [/M\uFFFDquinas/gi, 'Máquinas'],
  [/M\uFFFDquina/gi, 'Máquina'],
  [/N\uFFFDvel/gi, 'Nível'],
  [/Inc\uFFFDndio/gi, 'Incêndio'],
  [/Inc\uFFFDndios/gi, 'Incêndios'],
  [/Ambi\uFFFDncia/gi, 'Ambiência'],
  [/Hor\uFFFDria/gi, 'Horária'],
  [/Hor\uFFFDrio/gi, 'Horário'],
  [/Subterr\uFFFDneo/gi, 'Subterrâneo'],
  [/Qu\uFFFDmicos/gi, 'Químicos'],
  [/Qu\uFFFDmico/gi, 'Químico'],
  [/Biol\uFFFDgicos/gi, 'Biológicos'],
  [/Biol\uFFFDgico/gi, 'Biológico'],
  [/Radia\uFFFD\uFFFDes/gi, 'Radiações'],
  [/Radia\uFFFDes/gi, 'Radiações'],
  [/Radia\uFFFD\uFFFDo/gi, 'Radiação'],
  [/Radia\uFFFDo/gi, 'Radiação'],
  [/Crach\uFFFD/gi, 'Crachá'],
  [/N\uFFFDo\s+aplic\uFFFDvel/gi, 'Não aplicável'],
  [/N\uFFFDo/gi, 'Não'],
  [/aplic\uFFFDvel/gi, 'aplicável'],
  [/Instala\uFFFD\uFFFDes/gi, 'Instalações'],
  [/Instala\uFFFDes/gi, 'Instalações'],
  [/Instala\uFFFD\uFFFDo/gi, 'Instalação'],
  [/Instala\uFFFDo/gi, 'Instalação'],
  [/Opera\uFFFD\uFFFDes/gi, 'Operações'],
  [/Opera\uFFFDes/gi, 'Operações'],
  [/Opera\uFFFD\uFFFDo/gi, 'Operação'],
  [/Opera\uFFFDo/gi, 'Operação'],
  [/Prote\uFFFD\uFFFDo/gi, 'Proteção'],
  [/Prote\uFFFDo/gi, 'Proteção'],
  [/Preven\uFFFD\uFFFDo/gi, 'Prevenção'],
  [/Preven\uFFFDo/gi, 'Prevenção'],
  [/Dire\uFFFD\uFFFDo/gi, 'Direção'],
  [/Dire\uFFFDo/gi, 'Direção'],
  [/Movimenta\uFFFD\uFFFDo/gi, 'Movimentação'],
  [/Movimenta\uFFFDo/gi, 'Movimentação'],
  [/Forma\uFFFD\uFFFDo/gi, 'Formação'],
  [/Forma\uFFFDo/gi, 'Formação'],
  [/Atualiza\uFFFD\uFFFDo/gi, 'Atualização'],
  [/Atualiza\uFFFDo/gi, 'Atualização'],
  [/Subesta\uFFFD\uFFFDes/gi, 'Subestações'],
  [/Subesta\uFFFDes/gi, 'Subestações'],
  [/Sinaliza\uFFFD\uFFFDo/gi, 'Sinalização'],
  [/Sinaliza\uFFFDo/gi, 'Sinalização'],
  [/Capacita\uFFFD\uFFFDo/gi, 'Capacitação'],
  [/Capacita\uFFFDo/gi, 'Capacitação'],
  [/Qualifica\uFFFD\uFFFDo/gi, 'Qualificação'],
  [/Qualifica\uFFFDo/gi, 'Qualificação'],
  [/Comunica\uFFFD\uFFFDo/gi, 'Comunicação'],
  [/Comunica\uFFFDo/gi, 'Comunicação'],
  [/Observa\uFFFD\uFFFDo/gi, 'Observação'],
  [/Observa\uFFFDo/gi, 'Observação'],
  [/Locomo\uFFFD\uFFFDo/gi, 'Locomoção'],
  [/Locomo\uFFFDo/gi, 'Locomoção'],
  [/Manuten\uFFFD\uFFFDo/gi, 'Manutenção'],
  [/Manuten\uFFFDo/gi, 'Manutenção'],
  [/Combust\uFFFDvel/gi, 'Combustível'],
  [/Combust\uFFFDveis/gi, 'Combustíveis'],
  [/Inflam\uFFFDveis/gi, 'Inflamáveis'],
  [/Inflam\uFFFDvel/gi, 'Inflamável'],
  [/Defensiv\uFFFDo/gi, 'Defensiva'],
  [/Pr\uFFFDtico/gi, 'Prático'],
  [/Pr\uFFFDtica/gi, 'Prática'],
  [/Te\uFFFDrico/gi, 'Teórico'],
  [/Te\uFFFDrica/gi, 'Teórica'],
  [/V\uFFFDlido/gi, 'Válido'],
  [/V\uFFFDlida/gi, 'Válida'],
  [/Per\uFFFDodo/gi, 'Período'],
  [/Matr\uFFFDcula/gi, 'Matrícula'],
  [/Relat\uFFFDrio/gi, 'Relatório'],
  [/Condi\uFFFD\uFFFDes/gi, 'Condições'],
  [/Fun\uFFFD\uFFFDo/gi, 'Função'],
  [/A\uFFFD\uFFFDo/gi, 'Ação'],
  [/A\uFFFDes/gi, 'Ações'],

  // Mojibake duplo UTF-8 clássico (ex: Ã¡ em vez de á)
  [/Ã¡/g, 'á'],
  [/Ã©/g, 'é'],
  [/Ã­/g, 'í'],
  [/Ã³/g, 'ó'],
  [/Ãº/g, 'ú'],
  [/Ã£/g, 'ã'],
  [/Ãµ/g, 'õ'],
  [/Ã§/g, 'ç'],
  [/Ã /g, 'à'],
  [/Ã¢/g, 'â'],
  [/Ãª/g, 'ê'],
  [/Ã´/g, 'ô'],
  [/Ã/g, 'Á'],
  [/Ã‰/g, 'É'],
  [/Ã/g, 'Í'],
  [/Ã“/g, 'Ó'],
  [/Ãš/g, 'Ú'],
  [/Ãƒ/g, 'Ã'],
  [/Ã•/g, 'Õ'],
  [/Ã‡/g, 'Ç'],
  [/Ã‚/g, 'Â'],
  [/ÃŠ/g, 'Ê'],
  [/Ã”/g, 'Ô'],

  // Padrões genéricos de terminação com caractere de substituição
  [/([a-zA-Z])\uFFFD\uFFFDes\b/g, '$1ções'],
  [/([a-zA-Z])\uFFFDes\b/g, '$1ções'],
  [/([a-zA-Z])\uFFFD\uFFFDo\b/g, '$1ção'],
  [/([a-zA-Z])\uFFFDo\b/g, '$1ção'],
  [/([a-zA-Z])\uFFFDrio\b/g, '$1ário'],
  [/([a-zA-Z])\uFFFDria\b/g, '$1ária'],
  [/([a-zA-Z])\uFFFDvel\b/g, '$1ável'],
  [/([a-zA-Z])\uFFFDa\b/g, '$1ça'],
];

/**
 * Corrige uma string com caracteres corrompidos
 */
export function repairCorruptedText(input: string | null | undefined): string {
  if (!input || typeof input !== 'string') return '';

  let text = input;

  for (const [pattern, replacement] of KNOWN_REPLACEMENTS) {
    text = text.replace(pattern, replacement);
  }

  // Remove caracteres de substituição isolados restantes caso existam
  if (text.includes('\uFFFD')) {
    text = text.replace(/\uFFFD/g, '');
  }

  return text;
}

/**
 * Decodifica um buffer binário HTML detectando automaticamente ISO-8859-1 / Windows-1252 vs UTF-8
 */
export function decodeHtmlBuffer(buffer: ArrayBuffer, contentTypeHeader?: string): string {
  const bytes = new Uint8Array(buffer);

  // 1. Verificar indicação no cabeçalho Content-Type
  const ct = (contentTypeHeader || '').toLowerCase();
  const isExplicitIso =
    ct.includes('iso-8859') ||
    ct.includes('windows-1252') ||
    ct.includes('latin1') ||
    ct.includes('cp1252');

  // 2. Decodificar inicialmente com Windows-1252 se indicado explicitamente
  if (isExplicitIso) {
    try {
      const winDecoder = new TextDecoder('windows-1252');
      return repairCorruptedText(winDecoder.decode(bytes));
    } catch {
      // continua para fallback
    }
  }

  // 3. Tentar UTF-8 estrito
  let html = '';
  let utf8Success = false;
  try {
    const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
    html = utf8Decoder.decode(bytes);
    utf8Success = true;
  } catch {
    utf8Success = false;
  }

  // 4. Se falhou no UTF-8 estrito OU o resultado contiver replacement character (\uFFFD) ou tags de charset ISO
  const hasMetaIso = /charset\s*=\s*["']?(iso-8859-1|windows-1252|latin1)/i.test(html);
  const hasReplacementChar = html.includes('\uFFFD');

  if (!utf8Success || hasMetaIso || hasReplacementChar) {
    try {
      const winDecoder = new TextDecoder('windows-1252');
      html = winDecoder.decode(bytes);
    } catch {
      try {
        const latin1Decoder = new TextDecoder('iso-8859-1');
        html = latin1Decoder.decode(bytes);
      } catch {
        const utf8Fallback = new TextDecoder('utf-8', { fatal: false });
        html = utf8Fallback.decode(bytes);
      }
    }
  }

  return repairCorruptedText(html);
}

/**
 * Repara campos de texto em um objeto de curso
 */
export function repairCourseObject<T extends Record<string, any>>(curso: T): T {
  if (!curso) return curso;
  return {
    ...curso,
    nome_curso: repairCorruptedText(curso.nome_curso),
    categoria: repairCorruptedText(curso.categoria),
    vencimento_treinamento: repairCorruptedText(curso.vencimento_treinamento),
    vencimento_aso: repairCorruptedText(curso.vencimento_aso),
    status_webtraining: repairCorruptedText(curso.status_webtraining),
  };
}

/**
 * Repara campos de texto em um objeto de colaborador completo
 */
export function repairFuncionarioObject<T extends Record<string, any>>(func: T): T {
  if (!func) return func;
  const repaired: any = {
    ...func,
    nome: repairCorruptedText(func.nome),
    cargo: repairCorruptedText(func.cargo),
    empresa: repairCorruptedText(func.empresa),
    gerencia: repairCorruptedText(func.gerencia),
    area: repairCorruptedText(func.area),
    local: repairCorruptedText(func.local),
  };

  if (Array.isArray(repaired.treinamentos)) {
    repaired.treinamentos = repaired.treinamentos.map(repairCourseObject);
  }

  return repaired as T;
}
