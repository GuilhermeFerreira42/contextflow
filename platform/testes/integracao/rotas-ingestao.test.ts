/**
 * Rotas HTTP da ingestão, com o adaptador substituído por um dublê.
 *
 * Verifica o que a interface vê: códigos HTTP corretos, envelope `ok`, e
 * mensagens úteis para o usuário — nunca um stack trace.
 */
import assert from 'node:assert/strict';
import { after, before, beforeEach, test } from 'node:test';
import { rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { criarAplicacao, type Aplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { ErroIndisponivel } from '../../src/motor/src/nucleo/erros.ts';
import type { ExecutorYtdlp, LegendaBaixada, MetadadosYtdlp } from '../../src/motor/src/integracoes/ytdlp.ts';

const URL_VIDEO = 'https://www.youtube.com/watch?v=runTxV0pyU8';

class ExecutorControlado implements ExecutorYtdlp {
  modo: 'normal' | 'sem-legenda' | 'ausente' | 'timeout' = 'normal';

  async disponivel() {
    return this.modo === 'ausente'
      ? { disponivel: false, versao: null, caminho: 'yt-dlp' }
      : { disponivel: true, versao: '2026.10.26', caminho: 'yt-dlp' };
  }

  async inspecionar(): Promise<MetadadosYtdlp> {
    if (this.modo === 'ausente') {
      throw new ErroIndisponivel('O yt-dlp não está instalado ou não está no PATH.');
    }
    if (this.modo === 'timeout') {
      const { ErroDominio } = await import('../../src/motor/src/nucleo/erros.ts');
      throw new ErroDominio('ytdlp_timeout', 'O YouTube não respondeu em 60 s. Tente de novo.', 504);
    }
    return {
      id: 'runTxV0pyU8',
      titulo: 'Vídeo de teste real',
      canalId: 'UCteste',
      canalNome: 'Canal de Teste',
      duracaoSegundos: 300,
      miniaturaUrl: null,
      publicadoEm: '2024-05-01T00:00:00.000Z',
      legendasManuais: ['pt'],
      legendasAutomaticas: [],
    };
  }

  async baixarLegenda(): Promise<LegendaBaixada | null> {
    if (this.modo === 'sem-legenda') return null;
    return {
      idioma: 'pt',
      origem: 'manual',
      segmentos: [
        { inicioMs: 0, fimMs: 1200, texto: 'olá' },
        { inicioMs: 1200, fimMs: 2400, texto: 'mundo' },
      ],
    };
  }
}

const executor = new ExecutorControlado();
let app: Aplicacao;
let base: string;

before(async () => {
  rmSync(fileURLToPath(new URL('../.tmp/dados-rotas-ingestao', import.meta.url)), {
    recursive: true,
    force: true,
  });
  const config = carregarConfig({
    CONTEXTFLOW_PORTA: '0',
    CONTEXTFLOW_AMBIENTE: 'teste',
    CONTEXTFLOW_DADOS: fileURLToPath(new URL('../.tmp/dados-rotas-ingestao', import.meta.url)),
  });
  app = criarAplicacao(config, { executorYtdlp: executor });
  app.iniciarPersistencia();
  await new Promise<void>((ok) => app.servidor.listen(0, '127.0.0.1', () => ok()));
  const endereco = app.servidor.address();
  const porta = typeof endereco === 'object' && endereco ? endereco.port : 0;
  base = `http://127.0.0.1:${porta}`;
});

after(async () => {
  await app.encerrar();
});

beforeEach(() => {
  executor.modo = 'normal';
});

/* --------------------------------------------------------------- diagnóstico -- */

test('GET /api/ingestao/diagnostico informa a presença do yt-dlp', async () => {
  const resposta = await fetch(`${base}/api/ingestao/diagnostico`);
  assert.equal(resposta.status, 200);
  const corpo = (await resposta.json()) as {
    ok: boolean;
    dados: { ytdlp: { disponivel: boolean; versao: string | null }; idiomas: string[] };
  };
  assert.equal(corpo.ok, true);
  assert.equal(corpo.dados.ytdlp.disponivel, true);
  assert.equal(corpo.dados.ytdlp.versao, '2026.10.26');
  assert.deepEqual(corpo.dados.idiomas, ['pt-BR', 'pt', 'en']);
});

test('diagnóstico diz claramente quando o yt-dlp falta', async () => {
  executor.modo = 'ausente';
  const resposta = await fetch(`${base}/api/ingestao/diagnostico`);
  const corpo = (await resposta.json()) as { dados: { ytdlp: { disponivel: boolean }; mensagem: string } };
  assert.equal(corpo.dados.ytdlp.disponivel, false);
  assert.match(corpo.dados.mensagem, /não encontrado|CONTEXTFLOW_YTDLP/i);
});

/* ------------------------------------------------------------------ importar -- */

test('POST /api/ingestao/importar grava vídeo, metadados e transcrição', async () => {
  const resposta = await fetch(`${base}/api/ingestao/importar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: URL_VIDEO }),
  });

  assert.equal(resposta.status, 200);
  const corpo = (await resposta.json()) as {
    ok: boolean;
    dados: {
      video: { id: string; titulo: string; canalNome: string; estado: string };
      transcricao: { origem: string; estado: string; quantidadeSegmentos: number };
      criado: boolean;
    };
  };

  assert.equal(corpo.dados.video.titulo, 'Vídeo de teste real');
  assert.equal(corpo.dados.video.canalNome, 'Canal de Teste');
  assert.equal(corpo.dados.video.estado, 'pronto');
  assert.equal(corpo.dados.transcricao.origem, 'manual');
  assert.equal(corpo.dados.transcricao.quantidadeSegmentos, 2);
  assert.equal(corpo.dados.criado, true);

  // O vídeo aparece na biblioteca pela rota normal
  const lista = (await (await fetch(`${base}/api/biblioteca?limite=10`)).json()) as {
    dados: { total: number; itens: Array<{ titulo: string }> };
  };
  assert.equal(lista.dados.total, 1);
  assert.equal(lista.dados.itens[0]!.titulo, 'Vídeo de teste real');
});

test('GET /api/biblioteca/:id/transcricao devolve os segmentos com tempo', async () => {
  const lista = (await (await fetch(`${base}/api/biblioteca?limite=10`)).json()) as {
    dados: { itens: Array<{ id: string }> };
  };
  const id = lista.dados.itens[0]!.id;

  const resposta = await fetch(`${base}/api/biblioteca/${id}/transcricao`);
  assert.equal(resposta.status, 200);
  const corpo = (await resposta.json()) as {
    dados: { estado: string; origem: string; segmentos: Array<{ inicioMs: number; texto: string }> };
  };
  assert.equal(corpo.dados.estado, 'pronta');
  assert.equal(corpo.dados.origem, 'manual');
  assert.deepEqual(
    corpo.dados.segmentos.map((s) => s.texto),
    ['olá', 'mundo'],
  );
});

test('transcrição de vídeo inexistente devolve 404', async () => {
  const resposta = await fetch(`${base}/api/biblioteca/nao-existe/transcricao`);
  assert.equal(resposta.status, 404);
});

test('segunda importação devolve criado:false sem duplicar', async () => {
  const resposta = await fetch(`${base}/api/ingestao/importar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://youtu.be/runTxV0pyU8' }),
  });
  assert.equal(resposta.status, 200);
  const corpo = (await resposta.json()) as { dados: { criado: boolean } };
  assert.equal(corpo.dados.criado, false);

  const lista = (await (await fetch(`${base}/api/biblioteca?limite=10`)).json()) as {
    dados: { total: number };
  };
  assert.equal(lista.dados.total, 1, 'continua havendo um único registro');
});

/* -------------------------------------------------------------------- falhas -- */

test('sem legenda: 200 com estado indisponível e motivo, vídeo parcial', async () => {
  executor.modo = 'sem-legenda';
  const resposta = await fetch(`${base}/api/ingestao/importar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=aaaaaaaaaaa' }),
  });

  assert.equal(resposta.status, 200, 'falta de legenda não é erro HTTP');
  const corpo = (await resposta.json()) as {
    dados: {
      video: { estado: string };
      transcricao: { estado: string; motivo: string | null; quantidadeSegmentos: number };
    };
  };
  assert.equal(corpo.dados.video.estado, 'parcial');
  assert.equal(corpo.dados.transcricao.estado, 'indisponivel');
  assert.ok(corpo.dados.transcricao.motivo);
  assert.equal(corpo.dados.transcricao.quantidadeSegmentos, 0);
});

test('yt-dlp ausente: 503 com orientação de instalação', async () => {
  executor.modo = 'ausente';
  const resposta = await fetch(`${base}/api/ingestao/importar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=bbbbbbbbbbb' }),
  });

  assert.equal(resposta.status, 503);
  const corpo = (await resposta.json()) as { ok: boolean; erro: { codigo: string; mensagem: string } };
  assert.equal(corpo.ok, false);
  assert.match(corpo.erro.mensagem, /yt-dlp|pip install/i);
});

test('timeout: 504 com mensagem clara', async () => {
  executor.modo = 'timeout';
  const resposta = await fetch(`${base}/api/ingestao/importar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://www.youtube.com/watch?v=ccccccccccc' }),
  });

  assert.equal(resposta.status, 504);
  const corpo = (await resposta.json()) as { erro: { codigo: string } };
  assert.equal(corpo.erro.codigo, 'ytdlp_timeout');
});

test('URL inválida: 422 antes de qualquer chamada externa', async () => {
  const resposta = await fetch(`${base}/api/ingestao/importar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://vimeo.com/123' }),
  });
  assert.equal(resposta.status, 422);

  const semUrl = await fetch(`${base}/api/ingestao/importar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({}),
  });
  assert.equal(semUrl.status, 422);
});

test('validar continua sendo local: não exige yt-dlp nem rede', async () => {
  executor.modo = 'ausente';
  const resposta = await fetch(`${base}/api/ingestao/validar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: URL_VIDEO }),
  });
  assert.equal(resposta.status, 200);
  const corpo = (await resposta.json()) as {
    dados: { valido: boolean; youtubeId: string };
  };
  assert.equal(corpo.dados.valido, true);
  assert.equal(corpo.dados.youtubeId, 'runTxV0pyU8');
});
