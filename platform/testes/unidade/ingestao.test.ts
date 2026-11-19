import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizarUrlVideo } from '../../src/motor/src/modulos/ingestao/servico.ts';
import { ErroValidacao } from '../../src/motor/src/nucleo/erros.ts';

test('aceita watch?v= e devolve URL canônica', () => {
  const r = normalizarUrlVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
  assert.equal(r.youtubeId, 'dQw4w9WgXcQ');
  assert.equal(r.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('aceita youtu.be', () => {
  assert.equal(normalizarUrlVideo('https://youtu.be/dQw4w9WgXcQ').youtubeId, 'dQw4w9WgXcQ');
});

test('aceita shorts', () => {
  assert.equal(normalizarUrlVideo('https://www.youtube.com/shorts/dQw4w9WgXcQ').youtubeId, 'dQw4w9WgXcQ');
});

test('remove parâmetros extras da URL', () => {
  const r = normalizarUrlVideo('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&t=42s');
  assert.equal(r.url, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
});

test('rejeita domínio não suportado', () => {
  assert.throws(() => normalizarUrlVideo('https://vimeo.com/12345'), ErroValidacao);
});

test('rejeita URL sem vídeo', () => {
  assert.throws(() => normalizarUrlVideo('https://www.youtube.com/canal'), ErroValidacao);
});

test('rejeita id de vídeo malformado', () => {
  assert.throws(() => normalizarUrlVideo('https://www.youtube.com/watch?v=curto'), ErroValidacao);
});

test('rejeita texto que não é URL', () => {
  assert.throws(() => normalizarUrlVideo('não é uma url'), ErroValidacao);
});

test('rejeita URL com injeção de argumento de shell', () => {
  // Defesa em profundidade: mesmo que algo chegue ao adaptador, o id é validado.
  assert.throws(() => normalizarUrlVideo('https://www.youtube.com/watch?v=abc;rm -rf /'), ErroValidacao);
});
