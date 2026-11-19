import assert from 'node:assert/strict';
import { test } from 'node:test';
import { criarRegistrador, redigir } from '../../src/motor/src/nucleo/registro.ts';

test('redige chaves sensíveis em primeiro nível', () => {
  const entrada = { apiKey: 'sk-123', chave: 'x', token: 'y', senha: 'z', usuario: 'gui' };
  const saida = redigir(entrada) as Record<string, unknown>;
  assert.equal(saida.apiKey, '[redigido]');
  assert.equal(saida.chave, '[redigido]');
  assert.equal(saida.token, '[redigido]');
  assert.equal(saida.senha, '[redigido]');
  assert.equal(saida.usuario, 'gui');
});

test('redige em objetos aninhados e listas', () => {
  const saida = redigir({
    provedor: { nome: 'google', api_key: 'segredo' },
    lista: [{ password: 'p' }, { ok: 1 }],
  }) as any;
  assert.equal(saida.provedor.api_key, '[redigido]');
  assert.equal(saida.provedor.nome, 'google');
  assert.equal(saida.lista[0].password, '[redigido]');
  assert.equal(saida.lista[1].ok, 1);
});

test('não mutila valores primitivos', () => {
  assert.equal(redigir('texto'), 'texto');
  assert.equal(redigir(42), 42);
  assert.equal(redigir(null), null);
});

test('o registrador não escreve segredo no fluxo de saída', () => {
  const escritos: string[] = [];
  const original = process.stdout.write.bind(process.stdout);
  (process.stdout as any).write = (bloco: string) => {
    escritos.push(String(bloco));
    return true;
  };
  try {
    criarRegistrador('debug').info('teste', { apiKey: 'DEVE-SUMIR' });
  } finally {
    process.stdout.write = original;
  }
  const tudo = escritos.join('');
  assert.ok(!tudo.includes('DEVE-SUMIR'), 'segredo vazou para o log');
  assert.ok(tudo.includes('[redigido]'));
});
