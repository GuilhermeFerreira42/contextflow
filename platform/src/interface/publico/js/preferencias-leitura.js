/**
 * Preferências de leitura persistidas.
 *
 * A Biblioteca e o painel de leitura mostram o mesmo resumo e a mesma
 * transcrição, mas são módulos separados. Se cada um escrevesse no
 * `localStorage` por conta própria, o último a salvar apagaria os campos do
 * outro — foi por isso que "mostrar tempos"/"texto corrido" não sobreviviam a
 * fechar o painel.
 *
 * Aqui há **um** registro e uma regra: ler, mesclar e gravar. Nada de
 * `localStorage` espalhado pelos módulos.
 *
 * A chave é a que já existia (`contextflow.biblioteca.visual`). Campos novos
 * entram como adição opcional e objetos antigos continuam válidos: o que falta
 * recebe o padrão.
 */

export const CHAVE_VISUAL = 'contextflow.biblioteca.visual';

/**
 * Apresentação da transcrição.
 *
 * Os padrões reproduzem o comportamento anterior: com tempos e sem texto
 * corrido. Quem nunca salvou nada vê exatamente o que via antes.
 */
export const LEITURA_PADRAO = Object.freeze({
  mostrarTempos: true,
  textoCorrido: false,
});

export const FONTE_RESUMO = Object.freeze({
  minima: 11,
  maxima: 20,
  padrao: 13,
  passo: 1,
});

function lerTexto(chave) {
  try {
    return localStorage.getItem(chave);
  } catch {
    // Modo privado / armazenamento bloqueado: a preferência vale para esta
    // sessão, mas não persiste. Não é motivo para quebrar a tela.
    return null;
  }
}

function gravarTexto(chave, valor) {
  try {
    localStorage.setItem(chave, valor);
    return true;
  } catch {
    return false;
  }
}

/** Objeto visual inteiro, ou `{}` quando ausente/ilegível. */
export function lerVisual() {
  try {
    const bruto = JSON.parse(lerTexto(CHAVE_VISUAL) ?? 'null');
    return bruto && typeof bruto === 'object' ? bruto : {};
  } catch {
    return {};
  }
}

/**
 * Mescla `campos` no objeto já salvo e grava.
 *
 * Mescla em vez de substituir porque os dois módulos são donos de partes
 * diferentes do mesmo objeto. Gravar um subconjunto apagaria o resto.
 *
 * Devolve `true` se conseguiu persistir.
 */
export function mesclarVisual(campos) {
  const atual = lerVisual();
  return gravarTexto(CHAVE_VISUAL, JSON.stringify({ ...atual, ...campos }));
}

/** Só a apresentação da transcrição, já validada. */
export function lerLeitura() {
  const bruto = lerVisual().leitura;
  const leitura = { ...LEITURA_PADRAO };
  if (!bruto || typeof bruto !== 'object') return leitura;
  if (typeof bruto.mostrarTempos === 'boolean') leitura.mostrarTempos = bruto.mostrarTempos;
  if (typeof bruto.textoCorrido === 'boolean') leitura.textoCorrido = bruto.textoCorrido;
  return leitura;
}

export function salvarLeitura(leitura) {
  return mesclarVisual({
    leitura: {
      mostrarTempos: leitura.mostrarTempos !== false,
      textoCorrido: leitura.textoCorrido === true,
    },
  });
}

/** Fonte do resumo, dentro dos limites, ou o padrão. */
export function lerFonteResumo() {
  const bruto = lerVisual().fonteResumo;
  // `Number(null)` é 0, não NaN: sem esta guarda, um valor nulo gravado por
  // engano viraria o mínimo (11px) em vez do padrão. Aceitamos só número.
  if (typeof bruto !== 'number') return FONTE_RESUMO.padrao;
  if (!Number.isFinite(bruto)) return FONTE_RESUMO.padrao;
  return Math.min(FONTE_RESUMO.maxima, Math.max(FONTE_RESUMO.minima, Math.round(bruto)));
}

export function salvarFonteResumo(px) {
  return mesclarVisual({ fonteResumo: px });
}
