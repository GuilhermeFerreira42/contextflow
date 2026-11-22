/**
 * Preferências de leitura.
 *
 * A Biblioteca e o painel gravam no MESMO objeto do `localStorage`. O defeito
 * que originou este módulo foi justamente de sobrescrita: quem salvava por
 * último apagava os campos do outro, e "mostrar tempos"/"texto corrido"
 * voltavam ao padrão ao reabrir o painel.
 */
import assert from 'node:assert/strict';
import { beforeEach, test } from 'node:test';

/** `localStorage` mínimo em memória. */
class ArmazenamentoFalso {
  mapa = new Map<string, string>();
  getItem(chave: string) { return this.mapa.get(chave) ?? null; }
  setItem(chave: string, valor: string) { this.mapa.set(chave, String(valor)); }
  removeItem(chave: string) { this.mapa.delete(chave); }
  limpar() { this.mapa.clear(); }
}

const armazenamento = new ArmazenamentoFalso();
(globalThis as Record<string, unknown>).localStorage = armazenamento;

const {
  CHAVE_VISUAL, FONTE_RESUMO, LEITURA_PADRAO, lerFonteResumo, lerLeitura, lerVisual,
  mesclarVisual, salvarFonteResumo, salvarLeitura,
} = await import('../../src/interface/publico/js/preferencias-leitura.js');

const gravar = (valor: unknown) => armazenamento.setItem(CHAVE_VISUAL, JSON.stringify(valor));
const bruto = () => JSON.parse(armazenamento.getItem(CHAVE_VISUAL) ?? 'null');

beforeEach(() => armazenamento.limpar());

test('sem nada salvo, os padrões são os mesmos do comportamento anterior', () => {
  assert.deepEqual(lerLeitura(), { mostrarTempos: true, textoCorrido: false });
  assert.equal(lerFonteResumo(), 13);
  assert.deepEqual(lerVisual(), {});
});

test('apresentação da transcrição grava e relê', () => {
  salvarLeitura({ mostrarTempos: false, textoCorrido: true });
  assert.deepEqual(lerLeitura(), { mostrarTempos: false, textoCorrido: true });
});

test('objeto de preferências de versão anterior continua válido', () => {
  // Formato de antes desta rodada: só modo/colunas/larguras.
  gravar({ modo: 'compacto', colunas: { canal: false }, larguras: { titulo: 300 } });
  assert.deepEqual(lerLeitura(), LEITURA_PADRAO);
  assert.equal(lerFonteResumo(), 13);
  assert.equal(lerVisual().modo, 'compacto');
});

test('salvar a leitura não apaga modo, colunas nem larguras', () => {
  gravar({ modo: 'compacto', colunas: { canal: false }, larguras: { titulo: 300 } });
  salvarLeitura({ mostrarTempos: false, textoCorrido: true });
  const salvo = bruto();
  assert.equal(salvo.modo, 'compacto');
  assert.deepEqual(salvo.colunas, { canal: false });
  assert.deepEqual(salvo.larguras, { titulo: 300 });
  assert.deepEqual(salvo.leitura, { mostrarTempos: false, textoCorrido: true });
});

test('salvar a fonte não apaga a apresentação (o bug do "último a salvar vence")', () => {
  salvarLeitura({ mostrarTempos: false, textoCorrido: true });
  salvarFonteResumo(17);
  const salvo = bruto();
  assert.equal(salvo.fonteResumo, 17);
  assert.deepEqual(salvo.leitura, { mostrarTempos: false, textoCorrido: true });
  assert.equal(lerFonteResumo(), 17);
});

test('ordem inversa também preserva', () => {
  salvarFonteResumo(15);
  salvarLeitura({ mostrarTempos: true, textoCorrido: true });
  assert.equal(bruto().fonteResumo, 15);
  assert.equal(bruto().leitura.textoCorrido, true);
});

test('fonte fora dos limites é presa ao intervalo (nunca confia no armazenado)', () => {
  for (const [entrada, esperado] of [[5, FONTE_RESUMO.minima], [99, FONTE_RESUMO.maxima],
    [13.4, 13], [Number.NaN, 13], ['abc', 13], [null, 13]] as [unknown, number][]) {
    gravar({ fonteResumo: entrada });
    assert.equal(lerFonteResumo(), esperado, `entrada ${String(entrada)}`);
  }
});

test('valores não booleanos na leitura caem no padrão', () => {
  gravar({ leitura: { mostrarTempos: 'sim', textoCorrido: 1 } });
  assert.deepEqual(lerLeitura(), LEITURA_PADRAO);
  gravar({ leitura: { mostrarTempos: false } });
  assert.deepEqual(lerLeitura(), { mostrarTempos: false, textoCorrido: false });
});

test('JSON corrompido não derruba a interface', () => {
  armazenamento.setItem(CHAVE_VISUAL, '{isto não é json');
  assert.deepEqual(lerVisual(), {});
  assert.deepEqual(lerLeitura(), LEITURA_PADRAO);
  assert.equal(lerFonteResumo(), FONTE_RESUMO.padrao);
  // E ainda é possível salvar por cima.
  assert.equal(salvarFonteResumo(16), true);
  assert.equal(lerFonteResumo(), 16);
});

test('armazenamento indisponível devolve padrão em vez de lançar', () => {
  const original = globalThis.localStorage;
  (globalThis as Record<string, unknown>).localStorage = {
    getItem() { throw new Error('bloqueado'); },
    setItem() { throw new Error('bloqueado'); },
  };
  try {
    assert.deepEqual(lerLeitura(), LEITURA_PADRAO);
    assert.equal(lerFonteResumo(), 13);
    assert.equal(salvarFonteResumo(14), false, 'deve sinalizar que não persistiu');
  } finally {
    (globalThis as Record<string, unknown>).localStorage = original;
  }
});

test('mesclarVisual aceita só os campos informados', () => {
  mesclarVisual({ modo: 'ampliado' });
  assert.deepEqual(bruto(), { modo: 'ampliado' });
  mesclarVisual({ fonteResumo: 12 });
  assert.deepEqual(bruto(), { modo: 'ampliado', fonteResumo: 12 });
});
