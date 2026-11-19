import { gravarResultadoIngestao } from './persistencia/resultado-ingestao.ts';
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
import { criarServidorApi, Roteador } from './nucleo/http.ts';
import { ErroValidacao } from './nucleo/erros.ts';
import { criarRegistrador, type Registrador } from './nucleo/registro.ts';
import { lerArquivoPublico, servirEstatico } from './nucleo/estatico.ts';
import { ServicoBiblioteca } from './modulos/biblioteca/servico.ts';
import { RepositorioBibliotecaSqlite } from './modulos/biblioteca/repositorio-sqlite.ts';
import { Banco } from './persistencia/banco.ts';
import { ServicoIngestaoReal, normalizarUrlVideo } from './modulos/ingestao/servico.ts';
import { RepositorioTranscricoesSqlite } from './persistencia/repositorio-transcricoes.ts';
import { Ytdlp, type ExecutorYtdlp } from './integracoes/ytdlp.ts';
import type { ServicoTrabalhos } from './modulos/trabalhos/servico.ts';
import type { ServicoResumos } from './modulos/resumos/servico.ts';
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
  /** Abre o banco e aplica migrações; separado do listen para testes controlarem o ciclo. */
  iniciarPersistencia(): number;
  encerrar(): Promise<void>;
}

export interface OpcoesAplicacao {
  /**
   * Injetável para teste: substitui o yt-dlp por um dublê. Em produção fica
   * indefinido e o adaptador real é criado com o binário do PATH.
   */
  executorYtdlp?: ExecutorYtdlp;
}

export function criarAplicacao(config: ConfigMotor, opcoes: OpcoesAplicacao = {}): Aplicacao {
  const registrador = criarRegistrador(config.ambiente === 'teste' ? 'erro' : 'info');

  // Persistência: aberta por iniciarPersistencia(), para o teste controlar o ciclo.
  const banco = Banco.abrir({ arquivo: Banco.arquivoPadrao(config.pastaDados) });
  const repositorioBiblioteca = new RepositorioBibliotecaSqlite(banco.db);
  const biblioteca = new ServicoBiblioteca(repositorioBiblioteca);

  const repositorioTranscricoes = new RepositorioTranscricoesSqlite(banco.db);
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

  const trabalhos = null as ServicoTrabalhos | null;
  const resumos = null as ServicoResumos | null;
  const configuracao = null as ServicoConfiguracao | null;

  const roteador = new Roteador()
    .obter('/api/saude', () => ({
      versao: VERSAO_API,
      ambiente: config.ambiente,
      plataforma: process.platform,
      node: process.version,
      pastaDados: config.pastaDados,
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
      const pagina = await biblioteca.consultar({
        busca: consulta.get('busca') ?? undefined,
        estado: consulta.get('estado') ?? undefined,
        canalId: consulta.get('canalId') ?? undefined,
        cursor: consulta.get('cursor') ?? undefined,
        limite: consulta.get('limite') ?? undefined,
      });
      return { ...pagina, total: await biblioteca.total() };
    })
    .obter('/api/biblioteca/:id', async ({ requisicao }) => {
      const id = requisicao.caminho.split('/').at(-1)!;
      return biblioteca.obter(id);
    })
    .obter('/api/configuracoes', () => preferenciasPadrao(config))
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
      const idiomas =
        Array.isArray(corpo.idiomas) && corpo.idiomas.every((i) => typeof i === 'string')
          ? (corpo.idiomas as string[])
          : undefined;
      const resultado = await ingestao.importar(corpo.url, idiomas);
      registrador.info('ingestão concluída', {
        youtubeId: resultado.video.youtubeId,
        estado: resultado.video.estado,
        origemLegenda: resultado.transcricao.origem,
        segmentos: resultado.transcricao.quantidadeSegmentos,
        criado: resultado.criado,
      });
      return resultado;
    })
    .obter('/api/biblioteca/:id/transcricao', async ({ requisicao }) => {
      const partes = requisicao.caminho.split('/');
      const id = partes.at(-2)!;
      await biblioteca.obter(id); // 404 se o vídeo não existe
      const transcricao = await repositorioTranscricoes.porVideo(id);
      return transcricao ?? { videoId: id, idioma: '', origem: 'auto', estado: 'pendente', segmentos: [], motivo: 'Transcrição ainda não importada.', atualizadoEm: '' };
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
    iniciarPersistencia: () => {
      const aplicadas = banco.migrar();
      registrador.info('persistência pronta', {
        arquivo: Banco.arquivoPadrao(config.pastaDados),
        migracoesAplicadas: aplicadas,
        versaoSchema: banco.versaoAtual(),
      });
      return aplicadas;
    },
    encerrar: () =>
      new Promise<void>((ok) => {
        servidor.close(() => ok());
        servidor.closeAllConnections?.();
        banco.fechar();
      }),
  };
}
