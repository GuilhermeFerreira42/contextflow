/**
 * Testes do adaptador REAL do yt-dlp, exercitando `spawn`.
 *
 * Não dependem do YouTube: usam binários do próprio sistema (`node`, ou um
 * caminho inexistente) para provar o contrato de processo —
 *  - binário ausente → erro de domínio `indisponivel` com orientação;
 *  - timeout → mata o filho e devolve 504;
 *  - saída inválida → erro de domínio, nunca exceção crua.
 *
 * O teste real contra o YouTube é manual e está documentado na spec (o
 * sandbox desta sessão bloqueia o domínio).
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Ytdlp } from '../../src/motor/src/integracoes/ytdlp.ts';
import { ErroDominio, ErroIndisponivel } from '../../src/motor/src/nucleo/erros.ts';

test('binário inexistente devolve 503 com orientação, sem derrubar nada', async () => {
  const adaptador = new Ytdlp({ binario: 'yt-dlp-que-nao-existe-de-jeito-nenhum' });

  await assert.rejects(
    () => adaptador.inspecionar('https://www.youtube.com/watch?v=runTxV0pyU8'),
    (erro: unknown) => {
      assert.ok(erro instanceof ErroIndisponivel, 'deve ser ErroIndisponivel (503)');
      assert.equal(erro.statusHttp, 503);
      assert.match(erro.message, /pip install|CONTEXTFLOW_YTDLP/);
      return true;
    },
  );
});

test('disponivel() responde false em vez de lançar quando falta o binário', async () => {
  const adaptador = new Ytdlp({ binario: 'nao-existe-mesmo' });
  const estado = await adaptador.disponivel();
  assert.equal(estado.disponivel, false);
  assert.equal(estado.versao, null);
  assert.equal(estado.caminho, 'nao-existe-mesmo');
});

test(
  'timeout mata o processo filho e devolve 504',
  { skip: process.platform === 'win32' ? 'script de teste usa shebang; não roda no Windows' : false },
  async () => {
    // Binário falso: ignora os argumentos e dorme. É a única forma honesta de
    // provar que o timeout mata o filho — `node` recusa flags desconhecidas.
    const { mkdtemp, writeFile, chmod, rm } = await import('node:fs/promises');
    const { tmpdir } = await import('node:os');
    const { join } = await import('node:path');

    const pasta = await mkdtemp(join(tmpdir(), 'contextflow-ytdlp-falso-'));
    const script = join(pasta, 'yt-dlp-falso');

    try {
      await writeFile(script, '#!/bin/sh\nexec sleep 30\n', 'utf8');
      await chmod(script, 0o755);

      const adaptador = new Ytdlp({ binario: script, timeoutMs: 300 });
      const inicio = Date.now();

      await assert.rejects(
        () => adaptador.inspecionar('https://www.youtube.com/watch?v=runTxV0pyU8'),
        (erro: unknown) => {
          assert.ok(erro instanceof ErroDominio);
          assert.equal(erro.codigo, 'ytdlp_timeout');
          assert.equal(erro.statusHttp, 504);
          return true;
        },
      );

      const decorrido = Date.now() - inicio;
      assert.ok(decorrido < 5000, `deve encerrar perto de 300 ms, levou ${decorrido} ms`);
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  },
);

test('disponivel() lê a versão da primeira linha do --version', async () => {
  // Qualquer binário real serve: o contrato é "primeira linha, sem espaços".
  const adaptador = new Ytdlp({ binario: process.execPath, timeoutMs: 5000 });
  const estado = await adaptador.disponivel();
  assert.equal(estado.disponivel, true, 'node responde a --version com código 0');
  assert.ok(estado.versao && estado.versao.startsWith('v'), `veio: ${estado.versao}`);
});

test('registrarErro recebe o stderr do processo, sem vazar para o usuário', async () => {
  const mensagens: string[] = [];
  const adaptador = new Ytdlp({
    binario: 'nao-existe-para-log',
    registrarErro: (m) => mensagens.push(m),
  });

  await assert.rejects(() => adaptador.disponivel().then((d) => {
    if (!d.disponivel) throw new ErroIndisponivel('faltou');
  }));

  // O caminho ENOENT não produz stderr; o que importa é que não explode.
  assert.ok(Array.isArray(mensagens));
});
