import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  lerBlocosJson3,
  lerBlocosVtt,
  normalizarLegenda,
  removerRolagem,
  tempoParaMs,
} from '../../src/motor/src/integracoes/legendas.ts';

/* ------------------------------------------------------------------- tempo -- */

test('converte tempo VTT em milissegundos', () => {
  assert.equal(tempoParaMs('00:00:01.234'), 1234);
  assert.equal(tempoParaMs('01:02:03.456'), 3_723_456);
  assert.equal(tempoParaMs('02:03.456'), 123_456);
  assert.equal(tempoParaMs('03.5'), 3500);
  assert.equal(tempoParaMs('00:00:01,234'), 1234, 'vírgula decimal é aceita');
  assert.equal(tempoParaMs('95'), 95_000, 'segundos soltos');
});

test('rejeita tempo malformado', () => {
  assert.equal(tempoParaMs('abc'), null);
  assert.equal(tempoParaMs('1:2:3:4'), null);
  assert.equal(tempoParaMs(''), null);
});

/* --------------------------------------------------------------------- VTT -- */

test('ignora cabeçalho, NOTE, STYLE e blocos vazios', () => {
  const vtt = [
    'WEBVTT',
    'Kind: captions',
    'Language: pt',
    '',
    'NOTE isto é um comentário',
    '',
    'STYLE',
    '::cue { color: red }',
    '',
    '00:00:01.000 --> 00:00:03.000',
    'Olá mundo',
    '',
    '00:00:04.000 --> 00:00:06.000',
    '',
  ].join('\n');

  const blocos = lerBlocosVtt(vtt);
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0]!.texto, 'Olá mundo');
  assert.equal(blocos[0]!.inicioMs, 1000);
  assert.equal(blocos[0]!.fimMs, 3000);
});

test('remove tags de estilo e decodifica entidades', () => {
  const vtt = [
    'WEBVTT',
    '',
    '00:00:01.000 --> 00:00:02.000',
    '<c.colorE5E5E5>Tom &amp; Jerry</c> &#39;especial&#39;',
    '',
  ].join('\n');

  const [bloco] = lerBlocosVtt(vtt);
  assert.equal(bloco!.texto, "Tom & Jerry 'especial'");
});

test('decodifica entidade numérica hexadecimal', () => {
  const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:02.000', 'caf&#xE9; &#233;', ''].join('\n');
  const [bloco] = lerBlocosVtt(vtt);
  assert.equal(bloco!.texto, 'café é');
});

test('junta múltiplas linhas de texto de um mesmo bloco', () => {
  const vtt = ['WEBVTT', '', '00:00:01.000 --> 00:00:02.000', 'primeira linha', 'segunda linha', ''].join('\n');
  const [bloco] = lerBlocosVtt(vtt);
  assert.equal(bloco!.texto, 'primeira linha segunda linha');
});

/* ------------------------------------------------------------------- JSON3 -- */

test('lê JSON3 com tStartMs e dDurationMs', () => {
  const json = JSON.stringify({
    events: [
      { tStartMs: 1000, dDurationMs: 2000, segs: [{ utf8: 'Olá ' }, { utf8: 'mundo' }] },
      { tStartMs: 4000, dDurationMs: 1500, segs: [{ utf8: 'depois' }] },
      { tStartMs: 9000, segs: [] },
      { segs: [{ utf8: 'sem tempo' }] },
    ],
  });

  const blocos = lerBlocosJson3(json);
  assert.equal(blocos.length, 2);
  assert.deepEqual(blocos[0], { inicioMs: 1000, fimMs: 3000, texto: 'Olá mundo' });
  assert.deepEqual(blocos[1], { inicioMs: 4000, fimMs: 5500, texto: 'depois' });
});

test('JSON3 inválido devolve lista vazia em vez de explodir', () => {
  assert.deepEqual(lerBlocosJson3('não é json'), []);
  assert.deepEqual(lerBlocosJson3('{"events":"nada"}'), []);
});

/* ---------------------------------------------------------------- rolagem -- */

test('remove repetição de rolagem da legenda automática', () => {
  const blocos = [
    { inicioMs: 0, fimMs: 1000, texto: 'primeira' },
    { inicioMs: 1000, fimMs: 2000, texto: 'primeira segunda' },
    { inicioMs: 2000, fimMs: 3000, texto: 'primeira segunda terceira' },
  ];

  const resultado = removerRolagem(blocos);
  assert.deepEqual(
    resultado.map((b) => b.texto),
    ['primeira', 'segunda', 'terceira'],
  );
});

test('descarta bloco que fica vazio após remover a rolagem', () => {
  const blocos = [
    { inicioMs: 0, fimMs: 1000, texto: 'igual' },
    { inicioMs: 1000, fimMs: 2000, texto: 'igual' },
  ];
  const resultado = removerRolagem(blocos);
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0]!.fimMs, 2000, 'fim é estendido, não perdido');
});

test('texto diferente não é confundido com rolagem', () => {
  const blocos = [
    { inicioMs: 0, fimMs: 1000, texto: 'abelha' },
    { inicioMs: 1000, fimMs: 2000, texto: 'bola' },
  ];
  assert.equal(removerRolagem(blocos).length, 2);
});

/* ------------------------------------------------------------- integração -- */

test('normalizarLegenda devolve segmentos ordenados e coerentes', () => {
  const vtt = [
    'WEBVTT',
    '',
    '00:00:05.000 --> 00:00:07.000',
    'segundo',
    '',
    '00:00:01.000 --> 00:00:03.000',
    'primeiro',
    '',
  ].join('\n');

  const segmentos = normalizarLegenda(vtt, 'vtt');
  assert.deepEqual(
    segmentos.map((s) => s.texto),
    ['primeiro', 'segundo'],
    'ordem do arquivo não importa: ordena por tempo',
  );
  for (const segmento of segmentos) {
    assert.ok(segmento.fimMs >= segmento.inicioMs, 'fim nunca antes do início');
    assert.ok(segmento.texto.length > 0, 'sem texto vazio');
  }
});

test('normalizarLegenda funde blocos encostados com texto igual', () => {
  const vtt = [
    'WEBVTT',
    '',
    '00:00:01.000 --> 00:00:02.000',
    'repetido',
    '',
    '00:00:02.100 --> 00:00:03.000',
    'repetido',
    '',
  ].join('\n');

  const segmentos = normalizarLegenda(vtt, 'vtt');
  assert.equal(segmentos.length, 1);
  assert.equal(segmentos[0]!.inicioMs, 1000);
  assert.equal(segmentos[0]!.fimMs, 3000);
});

test('normalizarLegenda ajusta sobreposição entre segmentos vizinhos', () => {
  const vtt = [
    'WEBVTT',
    '',
    '00:00:01.000 --> 00:00:05.000',
    'longo',
    '',
    '00:00:03.000 --> 00:00:04.000',
    'curto',
    '',
  ].join('\n');

  const segmentos = normalizarLegenda(vtt, 'vtt');
  assert.equal(segmentos.length, 2);
  assert.ok(
    segmentos[0]!.fimMs <= segmentos[1]!.inicioMs,
    'o fim do primeiro não atravessa o início do segundo',
  );
});

test('normalizarLegenda com entrada vazia devolve lista vazia', () => {
  assert.deepEqual(normalizarLegenda('', 'vtt'), []);
  assert.deepEqual(normalizarLegenda('WEBVTT\n\n', 'vtt'), []);
  assert.deepEqual(normalizarLegenda('{}', 'json3'), []);
});
