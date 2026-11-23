import { test } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, access } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { Ytdlp } from '../../src/motor/src/integracoes/ytdlp.ts';

const url = 'https://www.youtube.com/watch?v=cL25NruYopo';
function ambiente(falha: string, sucesso = 'es-orig', manual = false, vazia = false) {
  const tentativas: string[] = [], pastas: string[] = [];
  const executor = new Ytdlp({ executar: async (_bin, args) => {
    if (args.includes('--dump-single-json')) return { codigo: 0, stderr: '', stdout: JSON.stringify({
      id: 'cL25NruYopo', title: 'Fixture', language: 'es-US',
      subtitles: manual ? { pt: [] } : {}, automatic_captions: { pt: [], 'en-orig': [], 'es-orig': [], es: [] },
    }) };
    const idioma = args[args.indexOf('--sub-langs') + 1]!;
    tentativas.push(idioma);
    const pasta = dirname(args[args.indexOf('-o') + 1]!); pastas.push(pasta);
    assert.equal(args.at(-1), url);
    if (idioma === `^${sucesso}$`) {
      await writeFile(join(pasta, 'fixture.vtt'), 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nFonte real da fixture.\n');
      return { codigo: 0, stdout: '', stderr: '' };
    }
    if (vazia) {
      await writeFile(join(pasta, 'fixture.vtt'), 'WEBVTT\n');
      return { codigo: 0, stdout: '', stderr: '' };
    }
    return { codigo: 1, stdout: '', stderr: falha };
  } });
  return { executor, tentativas, pastas };
}

test('429 tenta uma faixa orig do idioma de áudio, registra idioma real e limpa temporários', async () => {
  const a = ambiente('HTTP Error 429: Too Many Requests');
  const legenda = await a.executor.baixarLegenda(url, ['pt']);
  assert.deepEqual(a.tentativas, ['^pt$', '^es-orig$']);
  assert.equal(legenda?.idioma, 'es-orig'); assert.equal(legenda?.origem, 'auto');
  assert.equal(legenda?.segmentos[0]?.texto, 'Fonte real da fixture.');
  assert.equal(new Set(a.pastas).size, 2);
  for (const p of a.pastas) await assert.rejects(access(p));
});

test('429 persistente interrompe após uma alternativa, sem varrer traduções', async () => {
  const a = ambiente('HTTP Error 429: Too Many Requests', 'nenhum');
  await assert.rejects(a.executor.baixarLegenda(url, ['pt']), { codigo: 'limite_youtube' });
  assert.equal(a.tentativas.length, 2);
  for (const p of a.pastas) await assert.rejects(access(p));
});

test('manual tem prioridade e restrição privada não tenta outro idioma', async () => {
  const a = ambiente('Private video', 'nenhum', true);
  await assert.rejects(a.executor.baixarLegenda(url, ['pt']), { codigo: 'video_indisponivel' });
  assert.deepEqual(a.tentativas, ['^pt$']);
});

test('cancelamento interrompe antes do download', async () => {
  const a = ambiente('HTTP Error 429'); const c = new AbortController(); c.abort();
  await assert.rejects(a.executor.baixarLegenda(url, ['pt'], c.signal), { codigo: 'trabalho_cancelado' });
  assert.deepEqual(a.tentativas, []);
});

test('legenda vazia não vira pronta: tenta outra faixa com segmentos válidos', async () => {
  const a = ambiente('', 'es-orig', false, true);
  assert.equal((await a.executor.baixarLegenda(url, ['pt']))?.idioma, 'es-orig');
  assert.equal(a.tentativas.length, 2);
});

test('erros de entrega têm no máximo três tentativas', async () => {
  const a = ambiente('HTTP Error 404', 'nenhum');
  await assert.rejects(a.executor.baixarLegenda(url, ['pt']), { codigo: 'indisponivel' });
  assert.equal(a.tentativas.length, 3);
});

test('manual disponível é usada antes de qualquer automática', async () => {
  const a = ambiente('', 'pt', true);
  assert.equal((await a.executor.baixarLegenda(url, ['pt']))?.origem, 'manual');
  assert.equal(a.tentativas.length, 1);
});

test('sem faixas não faz download nem inventa transcrição', async () => {
  let chamadas = 0;
  const y = new Ytdlp({ executar: async () => {
    chamadas++; return { codigo: 0, stderr: '', stdout: JSON.stringify({ id: 'cL25NruYopo', title: 'Sem legendas' }) };
  } });
  assert.equal(await y.baixarLegenda(url, ['pt']), null); assert.equal(chamadas, 1);
});

test('código de idioma anunciado vira regex exata, não expande a seleção', async () => {
  const y = new Ytdlp({ executar: async (_bin, args) => {
    if (args.includes('--dump-single-json')) return { codigo: 0, stderr: '', stdout: JSON.stringify({
      id: 'cL25NruYopo', title: 'Fixture', subtitles: { 'pt.BR': [] },
    }) };
    assert.equal(args[args.indexOf('--sub-langs') + 1], '^pt\\.BR$');
    await writeFile(join(dirname(args[args.indexOf('-o') + 1]!), 'fixture.vtt'), 'WEBVTT\n\n00:00:00.000 --> 00:00:02.000\nFonte.\n');
    return { codigo: 0, stderr: '', stdout: '' };
  } });
  assert.equal((await y.baixarLegenda(url, ['pt.BR']))?.idioma, 'pt.BR');
});
