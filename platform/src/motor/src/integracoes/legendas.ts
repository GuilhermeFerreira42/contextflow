/**
 * Normalização de legendas do YouTube para segmentos com tempo.
 *
 * Duas entradas possíveis:
 *  - VTT (formato de texto do YouTube, inclui o efeito de rolagem das legendas
 *    automáticas, em que cada bloco repete o texto do anterior);
 *  - JSON3 (formato estruturado, com tempos em milissegundos).
 *
 * Regra de ouro: o texto gravado é o que o usuário lê. Nada de tags, entidades
 * cruas, blocos NOTE/STYLE ou repetição de rolagem.
 */
import type { SegmentoTranscricao } from '@contextflow/compartilhado';

// ------------------------------------------------------------------ entidades --

const ENTIDADES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
  '&#39;': "'",
  '&nbsp;': ' ',
  '&lrm;': '',
  '&rlm;': '',
};

function decodificarEntidades(texto: string): string {
  let resultado = texto;
  for (const [entidade, valor] of Object.entries(ENTIDADES)) {
    resultado = resultado.split(entidade).join(valor);
  }
  // Numéricas: &#123; e &#x1F600;
  resultado = resultado.replace(/&#(\d+);/g, (_, codigo: string) =>
    String.fromCodePoint(Number.parseInt(codigo, 10)),
  );
  resultado = resultado.replace(/&#[xX]([0-9a-fA-F]+);/g, (_, codigo: string) =>
    String.fromCodePoint(Number.parseInt(codigo, 16)),
  );
  return resultado;
}

/** Remove tags de estilo/tempo do YouTube (`<c>`, `<00:00:01.234>`, `<v Nome>`). */
function removerTags(texto: string): string {
  return texto.replace(/<[^>]*>/g, '');
}

function limparTexto(bruto: string): string {
  return decodificarEntidades(removerTags(bruto)).replace(/\s+/g, ' ').trim();
}

// ----------------------------------------------------------------------- VTT --

interface BlocoVtt {
  inicioMs: number;
  fimMs: number;
  texto: string;
}

/** Converte `01:02:03.456` / `02:03.456` / `03.456` (ou com vírgula) em ms. */
export function tempoParaMs(tempo: string): number | null {
  const partes = tempo.trim().replace(',', '.').split(':');
  if (partes.length === 0 || partes.length > 3) return null;

  const numeros: number[] = [];
  for (const parte of partes) {
    if (!/^\d+(\.\d+)?$/.test(parte)) return null;
    numeros.push(Number.parseFloat(parte));
  }

  let segundos = 0;
  if (numeros.length === 3) {
    segundos = numeros[0]! * 3600 + numeros[1]! * 60 + numeros[2]!;
  } else if (numeros.length === 2) {
    segundos = numeros[0]! * 60 + numeros[1]!;
  } else {
    segundos = numeros[0]!;
  }
  return Math.round(segundos * 1000);
}

const LINHA_TEMPO = /^(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})\s*-->\s*(?:(\d{1,3}):)?(\d{1,2}):(\d{1,2})[.,](\d{1,3})/;

function lerLinhaTempo(linha: string): { inicioMs: number; fimMs: number } | null {
  const achado = LINHA_TEMPO.exec(linha);
  if (!achado) return null;

  const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = achado;
  const fracao1 = (ms1 ?? '0').padEnd(3, '0');
  const fracao2 = (ms2 ?? '0').padEnd(3, '0');
  const inicio =
    (Number(h1 ?? 0) * 3600 + Number(m1 ?? 0) * 60 + Number(s1 ?? 0)) * 1000 +
    Number(fracao1);
  const fim =
    (Number(h2 ?? 0) * 3600 + Number(m2 ?? 0) * 60 + Number(s2 ?? 0)) * 1000 +
    Number(fracao2);
  return { inicioMs: inicio, fimMs: Math.max(inicio, fim) };
}

/**
 * Lê um VTT em blocos crus. Não deduplica rolagem ainda: essa etapa é separada,
 * porque a regra depende de comparar cada bloco com o anterior.
 */
export function lerBlocosVtt(conteudo: string): BlocoVtt[] {
  const linhas = conteudo.replace(/\r\n?/g, '\n').split('\n');
  const blocos: BlocoVtt[] = [];

  let i = 0;
  while (i < linhas.length) {
    const linha = linhas[i]!;

    // Cabeçalho e metadados que não geram texto
    if (
      /^WEBVTT/.test(linha) ||
      /^NOTE\b/.test(linha) ||
      /^STYLE\b/.test(linha) ||
      /^REGION\b/.test(linha) ||
      linha.trim() === ''
    ) {
      i += 1;
      continue;
    }

    const tempo = lerLinhaTempo(linha);
    if (!tempo) {
      i += 1;
      continue;
    }

    i += 1;
    const texto: string[] = [];
    while (i < linhas.length && linhas[i]!.trim() !== '') {
      texto.push(linhas[i]!);
      i += 1;
    }

    const limpo = limparTexto(texto.join(' '));
    if (limpo.length > 0) {
      blocos.push({ ...tempo, texto: limpo });
    }
  }

  return blocos;
}

