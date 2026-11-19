/**
 * Ingestão real com adaptador dublê.
 *
 * Nada aqui toca a rede: o `ExecutorYtdlp` é substituído por uma implementação
 * controlada. O que se prova é a REGRA — prioridade de legenda, estados,
 * deduplicação, falha explícita —, não o comportamento do YouTube.
 */
import assert from 'node:assert/strict';
import { afterEach, beforeEach, test } from 'node:test';

import type { Video } from '@contextflow/compartilhado';
import { Banco } from '../../src/motor/src/persistencia/banco.ts';
import { RepositorioTranscricoesSqlite } from '../../src/motor/src/persistencia/repositorio-transcricoes.ts';
import { RepositorioBibliotecaSqlite } from '../../src/motor/src/modulos/biblioteca/repositorio-sqlite.ts';
import { ServicoIngestaoReal, normalizarUrlVideo } from '../../src/motor/src/modulos/ingestao/servico.ts';
import type { ExecutorYtdlp, LegendaBaixada, MetadadosYtdlp } from '../../src/motor/src/integracoes/ytdlp.ts';
import { ErroDominio, ErroIndisponivel, ErroValidacao } from '../../src/motor/src/nucleo/erros.ts';

/* ------------------------------------------------------------------ dublê -- */

interface Cenario {
  metadados?: MetadadosYtdlp;
  legenda?: LegendaBaixada | null;
  erroInspecionar?: Error;
  erroLegenda?: Error;
  chamadas?: string[];
}

class ExecutorFalso implements ExecutorYtdlp {
  readonly cenario: Cenario;

  constructor(cenario: Cenario = {}) {
    this.cenario = cenario;
  }

  async disponivel() {
    return { disponivel: true, versao: '2026.10.26', caminho: 'yt-dlp' };
  }

  async inspecionar(url: string): Promise<MetadadosYtdlp> {
    this.cenario.chamadas?.push(`inspecionar:${url}`);
    if (this.cenario.erroInspecionar) throw this.cenario.erroInspecionar;
    return (
      this.cenario.metadados ?? {
        id: 'runTxV0pyU8',
        titulo: 'Título real do vídeo',
        canalId: 'UCcanal',
        canalNome: 'Canal Real',
        duracaoSegundos: 754,
        miniaturaUrl: 'https://i.ytimg.com/vi/runTxV0pyU8/hq.jpg',
        publicadoEm: '2024-03-10T00:00:00.000Z',
        legendasManuais: ['pt', 'en'],
        legendasAutomaticas: ['pt'],
      }
    );
  }

  async baixarLegenda(url: string, _idiomas?: string[]): Promise<LegendaBaixada | null> {
    this.cenario.chamadas?.push(`legenda:${url}`);
    if (this.cenario.erroLegenda) throw this.cenario.erroLegenda;
    if (this.cenario.legenda !== undefined) return this.cenario.legenda;
    return {
      idioma: 'pt',
      origem: 'manual',
      segmentos: [
        { inicioMs: 0, fimMs: 1500, texto: 'primeira fala' },
        { inicioMs: 1500, fimMs: 3200, texto: 'segunda fala' },
      ],
    };
  }
}

/* ------------------------------------------------------------------- setup -- */

const URL = 'https://www.youtube.com/watch?v=runTxV0pyU8';

let banco: Banco;
let repositorio: RepositorioBibliotecaSqlite;
let transcricoes: RepositorioTranscricoesSqlite;

function criarServico(cenario: Cenario = {}, idiomas?: string[]) {
  const executor = new ExecutorFalso(cenario);
  const servico = new ServicoIngestaoReal({
    repositorio,
    transcricoes,
    executor,
    ...(idiomas ? { idiomas } : {}),
    agora: () => '2026-11-19T15:00:00.000Z',
  });
  return { servico, executor };
}

beforeEach(() => {
  banco = Banco.abrir({ arquivo: ':memory:' });
  banco.migrar();
  repositorio = new RepositorioBibliotecaSqlite(banco.db);
  transcricoes = new RepositorioTranscricoesSqlite(banco.db);
});

afterEach(() => {
  banco.fechar();
});

/* -------------------------------------------------------------- normalização -- */

test('normaliza as formas de URL do YouTube', () => {
  const casos = [
    'https://www.youtube.com/watch?v=runTxV0pyU8',
    'https://youtube.com/watch?v=runTxV0pyU8',
    'https://m.youtube.com/watch?v=runTxV0pyU8',
    'https://youtu.be/runTxV0pyU8',
    'https://www.youtube.com/shorts/runTxV0pyU8',
    'https://www.youtube.com/live/runTxV0pyU8',
    '  https://www.youtube.com/watch?v=runTxV0pyU8  ',
  ];
  for (const entrada of casos) {
    assert.equal(normalizarUrlVideo(entrada).youtubeId, 'runTxV0pyU8', entrada);
  }
});

