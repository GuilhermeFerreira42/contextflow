import assert from 'node:assert/strict';
import { test } from 'node:test';
import { normalizarDataPublicacao, traduzirErroYtdlp } from '../../src/motor/src/integracoes/ytdlp.ts';
import { ErroDominio, ErroIndisponivel } from '../../src/motor/src/nucleo/erros.ts';

/* -------------------------------------------------------- tradução de erro -- */

function codigo(stderr: string): string {
  return traduzirErroYtdlp(stderr).codigo;
}

test('traduz vídeo privado', () => {
  const erro = traduzirErroYtdlp('ERROR: [youtube] abc: Private video. Sign in if you have access');
  assert.equal(erro.codigo, 'video_indisponivel');
  assert.equal(erro.statusHttp, 502);
});

test('traduz vídeo removido', () => {
  assert.equal(codigo('ERROR: Video unavailable'), 'video_indisponivel');
  assert.equal(codigo('This video has been removed by the uploader'), 'video_indisponivel');
});

test('traduz restrição de membros e de idade', () => {
  assert.equal(codigo('Join this channel to get access'), 'video_indisponivel');
  assert.equal(codigo('Sign in to confirm your age'), 'video_indisponivel');
});

test('traduz falha de rede para indisponível, não para erro de vídeo', () => {
  const erro = traduzirErroYtdlp(
    'TLS/SSL connection has been closed (EOF) (_ssl.c:992)',
  );
  assert.ok(erro instanceof ErroIndisponivel, 'deve ser 503, não 502');
  assert.equal(erro.statusHttp, 503);
});

test('erro desconhecido vira ingestao_falhou sem vazar o texto cru', () => {
  const erro = traduzirErroYtdlp('algo muito estranho aconteceu');
  assert.equal(erro.codigo, 'ingestao_falhou');
  assert.ok(!erro.message.toLowerCase().includes('estranho'), 'não repete o texto do yt-dlp');
});

test('tradução é sempre ErroDominio com código estável', () => {
  for (const texto of ['', 'xxx', 'Private video', 'SSL error']) {
    assert.ok(traduzirErroYtdlp(texto) instanceof ErroDominio);
  }
});

/* ------------------------------------------------------------ data de publicação -- */

test('normaliza upload_date do yt-dlp', () => {
  assert.equal(normalizarDataPublicacao('20240115'), '2024-01-15T00:00:00.000Z');
  assert.equal(normalizarDataPublicacao('19991231'), '1999-12-31T00:00:00.000Z');
});

test('rejeita data inválida ou ausente', () => {
  assert.equal(normalizarDataPublicacao(undefined), null);
  assert.equal(normalizarDataPublicacao(''), null);
  assert.equal(normalizarDataPublicacao('2024-01-15'), null, 'formato diferente não é aceito');
  assert.equal(normalizarDataPublicacao('20241315'), null, 'mês 13');
  assert.equal(normalizarDataPublicacao('20240132'), null, 'dia 32');
});

/* ------------------------------------------- regressão: TLS não é "privado" -- */

test('erro real de TLS do sandbox NÃO é classificado como restrição de idade', () => {
  // Mensagem literal coletada em execução real em 19/11/2025.
  const stderr =
    'ERROR: [youtube] dQw4w9WgXcQ: Unable to download API page: TLS/SSL connection ' +
    'has been closed (EOF) (_ssl.c:992) (caused by SSLError(...))';

  const erro = traduzirErroYtdlp(stderr);
  assert.equal(erro.codigo, 'indisponivel', 'é problema de conexão, não de vídeo');
  assert.equal(erro.statusHttp, 503);
  assert.match(erro.message, /conexão|internet/i);
  assert.ok(!/idade/i.test(erro.message), 'não pode falar em restrição de idade');
});

test('mensagem com a palavra "age" em outro contexto não vira restrição de idade', () => {
  // "page" contém "age" — a regra antiga dava falso positivo aqui.
  const erro = traduzirErroYtdlp('ERROR: Unable to download webpage: HTTP Error 403');
  assert.notEqual(erro.message, 'Este vídeo tem restrição de idade.');
});
test('mensagem real de vídeo indisponível é traduzida sem erro genérico', () => {
  const erro = traduzirErroYtdlp('ERROR: [youtube] BaW_jenozKc: This video is unavailable');
  assert.equal(erro.codigo, 'video_indisponivel');
  assert.equal(erro.message, 'Este vídeo não está mais disponível.');
});

test('HTTP 429 conserva código próprio para retry sem fingir ausência de legenda', () => {
  const erro = traduzirErroYtdlp("ERROR: Unable to download video subtitles for 'pt': HTTP Error 429: Too Many Requests");
  assert.equal(erro.codigo, 'limite_youtube');
  assert.equal(erro.statusHttp, 503);
  assert.match(erro.message, /Aguarde/);
});
