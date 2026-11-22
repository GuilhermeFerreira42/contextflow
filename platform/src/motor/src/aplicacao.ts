import { gravarResultadoIngestao, escreverResultadoIngestao } from './persistencia/resultado-ingestao.ts';
/**
 * Montagem do aplicativo: única função que conhece todos os módulos.
 *
 * Este é o ponto onde o monólito modular é "costurado". Nenhum módulo importa
 * outro módulo diretamente: eles recebem dependências por aqui.
 */
import { randomUUID } from 'node:crypto';
import { createServer, type Server } from 'node:http';
import type { Preferencias } from '@contextflow/compartilhado';
import type { ConfigMotor } from './nucleo/configuracao.ts';
import { criarServidorApi, Roteador, ResultadoHttp } from './nucleo/http.ts';
import { ErroDominio, ErroValidacao } from './nucleo/erros.ts';
import { criarRegistrador, type Registrador } from './nucleo/registro.ts';
import { lerArquivoPublico, servirEstatico } from './nucleo/estatico.ts';
import { RepositorioColecoes } from './persistencia/repositorio-colecoes.ts';
import { RepositorioResumosLeituraSqlite } from './persistencia/repositorio-resumos-leitura.ts';
import { ServicoBiblioteca } from './modulos/biblioteca/servico.ts';
import { RepositorioBibliotecaSqlite } from './modulos/biblioteca/repositorio-sqlite.ts';
import { Banco } from './persistencia/banco.ts';
import { ServicoIngestaoReal, normalizarUrlVideo } from './modulos/ingestao/servico.ts';
import { RepositorioTranscricoesSqlite } from './persistencia/repositorio-transcricoes.ts';
import { Ytdlp, type ExecutorYtdlp } from './integracoes/ytdlp.ts';
import { FilaTrabalhos, validarIdiomas } from './modulos/trabalhos/servico.ts';
import { RepositorioTrabalhos } from './persistencia/repositorio-trabalhos.ts';
import { ServicoResumos, revisaoTranscricao } from './modulos/resumos/servico.ts';
import { ConfiguracaoResumos, PROVEDORES } from './modulos/resumos/configuracao.ts';
import { ClienteProvedor } from './modulos/resumos/provedores.ts';
import type { ServicoConfiguracao } from './modulos/configuracao/servico.ts';

export const VERSAO_API = '0.1.0';

/** Preferências padrão enquanto a F8 não traz persistência de configuração. */
function preferenciasPadrao(config: ConfigMotor): Preferencias {
  return {
    tema: 'grafite',
    pastaDados: config.pastaDados,
    provedorResumo: null,
    modeloResumo: null,
    promptResumo: null,
  };
}

export interface Aplicacao {
  servidor: Server;
  config: ConfigMotor;
  registrador: Registrador;
  banco: Banco;
  trabalhos: FilaTrabalhos;
  /** Abre o banco e aplica migrações; separado do listen para testes controlarem o ciclo. */
  iniciarPersistencia(): number;
  encerrar(): Promise<void>;
}

export interface OpcoesAplicacao {
  /** Transporte injetável para testar contratos de IA sem serviços pagos. */
  httpIA?: typeof fetch;
  /**
   * Injetável para teste: substitui o yt-dlp por um dublê. Em produção fica
   * indefinido e o adaptador real é criado com o binário do PATH.
   */
  executorYtdlp?: ExecutorYtdlp;
  concorrencia?: number;
}

