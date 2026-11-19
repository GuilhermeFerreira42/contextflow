import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Video } from '@contextflow/compartilhado';
import { RepositorioBibliotecaMemoria } from '../../src/motor/src/modulos/biblioteca/repositorio-memoria.ts';
import { ServicoBiblioteca } from '../../src/motor/src/modulos/biblioteca/servico.ts';
import { ErroNaoEncontrado, ErroValidacao } from '../../src/motor/src/nucleo/erros.ts';

function video(parcial: Partial<Video> & { id: string; youtubeId: string }): Video {
  const agora = '2026-01-01T00:00:00.000Z';
  return {
    titulo: `Vídeo ${parcial.id}`,
    canalId: 'canal-1',
    canalNome: 'Canal Um',
    duracaoSegundos: 600,
    url: `https://www.youtube.com/watch?v=${parcial.youtubeId}`,
    miniaturaUrl: null,
    publicadoEm: null,
    estado: 'pronto',
    criadoEm: agora,
    atualizadoEm: agora,
    ...parcial,
  };
}

test('impede duplicidade por youtubeId', async () => {
  const repo = new RepositorioBibliotecaMemoria();
  await repo.inserir(video({ id: 'a', youtubeId: 'aaaaaaaaaaa' }));
  await assert.rejects(() => repo.inserir(video({ id: 'b', youtubeId: 'aaaaaaaaaaa' })), /duplicado/);
});

test('cursor percorre tudo exatamente uma vez', async () => {
  const repo = new RepositorioBibliotecaMemoria();
  for (let i = 0; i < 7; i++) {
    await repo.inserir(video({ id: `v${i}`, youtubeId: `yyyyyyyyy${i}`.slice(0, 11), criadoEm: `2026-01-0${i + 1}T00:00:00.000Z` }));
  }
  const servico = new ServicoBiblioteca(repo);
  const vistos: string[] = [];
  let cursor: string | null = null;
  do {
    const pagina = await servico.consultar({ limite: '3', ...(cursor ? { cursor } : {}) });
    vistos.push(...pagina.itens.map((v) => v.id));
    cursor = pagina.proximoCursor;
  } while (cursor);

  assert.equal(vistos.length, 7);
  assert.equal(new Set(vistos).size, 7, 'cursor repetiu itens');
});

test('busca filtra por título e canal, sem diferenciar caixa', async () => {
  const repo = new RepositorioBibliotecaMemoria();
  await repo.inserir(video({ id: 'x', youtubeId: 'xxxxxxxxxxx', titulo: 'TypeScript Avançado' }));
  await repo.inserir(video({ id: 'y', youtubeId: 'yyyyyyyyyyy', titulo: 'Culinária', canalNome: 'Chef' }));
  const servico = new ServicoBiblioteca(repo);

  const r1 = await servico.consultar({ busca: 'typescript' });
  assert.deepEqual(r1.itens.map((v) => v.id), ['x']);

  const r2 = await servico.consultar({ busca: 'chef' });
  assert.deepEqual(r2.itens.map((v) => v.id), ['y']);
});

test('limite fora da faixa é rejeitado com validação', async () => {
  const servico = new ServicoBiblioteca(new RepositorioBibliotecaMemoria());
  await assert.rejects(() => servico.consultar({ limite: '0' }), ErroValidacao);
  await assert.rejects(() => servico.consultar({ limite: '9999' }), ErroValidacao);
  await assert.rejects(() => servico.consultar({ limite: 'abc' }), ErroValidacao);
});

test('obter id inexistente devolve erro de não encontrado', async () => {
  const servico = new ServicoBiblioteca(new RepositorioBibliotecaMemoria());
  await assert.rejects(() => servico.obter('nao-existe'), ErroNaoEncontrado);
});

test('devolve cópia, não referência interna', async () => {
  const repo = new RepositorioBibliotecaMemoria();
  await repo.inserir(video({ id: 'z', youtubeId: 'zzzzzzzzzzz' }));
  const lido = await repo.porId('z');
  lido!.titulo = 'ALTERADO FORA';
  const relido = await repo.porId('z');
  assert.notEqual(relido!.titulo, 'ALTERADO FORA');
});
