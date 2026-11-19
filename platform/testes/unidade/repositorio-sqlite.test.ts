import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Video } from '@contextflow/compartilhado';
import { Banco } from '../../src/motor/src/persistencia/banco.ts';
import { RepositorioBibliotecaSqlite } from '../../src/motor/src/modulos/biblioteca/repositorio-sqlite.ts';
import { ServicoBiblioteca } from '../../src/motor/src/modulos/biblioteca/servico.ts';
import { ErroDominio } from '../../src/motor/src/nucleo/erros.ts';

function criarBanco() {
  const banco = Banco.abrir({ arquivo: ':memory:' });
  banco.migrar();
  return banco;
}

function video(parcial: Partial<Video> & { id: string; youtubeId: string }): Video {
  const agora = parcial.criadoEm ?? '2026-01-01T00:00:00.000Z';
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

test('inserir e ler devolve o mesmo vídeo', async () => {
  const banco = criarBanco();
  try {
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    const original = video({ id: 'v1', youtubeId: 'dQw4w9WgXcQ' });
    await repo.inserir(original);
    const lido = await repo.porId('v1');
    assert.deepEqual(lido, original);
  } finally {
    banco.fechar();
  }
});

test('youtube_id é único: duplicata vira erro de domínio 409', async () => {
  const banco = criarBanco();
  try {
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    await repo.inserir(video({ id: 'v1', youtubeId: 'dQw4w9WgXcQ' }));
    const erro = await repo.inserir(video({ id: 'v2', youtubeId: 'dQw4w9WgXcQ' })).catch((e) => e);
    assert.ok(erro instanceof ErroDominio);
    assert.equal(erro.codigo, 'video_duplicado');
    assert.equal(erro.statusHttp, 409);
    assert.equal(await repo.contagem(), 1);
  } finally {
    banco.fechar();
  }
});

test('busca por youtubeId encontra o vídeo', async () => {
  const banco = criarBanco();
  try {
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    await repo.inserir(video({ id: 'v1', youtubeId: 'dQw4w9WgXcQ' }));
    assert.equal((await repo.porYoutubeId('dQw4w9WgXcQ'))?.id, 'v1');
    assert.equal(await repo.porYoutubeId('naoexiste01'), null);
  } finally {
    banco.fechar();
  }
});

test('cursor percorre 250 registros exatamente uma vez, sem repetir nem pular', async () => {
  const banco = criarBanco();
  try {
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    const servico = new ServicoBiblioteca(repo);

    // criadoEm com empates propositais para exercitar o desempate por id.
    for (let i = 0; i < 250; i++) {
      const dia = String((i % 5) + 1).padStart(2, '0');
      await repo.inserir(
        video({
          id: `v${String(i).padStart(4, '0')}`,
          youtubeId: `yt${String(i).padStart(9, '0')}`,
          criadoEm: `2026-01-${dia}T00:00:00.000Z`,
        }),
      );
    }

    const vistos: string[] = [];
    let cursor: string | null = null;
    let paginas = 0;
    do {
      const pagina = await servico.consultar({ limite: '37', ...(cursor ? { cursor } : {}) });
      vistos.push(...pagina.itens.map((v) => v.id));
      cursor = pagina.proximoCursor;
      paginas++;
      assert.ok(paginas < 20, 'cursor não terminou — laço infinito');
    } while (cursor);

    assert.equal(vistos.length, 250, 'quantidade errada de itens');
    assert.equal(new Set(vistos).size, 250, 'cursor repetiu itens');
  } finally {
    banco.fechar();
  }
});

test('cursor inválido é rejeitado com código estável', async () => {
  const banco = criarBanco();
  try {
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    const erro = await repo.consultar({ filtro: {}, cursor: 'nao-existe', limite: 10 }).catch((e) => e);
    assert.ok(erro instanceof ErroDominio);
    assert.equal(erro.codigo, 'cursor_invalido');
  } finally {
    banco.fechar();
  }
});

test('filtros de estado, canal e busca funcionam combinados', async () => {
  const banco = criarBanco();
  try {
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    await repo.inserir(video({ id: 'a', youtubeId: 'aaaaaaaaaaa', titulo: 'TypeScript avançado', estado: 'pronto', canalId: 'c1' }));
    await repo.inserir(video({ id: 'b', youtubeId: 'bbbbbbbbbbb', titulo: 'Culinária', estado: 'erro', canalId: 'c2' }));
    await repo.inserir(video({ id: 'c', youtubeId: 'ccccccccccc', titulo: 'TypeScript básico', estado: 'erro', canalId: 'c1' }));

    assert.deepEqual((await repo.consultar({ filtro: { estado: 'erro' }, cursor: null, limite: 10 })).itens.map((v) => v.id).sort(), ['b', 'c']);
    assert.deepEqual((await repo.consultar({ filtro: { canalId: 'c1' }, cursor: null, limite: 10 })).itens.map((v) => v.id).sort(), ['a', 'c']);
    assert.deepEqual((await repo.consultar({ filtro: { busca: 'typescript' }, cursor: null, limite: 10 })).itens.map((v) => v.id).sort(), ['a', 'c']);
    assert.deepEqual(
      (await repo.consultar({ filtro: { busca: 'typescript', estado: 'erro', canalId: 'c1' }, cursor: null, limite: 10 })).itens.map((v) => v.id),
      ['c'],
    );
  } finally {
    banco.fechar();
  }
});

test('busca não é sensível a caixa', async () => {
  const banco = criarBanco();
  try {
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    await repo.inserir(video({ id: 'a', youtubeId: 'aaaaaaaaaaa', titulo: 'NODE.JS na prática' }));
    const r = await repo.consultar({ filtro: { busca: 'node.js' }, cursor: null, limite: 10 });
    assert.equal(r.itens.length, 1);
  } finally {
    banco.fechar();
  }
});

test('atualizar vídeo inexistente devolve não encontrado', async () => {
  const banco = criarBanco();
  try {
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    const erro = await repo.atualizar(video({ id: 'fantasma', youtubeId: 'zzzzzzzzzzz' })).catch((e) => e);
    assert.ok(erro instanceof ErroDominio);
    assert.equal(erro.codigo, 'nao_encontrado');
  } finally {
    banco.fechar();
  }
});
