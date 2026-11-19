import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { test } from 'node:test';
import { resolverArquivoPublico } from '../../src/motor/src/nucleo/estatico.ts';

const raiz = fileURLToPath(new URL('../../src/interface/publico', import.meta.url));

test('serve o index na raiz', () => {
  const r = resolverArquivoPublico(raiz, '/');
  assert.ok(r.arquivo?.endsWith('index.html'));
});

test('serve arquivo existente', () => {
  const r = resolverArquivoPublico(raiz, '/estilos/principal.css');
  assert.ok(r.arquivo?.endsWith('principal.css'));
});

test('BLOQUEIA path traversal cru', () => {
  const r = resolverArquivoPublico(raiz, '/../../../../etc/passwd');
  assert.equal(r.arquivo, null);
});

test('BLOQUEIA path traversal codificado', () => {
  const r = resolverArquivoPublico(raiz, '/..%2f..%2f..%2f..%2fetc%2fpasswd');
  assert.equal(r.arquivo, null);
});

test('BLOQUEIA travessia aninhada', () => {
  const r = resolverArquivoPublico(raiz, '/sub/../../../etc/passwd');
  assert.equal(r.arquivo, null);
});

test('BLOQUEIA subir um nível para package.json', () => {
  const r = resolverArquivoPublico(raiz, '/../package.json');
  assert.equal(r.arquivo, null);
});

test('arquivo inexistente devolve null (não lança)', () => {
  const r = resolverArquivoPublico(raiz, '/nao-existe.js');
  assert.equal(r.arquivo, null);
});