// --------------------------------------------------------------------- JSON3 --

interface EventoJson3 {
  tStartMs?: number;
  dDurationMs?: number;
  segs?: Array<{ utf8?: string }>;
}

export function lerBlocosJson3(conteudo: string): BlocoVtt[] {
  let dados: { events?: EventoJson3[] };
  try {
    dados = JSON.parse(conteudo) as { events?: EventoJson3[] };
  } catch {
    return [];
  }
  if (!Array.isArray(dados.events)) return [];

  const blocos: BlocoVtt[] = [];
  for (const evento of dados.events) {
    if (!Array.isArray(evento.segs)) continue;
    const inicioMs = typeof evento.tStartMs === 'number' ? evento.tStartMs : null;
    if (inicioMs === null) continue;

    const texto = limparTexto(evento.segs.map((s) => s.utf8 ?? '').join(''));
    if (texto.length === 0) continue;

    const duracao = typeof evento.dDurationMs === 'number' ? evento.dDurationMs : 0;
    blocos.push({ inicioMs, fimMs: inicioMs + Math.max(0, duracao), texto });
  }
  return blocos;
}

// ---------------------------------------------------------------- rolagem ----

/**
 * Remove a repetição de rolagem das legendas automáticas.
 *
 * O YouTube escreve, em cada bloco, a linha anterior inteira seguida da nova.
 * Se o texto atual começa com o texto anterior (e continua), guardamos só a
 * parte nova. Blocos que ficam vazios são descartados.
 */
export function removerRolagem(blocos: BlocoVtt[]): BlocoVtt[] {
  const resultado: BlocoVtt[] = [];
  // A comparação é sempre contra o texto CRU do bloco anterior, não contra o
  // texto já recortado. Numa rolagem de três níveis ("a" → "a b" → "a b c"),
  // comparar com o resultado daria "a b c", que não começa com "b".
  let textoAnteriorCru: string | null = null;
  let indiceAnterior: number | null = null;

  for (const bloco of blocos) {
    if (textoAnteriorCru !== null && bloco.texto === textoAnteriorCru) {
      // Mesmo conteúdo repetido: só estende o fim do segmento já gravado.
      const anterior = indiceAnterior !== null ? resultado[indiceAnterior] : undefined;
      if (anterior) anterior.fimMs = Math.max(anterior.fimMs, bloco.fimMs);
      continue;
    }

    if (textoAnteriorCru !== null && bloco.texto.startsWith(textoAnteriorCru)) {
      const novo = bloco.texto.slice(textoAnteriorCru.length).trim();
      if (novo.length === 0) {
        textoAnteriorCru = bloco.texto;
        continue;
      }
      resultado.push({ ...bloco, texto: novo });
      textoAnteriorCru = bloco.texto;
      indiceAnterior = resultado.length - 1;
      continue;
    }

    resultado.push({ ...bloco });
    textoAnteriorCru = bloco.texto;
    indiceAnterior = resultado.length - 1;
  }

  return resultado;
}

// -------------------------------------------------------------------- final --

/** Funde blocos encostados com texto igual e ordena por tempo. */
function consolidar(blocos: BlocoVtt[]): SegmentoTranscricao[] {
  const ordenados = [...blocos].sort((a, b) => a.inicioMs - b.inicioMs || a.fimMs - b.fimMs);
  const resultado: SegmentoTranscricao[] = [];

  for (const bloco of ordenados) {
    const anterior = resultado.at(-1);
    if (anterior && anterior.texto === bloco.texto && bloco.inicioMs - anterior.fimMs <= 400) {
      anterior.fimMs = Math.max(anterior.fimMs, bloco.fimMs);
      continue;
    }
    resultado.push({
      inicioMs: bloco.inicioMs,
      fimMs: Math.max(bloco.inicioMs, bloco.fimMs),
      texto: bloco.texto,
    });
  }

  // Nunca deixar o fim "atravessar" o início do próximo: a leitura fica estranha
  for (let i = 0; i < resultado.length - 1; i += 1) {
    const atual = resultado[i]!;
    const proximo = resultado[i + 1]!;
    if (atual.fimMs > proximo.inicioMs) {
      atual.fimMs = Math.max(atual.inicioMs, proximo.inicioMs);
    }
  }

  return resultado;
}

/** Ponto de entrada: recebe o conteúdo cru da legenda e devolve os segmentos. */
export function normalizarLegenda(
  conteudo: string,
  formato: 'vtt' | 'json3',
): SegmentoTranscricao[] {
  const blocos = formato === 'json3' ? lerBlocosJson3(conteudo) : lerBlocosVtt(conteudo);
  return consolidar(removerRolagem(blocos));
}
