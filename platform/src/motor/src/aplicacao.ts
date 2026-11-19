/**
 * Montagem do aplicativo: única função que conhece todos os módulos.
 *
 * Este é o ponto onde o monólito modular é "costurado". Nenhum módulo importa
 * outro módulo diretamente: eles recebem dependências por aqui.
 */
import { createServer, type Server } from 'node:http';
import type { Preferencias } from '@contextflow/compartilhado';
import type { ConfigMotor } from './nucleo/configuracao.ts';
import { criarServidorApi, Roteador } from './nucleo/http.ts';
import { criarRegistrador, type Registrador } from './nucleo/registro.ts';
import { lerArquivoPublico, servirEstatico } from './nucleo/estatico.ts';
import { ServicoBiblioteca } from './modulos/biblioteca/servico.ts';
import { RepositorioBibliotecaMemoria } from './modulos/biblioteca/repositorio-memoria.ts';
import { IngestaoIndisponivel, normalizarUrlVideo } from './modulos/ingestao/servico.ts';
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
  encerrar(): Promise<void>;
}

export function criarAplicacao(config: ConfigMotor): Aplicacao {
  const registrador = criarRegistrador(config.ambiente === 'teste' ? 'erro' : 'info');

  // Dependências dos módulos — trocadas por implementações reais nas fatias seguintes.
  const repositorioBiblioteca = new RepositorioBibliotecaMemoria();
  const biblioteca = new ServicoBiblioteca(repositorioBiblioteca);
  const ingestao = new IngestaoIndisponivel();

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
        biblioteca: 'memoria',
        ingestao: 'indisponivel',
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
    .postar('/api/ingestao/validar', ({ requisicao }) => {
      const corpo = requisicao.corpo as { url?: unknown } | undefined;
      if (!corpo || typeof corpo.url !== 'string') {
        return { valido: false, motivo: 'Campo "url" ausente ou não textual' };
      }
      const { youtubeId, url } = normalizarUrlVideo(corpo.url);
      // A inspeção de metadados chega na F3; aqui só validamos e normalizamos.
      return { valido: true, youtubeId, urlNormalizada: url };
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
    encerrar: () =>
      new Promise<void>((ok) => {
        servidor.close(() => ok());
        servidor.closeAllConnections?.();
      }),
  };
}
