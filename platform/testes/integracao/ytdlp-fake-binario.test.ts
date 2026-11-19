/**
 * Adaptador real do yt-dlp contra um binário falso.
 *
 * Este é o teste mais próximo do mundo real que o ambiente permite: o `spawn`
 * acontece de verdade, o processo é de verdade, os arquivos são de verdade.
 * Só o conteúdo (JSON e VTT) é controlado — para não depender do YouTube.
 *
 * Um binário falso também prova o que um dublê de classe não prova:
 *  - os argumentos são passados como array (nada de shell);
 *  - a legenda é lida do disco e o diretório temporário é apagado.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { chmod, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { Ytdlp } from '../../src/motor/src/integracoes/ytdlp.ts';
import { ErroDominio } from '../../src/motor/src/nucleo/erros.ts';

const SO_SCRIPT = process.platform === 'win32';

const CORPO_BINARIO = `#!/bin/sh
case "$*" in
  *--version*) echo "2026.10.26"; exit 0 ;;
  *--dump-single-json*)
    cat <<'JSON'
{"id":"runTxV0pyU8","title":"Título vindo do serviço","channel_id":"UCxxx","channel":"Canal do Serviço","duration":754,"thumbnail":"https://exemplo/x.jpg","upload_date":"20240310","subtitles":{"pt":[{},{}]},"automatic_captions":{}}
JSON
    exit 0 ;;
  *--write-subs*|*--write-auto-subs*)
    out=""
    while [ $# -gt 0 ]; do case "$1" in -o) shift; out="$1" ;; esac; shift; done
    dir=$(dirname "$out")
    printf 'WEBVTT\\n\\n00:00:00.000 --> 00:00:02.000\\nprimeira fala\\n\\n00:00:02.500 --> 00:00:05.000\\nsegunda fala\\n\\n' > "$dir/runTxV0pyU8.pt.vtt"
    exit 0 ;;
esac
echo "ERROR: Video unavailable" >&2
exit 1
`;

async function comBinarioFalso(fn: (caminho: string) => Promise<void>): Promise<void> {
  const pasta = await mkdtemp(join(tmpdir(), 'contextflow-binario-falso-'));
  const binario = join(pasta, 'yt-dlp');
  try {
    await writeFile(binario, CORPO_BINARIO, 'utf8');
    await chmod(binario, 0o755);
    await fn(binario);
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
}

test(
  'inspecionar lê metadados reais de um processo de verdade',
  { skip: SO_SCRIPT ? 'binário de teste é um shell script' : false },
  async () => {
    await comBinarioFalso(async (binario) => {
      const adaptador = new Ytdlp({ binario });
      const metadados = await adaptador.inspecionar('https://www.youtube.com/watch?v=runTxV0pyU8');

      assert.equal(metadados.id, 'runTxV0pyU8');
      assert.equal(metadados.titulo, 'Título vindo do serviço');
      assert.equal(metadados.canalId, 'UCxxx');
      assert.equal(metadados.canalNome, 'Canal do Serviço');
      assert.equal(metadados.duracaoSegundos, 754);
      assert.equal(metadados.publicadoEm, '2024-03-10T00:00:00.000Z');
      assert.deepEqual(metadados.legendasManuais, ['pt']);
      assert.deepEqual(metadados.legendasAutomaticas, []);
    });
  },
);

test(
  'baixarLegenda lê o arquivo do disco, normaliza e apaga o temporário',
  { skip: SO_SCRIPT ? 'binário de teste é um shell script' : false },
  async () => {
    const antes = (await readdir(tmpdir())).filter((n) => n.startsWith('contextflow-legenda-')).length;

    await comBinarioFalso(async (binario) => {
      const adaptador = new Ytdlp({ binario });
      const legenda = await adaptador.baixarLegenda('https://www.youtube.com/watch?v=runTxV0pyU8', [
        'pt',
      ]);

      assert.ok(legenda, 'legenda não pode ser nula quando o binário grava arquivo');
      assert.equal(legenda.idioma, 'pt');
      assert.equal(legenda.origem, 'manual');
      assert.deepEqual(
        legenda.segmentos.map((s) => [s.inicioMs, s.fimMs, s.texto]),
        [
          [0, 2000, 'primeira fala'],
          [2500, 5000, 'segunda fala'],
        ],
      );
    });

    const depois = (await readdir(tmpdir())).filter((n) => n.startsWith('contextflow-legenda-')).length;
    assert.equal(depois, antes, 'nenhum diretório temporário pode sobrar');
  },
);

test(
  'sem legenda disponível devolve null em vez de erro',
  { skip: SO_SCRIPT ? 'binário de teste é um shell script' : false },
  async () => {
    // Binário que informa metadados sem nenhuma legenda.
    const pasta = await mkdtemp(join(tmpdir(), 'contextflow-sem-legenda-'));
    try {
      const binario = join(pasta, 'yt-dlp');
      await writeFile(
        binario,
        `#!/bin/sh
case "$*" in
  *--dump-single-json*)
    echo '{"id":"x","title":"Sem legenda","subtitles":{},"automatic_captions":{}}'
    exit 0 ;;
esac
exit 1
`,
        'utf8',
      );
      await chmod(binario, 0o755);

      const adaptador = new Ytdlp({ binario });
      assert.equal(
        await adaptador.baixarLegenda('https://www.youtube.com/watch?v=runTxV0pyU8', ['pt']),
        null,
      );
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  },
);

test(
  'erro do processo é traduzido, sem vazar comando ou caminho',
  { skip: SO_SCRIPT ? 'binário de teste é um shell script' : false },
  async () => {
    // O binário falso responde "Video unavailable" para qualquer coisa que não
    // seja inspeção/legenda — simula vídeo indisponível.
    const pasta = await mkdtemp(join(tmpdir(), 'contextflow-erro-'));
    try {
      const binario = join(pasta, 'yt-dlp');
      await writeFile(
        binario,
        `#!/bin/sh
if [ "$1" = "--version" ]; then echo "2026.10.26"; exit 0; fi
echo "ERROR: [youtube] abc: Video unavailable" >&2
exit 1
`,
        'utf8',
      );
      await chmod(binario, 0o755);

      const adaptador = new Ytdlp({ binario });
      await assert.rejects(
        () => adaptador.inspecionar('https://www.youtube.com/watch?v=runTxV0pyU8'),
        (erro: unknown) => {
          assert.ok(erro instanceof ErroDominio);
          assert.equal(erro.codigo, 'video_indisponivel');
          assert.ok(!erro.message.includes('/tmp/'), 'mensagem não expõe caminho do sistema');
          assert.ok(!erro.message.includes('echo'), 'mensagem não expõe comando');
          return true;
        },
      );
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  },
);

test(
  'URL com caracteres de shell é passada como argumento único, não interpretada',
  { skip: SO_SCRIPT ? 'binário de teste é um shell script' : false },
  async () => {
    const pasta = await mkdtemp(join(tmpdir(), 'contextflow-injecao-'));
    try {
      const binario = join(pasta, 'yt-dlp');
      // Se a URL fosse para o shell, `$(touch /tmp/pwn)` criaria o arquivo.
      const marcador = join(pasta, 'pwned');
      await writeFile(
        binario,
        `#!/bin/sh
if [ "$1" = "--version" ]; then echo "2026.10.26"; exit 0; fi
echo '{"id":"runTxV0pyU8","title":"Injeção","subtitles":{}}'
exit 0
`,
        'utf8',
      );
      await chmod(binario, 0o755);

      const adaptador = new Ytdlp({ binario });
      await adaptador.inspecionar(`https://www.youtube.com/watch?v=runTxV0pyU8;touch\t${marcador}`);

      const arquivos = await readdir(pasta);
      assert.ok(!arquivos.includes('pwned'), 'o texto da URL não pode ser executado');
    } finally {
      await rm(pasta, { recursive: true, force: true });
    }
  },
);