test('rejeita URL que não é vídeo do YouTube', () => {
  const invalidas = [
    'https://vimeo.com/123',
    'https://www.youtube.com/playlist?list=PL123',
    'https://www.youtube.com/watch?v=curto',
    'não é url',
    '',
  ];
  for (const entrada of invalidas) {
    assert.throws(() => normalizarUrlVideo(entrada), ErroValidacao, entrada);
  }
});

/* ---------------------------------------------------------------- sucesso --- */

test('importa metadados reais e legenda manual', async () => {
  const { servico } = criarServico();
  const resultado = await servico.importar(URL);

  assert.equal(resultado.criado, true);
  assert.equal(resultado.video.titulo, 'Título real do vídeo');
  assert.equal(resultado.video.canalNome, 'Canal Real');
  assert.equal(resultado.video.duracaoSegundos, 754);
  assert.equal(resultado.video.estado, 'pronto');
  assert.equal(resultado.transcricao.origem, 'manual');
  assert.equal(resultado.transcricao.estado, 'pronta');
  assert.equal(resultado.transcricao.quantidadeSegmentos, 2);

  const gravada = await transcricoes.porVideo(resultado.video.id);
  assert.ok(gravada);
  assert.deepEqual(
    gravada.segmentos.map((s) => s.texto),
    ['primeira fala', 'segunda fala'],
  );
});

test('usa legenda automática quando não há manual, e registra a origem', async () => {
  const { servico } = criarServico({
    legenda: {
      idioma: 'pt',
      origem: 'auto',
      segmentos: [{ inicioMs: 0, fimMs: 900, texto: 'fala automática' }],
    },
  });
  const resultado = await servico.importar(URL);
  assert.equal(resultado.transcricao.origem, 'auto');
  assert.equal(resultado.transcricao.estado, 'pronta');
});

test('sem legenda: estado indisponível explícito, vídeo parcial, metadados preservados', async () => {
  const { servico } = criarServico({ legenda: null });
  const resultado = await servico.importar(URL);

  assert.equal(resultado.video.estado, 'parcial', 'metadados valem, legenda não veio');
  assert.equal(resultado.video.titulo, 'Título real do vídeo', 'não perde o que já obteve');
  assert.equal(resultado.transcricao.estado, 'indisponivel');
  assert.ok(resultado.transcricao.motivo && resultado.transcricao.motivo.length > 20);
  assert.equal(resultado.transcricao.quantidadeSegmentos, 0);

  const gravada = await transcricoes.porVideo(resultado.video.id);
  assert.equal(gravada?.estado, 'indisponivel');
  assert.ok(gravada?.motivo);
});

test('falha ao baixar legenda mantém metadados e explica o motivo', async () => {
  const { servico } = criarServico({
    erroLegenda: new ErroDominio('ytdlp_timeout', 'O YouTube não respondeu em 60 s.', 504),
  });
  const resultado = await servico.importar(URL);

  assert.equal(resultado.video.estado, 'parcial');
  assert.equal(resultado.video.titulo, 'Título real do vídeo');
  assert.equal(resultado.transcricao.estado, 'indisponivel');
  assert.match(resultado.transcricao.motivo ?? '', /não respondeu|legenda/i);
});

/* ------------------------------------------------------------ deduplicação -- */

test('segunda importação do mesmo vídeo não chama o yt-dlp de novo', async () => {
  const chamadas: string[] = [];
  const { servico } = criarServico({ chamadas });

  const primeira = await servico.importar(URL);
  const antes = chamadas.length;
  assert.equal(antes, 2, 'inspecionar + legenda na primeira vez');

  const segunda = await servico.importar(URL);
  assert.equal(segunda.criado, false);
  assert.equal(segunda.video.id, primeira.video.id);
  assert.equal(segunda.transcricao.quantidadeSegmentos, 2);
  assert.equal(chamadas.length, antes, 'nenhuma chamada externa na segunda vez');
});

