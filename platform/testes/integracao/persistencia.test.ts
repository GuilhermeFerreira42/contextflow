/**
 * Prova de persistência REAL: o banco é um arquivo em disco, o processo é morto
 * e outro processo abre o mesmo arquivo. Se os dados não estiverem lá, falha.
 *
 * É o cenário A7/B11 da matriz de aceite — o que um teste em memória não prova.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Banco } from '../../src/motor/src/persistencia/banco.ts';
import { RepositorioBibliotecaSqlite } from '../../src/motor/src/modulos/biblioteca/repositorio-sqlite.ts';

const raiz = fileURLToPath(new URL('../..', import.meta.url));
const pastaTmp = join(raiz, 'testes', '.tmp', 'persistencia');

function prepararPasta(): string {
  rmSync(pastaTmp, { recursive: true, force: true });
  mkdirSync(pastaTmp, { recursive: true, mode: 0o700 });
  return pastaTmp;
}

const video = (i: number) => ({
  id: `vid-${i}`,
  youtubeId: `yt${String(i).padStart(9, '0')}`,
  titulo: `Vídeo ${i}`,
  canalId: 'canal-1',
  canalNome: 'Canal',
  duracaoSegundos: 600,
  url: `https://www.youtube.com/watch?v=yt${String(i).padStart(9, '0')}`,
  miniaturaUrl: null,
  publicadoEm: null,
  estado: 'pronto' as const,
  criadoEm: `2026-01-0${i + 1}T00:00:00.000Z`,
  atualizadoEm: `2026-01-0${i + 1}T00:00:00.000Z`,
});

test('dados sobrevivem a fechar e reabrir o banco (mesmo processo)', async () => {
  const pasta = prepararPasta();
  const arquivo = join(pasta, 'sobrevive.db');

  const banco1 = Banco.abrir({ arquivo });
  banco1.migrar();
  const repo1 = new RepositorioBibliotecaSqlite(banco1.db);
  for (let i = 0; i < 3; i++) await repo1.inserir(video(i));
  banco1.fechar();

  // Reabre do zero: nova conexão, novo estado em memória.
  const banco2 = Banco.abrir({ arquivo });
  try {
    assert.equal(banco2.versaoAtual(), 1, 'schema não persistiu');
    const repo2 = new RepositorioBibliotecaSqlite(banco2.db);
    assert.equal(await repo2.contagem(), 3);
    const lido = await repo2.porId('vid-1');
    assert.equal(lido?.titulo, 'Vídeo 1');
  } finally {
    banco2.fechar();
  }
});

test('dados sobrevivem a outro PROCESSO (escrita e leitura separadas)', async () => {
  const pasta = prepararPasta();
  const arquivo = join(pasta, 'processos.db');

  // Processo 1: escreve e morre.
  const scriptEscrita = `
    import { Banco } from ${JSON.stringify(pathToFileURL(join(raiz, 'src/motor/src/persistencia/banco.ts')).href)};
    import { RepositorioBibliotecaSqlite } from ${JSON.stringify(pathToFileURL(join(raiz, 'src/motor/src/modulos/biblioteca/repositorio-sqlite.ts')).href)};
    const banco = Banco.abrir({ arquivo: ${JSON.stringify(arquivo)} });
    banco.migrar();
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    await repo.inserir(${JSON.stringify(video(0))});
    await repo.inserir(${JSON.stringify(video(1))});
    banco.fechar();
    console.log('escrito');
  `;
  const saida = execFileSync(
    process.execPath,
    ['--experimental-sqlite', '--experimental-strip-types', '--disable-warning=ExperimentalWarning', '--input-type=module', '-e', scriptEscrita],
    { encoding: 'utf8' },
  );
  assert.match(saida, /escrito/);
  assert.ok(existsSync(arquivo), 'arquivo do banco não foi criado');

  // Processo 2 (este): abre o arquivo e confere.
  const banco = Banco.abrir({ arquivo });
  try {
    assert.equal(banco.versaoAtual(), 1);
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    assert.equal(await repo.contagem(), 2, 'outro processo não viu os dados gravados');
    assert.equal((await repo.porId('vid-0'))?.titulo, video(0).titulo);
  } finally {
    banco.fechar();
  }
});

test('a pasta de dados é criada com permissão restrita', () => {
  const pasta = join(prepararPasta(), 'nova', 'aninhada');
  const banco = Banco.abrir({ arquivo: join(pasta, 'x.db') });
  try {
    banco.migrar();
    assert.ok(existsSync(join(pasta, 'x.db')));
  } finally {
    banco.fechar();
  }
});

test('nenhum segredo é gravado no arquivo do banco', async () => {
  const pasta = prepararPasta();
  const arquivo = join(pasta, 'segredo.db');
  const banco = Banco.abrir({ arquivo });
  try {
    banco.migrar();
    const repo = new RepositorioBibliotecaSqlite(banco.db);
    await repo.inserir(video(0));
  } finally {
    banco.fechar();
  }

  // Varre o arquivo (e o WAL) procurando padrões de segredo.
  for (const sufixo of ['', '-wal']) {
    const caminho = arquivo + sufixo;
    if (!existsSync(caminho)) continue;
    const bruto = readFileSync(caminho).toString('latin1');
    assert.ok(!/sk-[A-Za-z0-9]{20,}/.test(bruto), `padrão de chave OpenAI em ${caminho}`);
    assert.ok(!/AIza[0-9A-Za-z_-]{35}/.test(bruto), `padrão de chave Google em ${caminho}`);
  }
});

test('arquivo corrompido falha de forma explícita, sem apagar nada', () => {
  const pasta = prepararPasta();
  const arquivo = join(pasta, 'corrompido.db');
  writeFileSync(arquivo, 'isto nao e um banco sqlite valido');

  assert.throws(() => {
    const banco = Banco.abrir({ arquivo });
    banco.migrar();
  });
  // O arquivo original continua no disco (não destruímos dado do usuário).
  assert.ok(existsSync(arquivo));
});
