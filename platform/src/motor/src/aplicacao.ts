import { gravarResultadoIngestao, escreverResultadoIngestao } from './persistencia/resultado-ingestao.ts';
/**
 * Montagem do aplicativo: única função que conhece todos os módulos.
 *
 * Este é o ponto onde o monólito modular é "costurado". Nenhum módulo importa
 * outro módulo diretamente: eles recebem dependências por aqui.
 */
import { createHash, randomUUID } from 'node:crypto';
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
import { extrairVideos } from './modulos/ingestao/extrair-videos.ts';
import { RepositorioTranscricoesSqlite } from './persistencia/repositorio-transcricoes.ts';
import { Ytdlp, type ExecutorYtdlp } from './integracoes/ytdlp.ts';
import { FilaTrabalhos, validarIdiomas } from './modulos/trabalhos/servico.ts';
import { RepositorioTrabalhos } from './persistencia/repositorio-trabalhos.ts';
import { ServicoResumos, revisaoTranscricao } from './modulos/resumos/servico.ts';
import { ConfiguracaoResumos, PROVEDORES } from './modulos/resumos/configuracao.ts';
import { ClienteProvedor } from './modulos/resumos/provedores.ts';
import type { ServicoConfiguracao } from './modulos/configuracao/servico.ts';
import { RepositorioMiniaturas } from './persistencia/repositorio-miniaturas.ts';
import { ServicoMiniaturas } from './modulos/miniaturas/servico.ts';
import { ServicoReparoMiniaturas } from './modulos/miniaturas/reparo.ts';

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
  /** Transporte de capas injetável; produção usa fetch nativo. */
  httpMiniaturas?: typeof fetch;
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
  /**
   * Miniaturas: copia local da capa. O projeto usa `--skip-download`, então
   * sem isso a capa era sempre a URL do CDN — que expira e deixa a linha sem
   * imagem. A pasta fica na pasta de dados, junto do banco, e continua fora do
   * Git.
   */
  const miniaturas = new ServicoMiniaturas({
    http: opcoes.httpMiniaturas,
    pastaDados: config.pastaDados,
    repositorio: new RepositorioMiniaturas(banco.db),
    buscarUrlDoVideo: async videoId => repositorioBiblioteca.porId(videoId),
    registrarErro: (mensagem, detalhe) => registrador.aviso('miniaturas', { mensagem, detalhe: String(detalhe) }),
  });
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
    configurarResumoAoImportar: () => resumos.configurarAoImportar(),
    criarResumo: async entrada => {
      const lote = await resumos.gerar({ ...entrada, videoIds: entrada.videoIds ?? [entrada.videoId] });
      if (!lote.trabalhos[0]) throw new ErroDominio('resumo_existente', 'Este resumo já está pronto e foi preservado.', 409);
      return repositorioTrabalhos.detalhe(lote.trabalhos[0].id);
    },
    processar: async (r, escopo, sinal) => {
      const concluirImportacao = (resultado: import('./modulos/ingestao/servico.ts').ResultadoIngestao, gravar?: () => void) => {
        const t = resultado.transcricao;
        repositorioTrabalhos.concluir(r, resultado, () => {
          gravar?.();
          if (escopo.resumoAutomatico) {
            const transcricao = repositorioTranscricoes.porVideoSincrono(resultado.video.id);
            resultado.resumoAutomatico = resumos.enfileirarAoImportar(escopo.resumoAutomatico, resultado.video, transcricao);
          }
        }, t.erroCodigo ? { codigo: t.erroCodigo, mensagem: t.motivo!, status: t.erroHttp } : undefined);
      };
      const resultado = await ingestao.importar(escopo.url!, escopo.idiomas, {
        sinal, retomar: true,
        verificar: () => repositorioTrabalhos.conferir(r),
        fase: fase => repositorioTrabalhos.fase(r, fase),
        // A URL já está durável no trabalho; não criar vídeo Importando sem conteúdo.
        provisionar: () => repositorioTrabalhos.conferir(r),
        marcarErro: video => repositorioTrabalhos.conferirEGravar(r, () => {
          if (repositorioBiblioteca.porYoutubeIdSincrono(video.youtubeId)?.id === video.id) repositorioBiblioteca.atualizarSincrono(video);
        }),
        persistirResultado: (video, transcricao, resultado) => concluirImportacao(resultado, () => {
          if (!repositorioBiblioteca.porYoutubeIdSincrono(video.youtubeId)) repositorioBiblioteca.inserirSincrono(video);
          escreverResultadoIngestao(banco, video, transcricao);
        }),
      });
      // Para um vídeo já importado, a ingestão pode reutilizar a transcrição sem gravar novamente.
      if (escopo.resumoAutomatico && repositorioTrabalhos.registro(r.id).estado === 'executando') {
        concluirImportacao(resultado);
      }
      return resultado;
    },
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
      // A capa local substitui a URL remota quando já existe cópia. A lista
      // não dispara download: só aponta para o que já foi buscado.
      miniaturas.aplicarEmVideos(pagina.itens);
      return pagina;
    })
    .obter('/api/biblioteca/playlists', () => biblioteca.listarPlaylists())
    .obter('/api/biblioteca/canais', () => biblioteca.listarCanais())
    .obter('/api/biblioteca/meses', () => biblioteca.listarMeses())
    .obter('/api/biblioteca/:id', async ({ requisicao }) => {
      const id = requisicao.caminho.split('/').at(-1)!;
      const video = await biblioteca.obter(id);
      miniaturas.aplicarEmVideos([video]);
      return video;
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
    /*
     * Ciclo de vida completo da coleção (F6-B, item 8).
     *
     * A distinção que a interface precisa deixar clara e o servidor garante:
     *   PATCH  = renomear (nada sai do lugar);
     *   DELETE = excluir a COLEÇÃO (vídeos continuam na biblioteca);
     *   DELETE /videos/:videoId = desvincular UM vídeo;
     *   DELETE /videos = esvaziar (desvincula todos, mantém a coleção).
     * Nenhuma delas apaga vídeo, transcrição ou resumo.
     */
    .obter('/api/colecoes/:id', async ({ requisicao }) => {
      return biblioteca.obterColecao(requisicao.caminho.split('/')[3]!);
    })
    .patchar('/api/colecoes/:id', async ({ requisicao }) => {
      const id = requisicao.caminho.split('/')[3]!;
      const corpo = requisicao.corpo as { titulo?: unknown } | undefined;
      if (typeof corpo?.titulo !== 'string' || !corpo.titulo.trim()) {
        throw new ErroValidacao('Título da coleção obrigatório.');
      }
      return biblioteca.renomearColecao(id, corpo.titulo);
    })
    .remover('/api/colecoes/:id', async ({ requisicao }) => {
      const id = requisicao.caminho.split('/')[3]!;
      const resultado = await biblioteca.excluirColecao(id);
      registrador.info('coleção excluída', { id, desvinculados: resultado.desvinculados });
      return resultado;
    })
    .remover('/api/colecoes/:id/videos', async ({ requisicao }) => {
      const id = requisicao.caminho.split('/')[3]!;
      const resultado = await biblioteca.esvaziarColecao(id);
      registrador.info('coleção esvaziada', { id, removidos: resultado.removidos });
      return resultado;
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
      const entrada = corpo as Record<string, unknown>;
      const { texto, ...escopo } = entrada;
      if ('texto' in entrada && 'urls' in entrada) throw new ErroValidacao('Envie texto ou URLs, uma opção por vez.');
      const extraido = 'texto' in entrada ? extrairVideos(texto) : null;
      const trabalho = await trabalhos.criar('importar-lote', extraido ? { ...escopo, urls: extraido.urls } : escopo);
      return new ResultadoHttp(extraido ? { ...trabalho, lote: extraido.lote } : trabalho, 202, { location: `/api/trabalhos/${trabalho.id}` });
    })
    /*
     * Histórico de importações: contagens por categoria e limpeza.
     *
     * Limpar o histórico NÃO apaga vídeo, transcrição nem resumo — só a
     * entrada de fila. Vídeo, transcrição e resumo têm seus próprios comandos
     * (remover da Biblioteca, reimportar). Registrar isso aqui é o que impede
     * tratar as duas coisas como sinônimos.
     */
    .obter('/api/trabalhos/historico/resumo', () => repositorioTrabalhos.historicoResumo())
    .remover('/api/trabalhos/historico', async ({ requisicao }) => {
      const corpo = requisicao.corpo as { estados?: unknown } | undefined;
      const estados = Array.isArray(corpo?.estados) ? corpo.estados.filter((e): e is string => typeof e === 'string') : [];
      if (!estados.length) throw new ErroValidacao('Informe os estados a limpar (concluido, falhou, cancelado).');
      const resultado = repositorioTrabalhos.limparHistorico(estados);
      registrador.info('histórico de importações limpo', resultado);
      return resultado;
    })
    /*
     * Remoção de UM trabalho do histórico.
     *
     * ORDEM IMPORTA: esta rota fica DEPOIS de `/api/trabalhos/historico`.
     * O roteador casa por caminho, então `:id` captura a palavra "historico"
     * e a limpeza por categoria nunca seria alcançada (foi o que a suíte
     * pegou: 404 em vez de 422/200). Rota literal sempre antes de curinga.
     *
     * Remover do histórico NÃO apaga vídeo, coleção nem arquivo baixado.
     * Trabalho ativo é recusado com 409 — cancelar é operação explícita.
     */
    .remover('/api/trabalhos/:id', async ({ requisicao }) => {
      const id = requisicao.caminho.split('/')[3]!;
      const resultado = repositorioTrabalhos.removerDoHistorico(id);
      registrador.info('trabalho removido do histórico', { id, filhos: resultado.filhos });
      return resultado;
    })
    .obter('/api/trabalhos', ({ requisicao }) => repositorioTrabalhos.pagina({
      ativos: requisicao.consulta.get('ativos') === '1',
      raizes: requisicao.consulta.get('raizes') === '1', estado: requisicao.consulta.get('estado') ?? undefined, cursor: requisicao.consulta.get('cursor') ?? undefined,
      limite: Number(requisicao.consulta.get('limite') ?? 50),
    }))
    .obter('/api/trabalhos/:id', ({ requisicao }) => repositorioTrabalhos.detalhe(requisicao.caminho.split('/')[3]!))
    .obter('/api/trabalhos/:id/itens', ({ requisicao }) => repositorioTrabalhos.pagina({
      paiId: requisicao.caminho.split('/')[3]!, cursor: requisicao.consulta.get('cursor') ?? undefined,
      estado: requisicao.consulta.get('estado') ?? undefined,
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
    /*
     * Reparo em lote de miniaturas (F6-B, parte D-2).
     *
     * Varre a biblioteca e tenta recuperar as capas que faltam, usando o MESMO
     * serviço da recuperação individual (`garantir`) — com o limite de
     * tentativas, a deduplicação e os candidatos que a F6-A definiu. Nenhuma
     * URL é inferida para fonte que não seja YouTube.
     *
     * Por que síncrona: o relatório é a informação útil ("3 recuperadas, 2 sem
     * candidato"). Criar um tipo de trabalho só para isto faria o usuário caçar
     * o resultado em Importações, e a operação é limitada pela quantidade de
     * vídeos sem capa — pequena por definição, já que o caminho normal
     * (`garantir`) roda na importação.
     *
     * `forcar: true` refaz até quem já tem imagem (arte trocada na origem);
     * é decisão explícita do usuário, nunca padrão.
     */
    .postar('/api/miniaturas/reparar', async ({ requisicao }) => {
      const forcar = (requisicao.corpo as { forcar?: unknown } | undefined)?.forcar === true;
      const servico = new ServicoReparoMiniaturas({
        // A listagem varre os ids na ordem padrão. `limite: 200` cabe no que
        // `consultar` aceita (máximo 500) e mantém o cursor pequeno.
        listarVideoIds: async ({ cursor, limite }) => {
          const pagina = await biblioteca.consultar({ cursor: cursor ?? undefined, limite: String(limite) });
          return { ids: pagina.itens.map((v) => v.id), proximoCursor: pagina.proximoCursor ?? null };
        },
        // `forcar` do REPARO não é o mesmo do `garantir`.
        //
        // `garantir(id, { forcar })` com forcar=false retorna cedo quando já
        // existe arquivo — e retornar cedo é `ok: true`. Passar `forcar: true`
        // para rebaixar capas boas seria errado. Então:
        //   - vídeo sem cópia local: `forcar: false` (caminho normal de busca);
        //   - vídeo com cópia e `forcar` pedido: `forcar: true` (refaz).
        // O filtro de quem entra na varredura é `temCopiaLocal` abaixo.
        garantir: (videoId, opcoes) => miniaturas.garantir(videoId, opcoes),
        temCopiaLocal: (videoId) => miniaturas.temCopiaLocal(videoId),
        /*
         * Quem pode ser tentado.
         *
         * `youtube_id` é obrigatório no schema, então "tem youtubeId" não
         * distingue nada — todo vídeo tem. O que decide é haver candidato
         * legítimo: ou a capa é do CDN, ou é um caminho local (sem host, logo
         * derivável do youtubeId). Uma URL absoluta de outro host é a fonte
         * que o usuário importou: a spec proíbe inventar candidato para ela,
         * e tentar de novo só gastaria uma das três tentativas.
         */
        podeTentar: async (videoId) => {
          const video = await biblioteca.obter(videoId);
          if (!video.youtubeId || !/^[A-Za-z0-9_-]{11}$/.test(video.youtubeId)) return false;
          const registro = miniaturas.temCopiaLocal(videoId);
          if (registro) return true;
          const capa = video.miniaturaUrl;
          if (!capa) return true; // sem capa informada: nada a inferir, será declarado
          try {
            const host = new URL(capa).hostname;
            return host === 'ytimg.com' || host.endsWith('.ytimg.com');
          } catch {
            return true; // caminho local: derivável
          }
        },
        aoProgredir: (estado) => registrador.debug('reparo de miniaturas', estado),
      });
      const resultado = await servico.reparar({ forcar });
      registrador.info('reparo de miniaturas concluído', {
        total: resultado.total, recuperados: resultado.recuperados, falhas: resultado.falhas.length,
      });
      return resultado;
    })
    .postar('/api/miniaturas/:id/buscar', async ({ requisicao }) => {
      const id = requisicao.caminho.split('/').at(-2)!;
      await biblioteca.obter(id); // 404 se o vídeo não existe
      // `forcar` só quando o cliente pede: reimportação troca a URL e merece
      // nova tentativa; a rolagem normal não.
      const forcar = (requisicao.corpo as { forcar?: unknown } | undefined)?.forcar === true;
      const resultado = await miniaturas.garantir(id, { forcar });
      return new ResultadoHttp(
        { videoId: id, ok: resultado.ok, motivo: resultado.ok ? null : resultado.motivo ?? 'indisponível',
          miniaturaUrl: miniaturas.urlPublica(id) },
        resultado.ok ? 200 : 404,
      );
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
    // Imagem é binária: o roteador sempre responde JSON, então a miniatura é
    // servida aqui, antes dele.
    const miniatura = /^\/api\/miniaturas\/([^/]+)$/.exec(caminho);
    if (miniatura && req.method === 'GET') {
      void miniaturas.bytes(decodeURIComponent(miniatura[1]!)).then((achado) => {
        if (!achado) {
          res.writeHead(404, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
          res.end(JSON.stringify({ ok: false, erro: { codigo: 'sem_miniatura', mensagem: 'Miniatura ainda não foi baixada.' } }));
          return;
        }
        const etag = `"${createHash('sha256').update(achado.dados).digest('hex')}"`;
        res.setHeader('cache-control', 'private, no-cache');
        res.setHeader('etag', etag);
        if (req.headers['if-none-match'] === etag) {
          res.writeHead(304); res.end(); return;
        }
        res.writeHead(200, {
          'content-type': achado.contentType,
          // A rota é estável por vídeo; revalidar permite recuperar/trocar a capa.
          'content-length': achado.dados.length,
        });
        res.end(achado.dados);
      }).catch(() => {
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' });
        res.end('falha ao ler miniatura');
      });
      return;
    }
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