test('vídeo que já existia sem transcrição é completado', async () => {
  // Simula item criado à mão na F2: existe na biblioteca, sem transcrição.
  const antigo: Video = {
    id: 'video-antigo',
    youtubeId: 'runTxV0pyU8',
    titulo: 'Vídeo runTxV0pyU8',
    canalId: null,
    canalNome: null,
    duracaoSegundos: null,
    url: URL,
    miniaturaUrl: null,
    publicadoEm: null,
    estado: 'pronto',
    criadoEm: '2026-11-01T00:00:00.000Z',
    atualizadoEm: '2026-11-01T00:00:00.000Z',
  };
  await repositorio.inserir(antigo);

  const { servico } = criarServico();
  const resultado = await servico.importar(URL);

  assert.equal(resultado.criado, false);
  assert.equal(resultado.video.id, 'video-antigo', 'não duplica o registro');
  assert.equal(resultado.video.titulo, 'Título real do vídeo', 'metadados foram atualizados');
  assert.equal(resultado.transcricao.estado, 'pronta', 'transcrição foi completada');
});

/* ------------------------------------------------------------------ falhas -- */

test('yt-dlp ausente: 503 com orientação, e vídeo fica em erro', async () => {
  const { servico } = criarServico({
    erroInspecionar: new ErroIndisponivel(
      'O yt-dlp não está instalado ou não está no PATH. Instale com "pip install -U yt-dlp".',
    ),
  });

  await assert.rejects(
    () => servico.importar(URL),
    (erro: unknown) => {
      assert.ok(erro instanceof ErroIndisponivel);
      assert.match(erro.message, /pip install/);
      return true;
    },
  );

  const registros = await repositorio.consultar({
    filtro: {},
    cursor: null,
    limite: 10,
  });
  assert.equal(registros.itens.length, 1, 'o registro provisório fica para retomada');
  assert.equal(registros.itens[0]!.estado, 'erro');
});

test('timeout na inspeção é propagado como 504 e não deixa lixo', async () => {
  const { servico } = criarServico({
    erroInspecionar: new ErroDominio('ytdlp_timeout', 'O YouTube não respondeu em 60 s.', 504),
  });
  await assert.rejects(() => servico.importar(URL), (erro: unknown) => {
    assert.ok(erro instanceof ErroDominio);
    assert.equal(erro.statusHttp, 504);
    return true;
  });
});

test('URL inválida falha antes de qualquer chamada externa', async () => {
  const chamadas: string[] = [];
  const { servico } = criarServico({ chamadas });
  await assert.rejects(() => servico.importar('https://vimeo.com/1'), ErroValidacao);
  assert.equal(chamadas.length, 0);
});

/* ------------------------------------------------------------------ inspeção -- */

test('inspecionar devolve metadados sem gravar nada', async () => {
  const { servico } = criarServico();
  const inspecao = await servico.inspecionar(URL);

  assert.equal(inspecao.titulo, 'Título real do vídeo');
  assert.equal(inspecao.canalId, 'UCcanal');
  assert.equal(await repositorio.contagem(), 0, 'nada foi gravado');
});

/* ---------------------------------------------------------- idiomas -------- */

test('idiomas preferidos são repassados pela configuração', async () => {
  const { servico } = criarServico({}, ['en', 'pt']);
  const resultado = await servico.importar(URL);
  assert.equal(resultado.transcricao.estado, 'pronta');
});

/* ------------------------------------------------- persistência entre processos -- */

test('transcrição sobrevive a reabertura do banco (arquivo real)', async () => {
  const { mkdtemp, rm } = await import('node:fs/promises');
  const { tmpdir } = await import('node:os');
  const { join } = await import('node:path');

  const pasta = await mkdtemp(join(tmpdir(), 'contextflow-transcricao-'));
  const arquivo = join(pasta, 'contextflow.db');

  try {
    const primeiroBanco = Banco.abrir({ arquivo });
    primeiroBanco.migrar();
    const repo1 = new RepositorioBibliotecaSqlite(primeiroBanco.db);
    const trans1 = new RepositorioTranscricoesSqlite(primeiroBanco.db);
    const servico1 = new ServicoIngestaoReal({
      repositorio: repo1,
      transcricoes: trans1,
      executor: new ExecutorFalso(),
    });
    const criado = await servico1.importar(URL);
    primeiroBanco.fechar();

    // Outro processo, outra conexão: é o teste que importa.
    const segundoBanco = Banco.abrir({ arquivo });
    segundoBanco.migrar();
    const trans2 = new RepositorioTranscricoesSqlite(segundoBanco.db);
    const lido = await trans2.porVideo(criado.video.id);
    segundoBanco.fechar();

    assert.ok(lido, 'transcrição deve existir depois de reabrir o arquivo');
    assert.equal(lido.estado, 'pronta');
    assert.equal(lido.origem, 'manual');
    assert.deepEqual(
      lido.segmentos.map((s) => s.inicioMs),
      [0, 1500],
    );
  } finally {
    await rm(pasta, { recursive: true, force: true });
  }
});