export function criarAplicacao(config: ConfigMotor, opcoes: OpcoesAplicacao = {}): Aplicacao {
  const registrador = criarRegistrador(config.ambiente === 'teste' ? 'erro' : 'info');

  // Persistência: aberta por iniciarPersistencia(), para o teste controlar o ciclo.
  const banco = Banco.abrir({ arquivo: Banco.arquivoPadrao(config.pastaDados) });
  const repositorioBiblioteca = new RepositorioBibliotecaSqlite(banco.db);
  const biblioteca = new ServicoBiblioteca(repositorioBiblioteca, {
    colecoes: new RepositorioColecoes(banco),
    reimportar: async (videos, chaveRequisicao) => (await trabalhos.criar('importar-lote', {urls:videos.map(v=>v.url),chaveRequisicao})).id,
    cancelarImportacoes: async youtubeId => {
      for (const id of repositorioTrabalhos.ativosDoVideo(youtubeId)) await trabalhos.cancelar(id);
    },
  });

  const repositorioTranscricoes = new RepositorioTranscricoesSqlite(banco.db);
  const repositorioResumosLeitura = new RepositorioResumosLeituraSqlite(banco.db);
  const executorYtdlp =
    opcoes.executorYtdlp ??
    new Ytdlp({
      registrarErro: (mensagem) =>
        registrador.aviso('yt-dlp', { detalhe: mensagem.split('\n').at(-1) ?? mensagem }),
    });
  const ingestao = new ServicoIngestaoReal({
    repositorio: repositorioBiblioteca,
    transcricoes: repositorioTranscricoes,
    executor: executorYtdlp,
    persistirResultado: (video, transcricao) => gravarResultadoIngestao(banco, video, transcricao),
    idiomas: config.idiomasLegenda,
  });

  const repositorioTrabalhos = new RepositorioTrabalhos(banco);
  const configuracaoResumos = new ConfiguracaoResumos(config.pastaDados);
  const resumos = new ServicoResumos({ banco, trabalhos: repositorioTrabalhos, configuracao: configuracaoResumos,
    videos: repositorioBiblioteca, transcricoes: repositorioTranscricoes,
    cliente: new ClienteProvedor(opcoes.httpIA) });
  const trabalhos = new FilaTrabalhos({
    repositorio: repositorioTrabalhos, executor: executorYtdlp,
    concorrencia: opcoes.concorrencia ?? Number(process.env.CONTEXTFLOW_CONCORRENCIA ?? 2),
    registrarErro: () => registrador.erro('Falha ao processar a fila.'),
    processarResumo: (r, sinal) => resumos.processar(r, sinal),
    falharResumo: (r, erro) => resumos.marcarErro(r, erro),
    criarResumo: async entrada => {
      const lote = await resumos.gerar({ ...entrada, videoIds: entrada.videoIds ?? [entrada.videoId] });
      if (!lote.trabalhos[0]) throw new ErroDominio('resumo_existente', 'Este resumo já está pronto e foi preservado.', 409);
      return repositorioTrabalhos.detalhe(lote.trabalhos[0].id);
    },
    processar: (r, escopo, sinal) => ingestao.importar(escopo.url!, escopo.idiomas, {
      sinal, retomar: true,
      verificar: () => repositorioTrabalhos.conferir(r),
      fase: fase => repositorioTrabalhos.fase(r, fase),
      // A URL já está durável no trabalho; não criar vídeo Importando sem conteúdo.
      provisionar: () => repositorioTrabalhos.conferir(r),
      marcarErro: video => repositorioTrabalhos.conferirEGravar(r, () => {
        if (repositorioBiblioteca.porYoutubeIdSincrono(video.youtubeId)?.id === video.id) repositorioBiblioteca.atualizarSincrono(video);
      }),
      persistirResultado: (video, transcricao, resultado) => repositorioTrabalhos.concluir(r, resultado,
        () => {
          if (!repositorioBiblioteca.porYoutubeIdSincrono(video.youtubeId)) repositorioBiblioteca.inserirSincrono(video);
          escreverResultadoIngestao(banco, video, transcricao);
        },
        resultado.transcricao.erroCodigo ? { codigo: resultado.transcricao.erroCodigo, mensagem: resultado.transcricao.motivo!, status: resultado.transcricao.erroHttp } : undefined),
    }),
  });
  const configuracao = null as ServicoConfiguracao | null;

  const roteador = new Roteador()
    .obter('/api/saude', () => ({
      versao: VERSAO_API,
      ambiente: config.ambiente,
      plataforma: process.platform,
      node: process.version,
      pastaDados: config.pastaDados,
      importacoesAtivas: repositorioTrabalhos.ativos(),
      modulos: {
        biblioteca: 'sqlite',
        ingestao: 'yt-dlp',
        trabalhos: trabalhos ? 'ativo' : 'pendente',
        resumos: resumos ? 'ativo' : 'pendente',
        configuracao: configuracao ? 'ativo' : 'pendente',
      },
    }))
    .obter('/api/biblioteca', async ({ requisicao }) => {
      const { consulta } = requisicao;
      if (consulta.has('temResumo') && !['0','1'].includes(consulta.get('temResumo')!)) throw new ErroValidacao('temResumo deve ser 0 ou 1.');
      const pagina = await biblioteca.consultar({
        busca: consulta.get('busca') ?? undefined,
        estado: consulta.get('estado') ?? undefined,
        canalId: consulta.get('canalId') ?? undefined,
        colecaoId: consulta.get('colecaoId') ?? undefined,
        playlistId: consulta.get('playlistId') ?? undefined,
        temResumo: consulta.get('temResumo') === '1' ? true : consulta.get('temResumo') === '0' ? false : undefined,
        importadoDe: consulta.get('importadoDe') ?? undefined,
        importadoAte: consulta.get('importadoAte') ?? undefined,
        ordenacao: consulta.get('ordenacao') ?? undefined,
        ordenacaoDirecao: consulta.get('ordenacaoDirecao') ?? undefined,
        cursor: consulta.get('cursor') ?? undefined,
        limite: consulta.get('limite') ?? undefined,
      });
      return pagina;
    })
    .obter('/api/biblioteca/playlists', () => biblioteca.listarPlaylists())
    .obter('/api/biblioteca/canais', () => biblioteca.listarCanais())
    .obter('/api/biblioteca/meses', () => biblioteca.listarMeses())
    .obter('/api/biblioteca/:id', async ({ requisicao }) => {
      const id = requisicao.caminho.split('/').at(-1)!;
      return biblioteca.obter(id);
    })
    .postar('/api/biblioteca/lote', async ({ requisicao }) => {
      const corpo = requisicao.corpo as { acao: import('@contextflow/compartilhado').AcaoLote; ids: string[]; colecaoId?: string; chaveRequisicao?: string } | undefined;
      if (!corpo || !corpo.acao || !Array.isArray(corpo.ids) || corpo.ids.length === 0) {
        throw new ErroValidacao('Informe acao e ids (array não vazio).');
      }
      if (!['reimportar', 'remover', 'colecao'].includes(corpo.acao)) {
        throw new ErroValidacao('Ação inválida: reimportar, remover ou colecao.');
      }
      if (corpo.acao === 'colecao' && !corpo.colecaoId) {
        throw new ErroValidacao('colecaoId obrigatório para ação "colecao".');
      }
      return biblioteca.acaoLote(corpo.acao, corpo.ids, corpo.colecaoId, corpo.chaveRequisicao);
    })
    .obter('/api/colecoes', async () => {
      return biblioteca.listarColecoes();
    })
    .postar('/api/colecoes', async ({ requisicao }) => {
      const corpo = requisicao.corpo as { titulo?: unknown } | undefined;
      if (!corpo || typeof corpo.titulo !== 'string' || corpo.titulo.trim().length === 0) {
        throw new ErroValidacao('Título da coleção obrigatório.');
      }
      return biblioteca.criarColecao(corpo.titulo.trim());
    })
    .postar('/api/colecoes/:id/videos', async ({ requisicao }) => {
      const id = requisicao.caminho.split('/')[3]!;
      const corpo = requisicao.corpo as { videoIds?: unknown } | undefined;
      if (!corpo || !Array.isArray(corpo.videoIds) || corpo.videoIds.length === 0) {
        throw new ErroValidacao('Informe videoIds (array não vazio).');
      }
      return biblioteca.adicionarVideosColecao(id, corpo.videoIds as string[]);
    })
    .remover('/api/colecoes/:id/videos/:videoId', async ({ requisicao }) => {
      const partes = requisicao.caminho.split('/');
      const id = partes[3]!;
      const videoId = partes[5]!;
      return biblioteca.removerVideoColecao(id, videoId);
    })
    .obter('/api/configuracoes', async () => {
      const ia = await configuracaoResumos.obter();
      return { ...preferenciasPadrao(config), provedorResumo: ia?.provedor ?? null, modeloResumo: ia?.modelo ?? null, promptResumo: ia?.prompt ?? null };
    })
    .obter('/api/resumos/provedores', () => ({ provedores: PROVEDORES }))
    .obter('/api/resumos/configuracao', () => configuracaoResumos.publica())
    .postar('/api/resumos/configuracao', ({ requisicao }) => configuracaoResumos.salvar(requisicao.corpo))
    .postar('/api/resumos/testar', () => resumos.testar())
    .postar('/api/resumos/estimar', ({ requisicao }) => resumos.estimar(requisicao.corpo))
    .postar('/api/resumos/gerar', async ({ requisicao }) => new ResultadoHttp(await resumos.gerar(requisicao.corpo), 202))
    .obter('/api/resumos/:videoId', ({ requisicao }) => resumos.historico(decodeURIComponent(requisicao.caminho.split('/').at(-1)!)))
    .postar('/api/biblioteca', async ({ requisicao }) => {
      // Ponto de escrita da biblioteca. Na F3 quem chama é o módulo de ingestão;
      // por enquanto permite criar um registro válido para provar persistência real.
      const corpo = requisicao.corpo as Record<string, unknown> | undefined;
      if (!corpo) throw new ErroValidacao('Corpo obrigatório');

      const youtubeId = typeof corpo.youtubeId === 'string' ? corpo.youtubeId.trim() : '';
      const titulo = typeof corpo.titulo === 'string' ? corpo.titulo.trim() : '';
      if (!/^[A-Za-z0-9_-]{11}$/.test(youtubeId)) {
        throw new ErroValidacao('youtubeId inválido: esperado 11 caracteres do YouTube');
      }
      if (titulo.length === 0 || titulo.length > 500) {
        throw new ErroValidacao('titulo obrigatório (1..500 caracteres)');
      }

      const agora = new Date().toISOString();
      const registro = {
        id: randomUUID(),
        youtubeId,
        titulo,
        canalId: typeof corpo.canalId === 'string' ? corpo.canalId : null,
        canalNome: typeof corpo.canalNome === 'string' ? corpo.canalNome : null,
        duracaoSegundos: typeof corpo.duracaoSegundos === 'number' ? corpo.duracaoSegundos : null,
        url: `https://www.youtube.com/watch?v=${youtubeId}`,
        miniaturaUrl: typeof corpo.miniaturaUrl === 'string' ? corpo.miniaturaUrl : null,
        publicadoEm: typeof corpo.publicadoEm === 'string' ? corpo.publicadoEm : null,
        estado: 'pronto' as const,
        criadoEm: agora,
        atualizadoEm: agora,
      };
      await repositorioBiblioteca.inserir(registro);
      return registro;
    })
    .postar('/api/ingestao/validar', ({ requisicao }) => {
      const corpo = requisicao.corpo as { url?: unknown } | undefined;
      if (!corpo || typeof corpo.url !== 'string') {
        return { valido: false, motivo: 'Campo "url" ausente ou não textual' };
      }
      // Validação puramente local: forma da URL e id do vídeo. Não chama rede,
      // para o botão responder na hora mesmo sem internet.
      const { youtubeId, url } = normalizarUrlVideo(corpo.url);
      return { valido: true, youtubeId, urlNormalizada: url };
    })
    .obter('/api/ingestao/diagnostico', async () => {
      const estado = await executorYtdlp.disponivel();
      return {
        ytdlp: estado,
        idiomas: config.idiomasLegenda,
        mensagem: estado.disponivel
          ? `yt-dlp ${estado.versao ?? ''} pronto`
          : 'yt-dlp não encontrado. A importação real exige o binário no PATH ou CONTEXTFLOW_YTDLP.',
      };
    })
    .postar('/api/ingestao/importar', async ({ requisicao }) => {
      const corpo = requisicao.corpo as { url?: unknown; idiomas?: unknown } | undefined;
      if (!corpo || typeof corpo.url !== 'string') {
        throw new ErroValidacao('Corpo obrigatório com o campo "url"');
      }
      const idiomas = validarIdiomas(corpo.idiomas);
      const trabalho = await trabalhos.criar('importar-video', { url: corpo.url, idiomas, chaveRequisicao: randomUUID() });
      const resultado = await trabalhos.aguardar(trabalho.id);
      registrador.info('ingestão concluída', {
        youtubeId: resultado.video.youtubeId,
        estado: resultado.video.estado,
        origemLegenda: resultado.transcricao.origem,
        segmentos: resultado.transcricao.quantidadeSegmentos,
        criado: resultado.criado,
      });
      return resultado;
    })
    .postar('/api/trabalhos', async ({ requisicao }) => {
      const corpo = requisicao.corpo as { tipo?: unknown; escopo?: unknown } | undefined;
      if (!corpo || typeof corpo.tipo !== 'string' || !corpo.escopo || typeof corpo.escopo !== 'object' || Array.isArray(corpo.escopo))
        throw new ErroValidacao('Informe tipo e escopo do trabalho.');
      const trabalho = await trabalhos.criar(corpo.tipo as import('@contextflow/compartilhado').TipoTrabalho, corpo.escopo as Record<string, unknown>);
      return new ResultadoHttp(trabalho, 202, { location: `/api/trabalhos/${trabalho.id}` });
    })
    .postar('/api/ingestao/lote', async ({ requisicao }) => {
      const corpo = requisicao.corpo;
      if (!corpo || typeof corpo !== 'object' || Array.isArray(corpo)) throw new ErroValidacao('Informe URLs e chaveRequisicao.');
      const trabalho = await trabalhos.criar('importar-lote', corpo as Record<string, unknown>);
      return new ResultadoHttp(trabalho, 202, { location: `/api/trabalhos/${trabalho.id}` });
    })
    .obter('/api/trabalhos', ({ requisicao }) => repositorioTrabalhos.pagina({
      raizes: requisicao.consulta.get('raizes') === '1', estado: requisicao.consulta.get('estado') ?? undefined, cursor: requisicao.consulta.get('cursor') ?? undefined,
      limite: Number(requisicao.consulta.get('limite') ?? 50),
    }))
    .obter('/api/trabalhos/:id', ({ requisicao }) => repositorioTrabalhos.detalhe(requisicao.caminho.split('/')[3]!))
    .obter('/api/trabalhos/:id/itens', ({ requisicao }) => repositorioTrabalhos.pagina({
      paiId: requisicao.caminho.split('/')[3]!, cursor: requisicao.consulta.get('cursor') ?? undefined,
      limite: Number(requisicao.consulta.get('limite') ?? 50),
    }))
    .postar('/api/trabalhos/:id/cancelar', async ({ requisicao }) => {
      const id = requisicao.caminho.split('/')[3]!; await trabalhos.cancelar(id);
      const trabalho = repositorioTrabalhos.detalhe(id);
      return new ResultadoHttp(trabalho, trabalho.estado === 'executando' ? 202 : 200);
    })
    .postar('/api/trabalhos/:id/repetir', async ({ requisicao }) => {
      const corpo = requisicao.corpo as { chaveRequisicao?: unknown } | undefined;
      const trabalho = await trabalhos.repetir(requisicao.caminho.split('/')[3]!, String(corpo?.chaveRequisicao ?? ''));
      return new ResultadoHttp(trabalho, trabalho.estado === 'na-fila' ? 202 : 200);
    })
    .obter('/api/biblioteca/:id/transcricao', async ({ requisicao }) => {
      const partes = requisicao.caminho.split('/');
      const id = partes.at(-2)!;
      await biblioteca.obter(id); // 404 se o vídeo não existe
      const transcricao = await repositorioTranscricoes.porVideo(id);
      return transcricao ?? { videoId: id, idioma: '', origem: 'auto', estado: 'pendente', segmentos: [], motivo: 'Transcrição ainda não importada.', atualizadoEm: '' };
    })
    .obter('/api/biblioteca/:id/resumo', async ({ requisicao }) => {
      const partes = requisicao.caminho.split('/');
      const id = partes.at(-2)!;
      await biblioteca.obter(id); // 404 se o vídeo não existe
      const resumo = await repositorioResumosLeitura.porVideo(id);
      if (!resumo) {
        // Sem resumo não é erro de servidor: é ausência declarada, e a F6 é
        // quem vai preencher. Devolver 404 aqui deixaria a interface confusa
        // entre "não existe" e "falhou".
        return { videoId: id, estado: 'pendente' as const, texto: null, provedor: null, modelo: null, atualizadoEm: null };
      }
      const transcricao = await repositorioTranscricoes.porVideo(id);
      return { ...resumo, desatualizado: transcricao ? revisaoTranscricao(transcricao) !== resumo.revisaoTranscricao : true };
    });

  const servidorApi = criarServidorApi(roteador, registrador);

  // O mesmo servidor atende API e interface: uma porta, uma origem, sem CORS.
  const servidor = createServer((req, res) => {
    const caminho = new URL(req.url ?? '/', 'http://localhost').pathname;
    if (caminho.startsWith('/api/')) {
      servidorApi.emit('request', req, res);
      return;
    }
    void servirEstatico(config.pastaInterface, caminho, res, () => lerArquivoPublico(config.pastaInterface, 'index.html'))
      .then((serviu) => {
        if (!serviu) {
          // Fallback de SPA: qualquer rota desconhecida devolve a interface.
          void lerArquivoPublico(config.pastaInterface, 'index.html')
            .then((html) => {
              res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
              res.end(html);
            })
            .catch(() => {
              res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
              res.end('Interface não encontrada');
            });
        }
      });
  });

  return {
    servidor,
    config,
    registrador,
    banco,
    trabalhos,
    iniciarPersistencia: () => {
      const aplicadas = banco.migrar();
      trabalhos.iniciar();
      registrador.info('persistência pronta', {
        arquivo: Banco.arquivoPadrao(config.pastaDados),
        migracoesAplicadas: aplicadas,
        versaoSchema: banco.versaoAtual(),
      });
      return aplicadas;
    },
    encerrar: async () => {
      const fechado = new Promise<void>(ok => servidor.close(() => ok()));
      servidor.closeAllConnections?.();
      await trabalhos.encerrar();
      await fechado;
      banco.fechar();
    },
  };
}
