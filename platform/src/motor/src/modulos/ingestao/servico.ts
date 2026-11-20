/**
 * Módulo `ingestao`: aceita links, inspeciona vídeo, obtém metadados e legendas,
 * e grava o resultado na biblioteca junto com a transcrição segmentada.
 *
 * Este módulo **não** fala com o processo externo: quem faz isso é o adaptador
 * `integracoes/ytdlp`, injetado no construtor. Nos testes, o adaptador é um
 * dublê — a regra de negócio é testada sem rede.
 */
import { randomUUID } from 'node:crypto';

import type { OrigemTranscricao, Video } from '@contextflow/compartilhado';
import { ErroDominio, ErroValidacao } from '../../nucleo/erros.ts';
import type { ExecutorYtdlp, LegendaBaixada, MetadadosYtdlp } from '../../integracoes/ytdlp.ts';
import type { RepositorioBiblioteca } from '../biblioteca/repositorio.ts';
import type { RepositorioTranscricoes, TranscricaoGravavel } from '../../persistencia/repositorio-transcricoes.ts';

export interface ResultadoInspecao {
  youtubeId: string;
  titulo: string;
  canalId: string | null;
  canalNome: string | null;
  duracaoSegundos: number | null;
  miniaturaUrl: string | null;
  publicadoEm: string | null;
}

export interface TranscricaoResumo {
  idioma: string;
  origem: OrigemTranscricao;
  estado: 'pronta' | 'indisponivel';
  quantidadeSegmentos: number;
  motivo: string | null;
  erroCodigo?: string | null;
  erroHttp?: number;
}

export interface ResultadoIngestao {
  video: Video;
  transcricao: TranscricaoResumo;
  /** Falso quando o vídeo já existia: a importação foi uma reapresentação. */
  criado: boolean;
}

export interface ExecucaoIngestao {
  sinal?: AbortSignal;
  fase?: (fase: string) => void;
  verificar?: () => void;
  provisionar?: (video: Video) => void;
  marcarErro?: (video: Video) => void;
  persistirResultado?: (video: Video, transcricao: TranscricaoGravavel, resultado: ResultadoIngestao) => void;
  retomar?: boolean;
}

export interface ServicoIngestao {
  inspecionar(url: string): Promise<ResultadoInspecao>;
  importar(url: string, idiomas?: string[], execucao?: ExecucaoIngestao): Promise<ResultadoIngestao>;
}

// ------------------------------------------------------------- normalização ---

/** Normaliza e valida uma URL de vídeo do YouTube; rejeita o que não é vídeo. */
export function normalizarUrlVideo(entrada: string): { youtubeId: string; url: string } {
  let url: URL;
  try {
    url = new URL(entrada.trim());
  } catch {
    throw new ErroValidacao('URL inválida: informe um endereço completo do YouTube');
  }

  const hosts = new Set(['youtube.com', 'www.youtube.com', 'm.youtube.com', 'youtu.be']);
  if (!hosts.has(url.hostname)) {
    throw new ErroValidacao('Domínio não suportado: use URLs do YouTube');
  }

  let id: string | null = null;
  if (url.hostname === 'youtu.be') {
    id = url.pathname.slice(1).split('/')[0] ?? null;
  } else if (url.pathname === '/watch') {
    id = url.searchParams.get('v');
  } else if (url.pathname.startsWith('/shorts/')) {
    id = url.pathname.split('/')[2] ?? null;
  } else if (url.pathname.startsWith('/live/')) {
    id = url.pathname.split('/')[2] ?? null;
  }

  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    throw new ErroValidacao('A URL não aponta para um vídeo válido do YouTube');
  }
  return { youtubeId: id, url: `https://www.youtube.com/watch?v=${id}` };
}

const IDIOMAS_PADRAO = ['pt-BR', 'pt', 'en'];

// ----------------------------------------------------------------- serviço ---

export interface OpcoesServicoIngestao {
  repositorio: RepositorioBiblioteca;
  transcricoes: RepositorioTranscricoes;
  executor: ExecutorYtdlp;
  persistirResultado: (video: Video, transcricao: TranscricaoGravavel) => void;
  idiomas?: string[];
  agora?: () => string;
}

export class ServicoIngestaoReal implements ServicoIngestao {
  readonly #repositorio: RepositorioBiblioteca;
  readonly #transcricoes: RepositorioTranscricoes;
  readonly #executor: ExecutorYtdlp;
  readonly #idiomas: string[];
  readonly #agora: () => string;
  readonly #persistirResultado: OpcoesServicoIngestao['persistirResultado'];

  constructor(opcoes: OpcoesServicoIngestao) {
    this.#repositorio = opcoes.repositorio;
    this.#transcricoes = opcoes.transcricoes;
    this.#executor = opcoes.executor;
    this.#persistirResultado = opcoes.persistirResultado;
    this.#idiomas = opcoes.idiomas ?? IDIOMAS_PADRAO;
    this.#agora = opcoes.agora ?? (() => new Date().toISOString());
  }

  /** Só metadados: usado pelo botão "Validar URL" quando se quer prévia. */
  async inspecionar(url: string): Promise<ResultadoInspecao> {
    const { url: normalizada } = normalizarUrlVideo(url);
    const metadados = await this.#executor.inspecionar(normalizada);
    return {
      youtubeId: metadados.id,
      titulo: metadados.titulo,
      canalId: metadados.canalId,
      canalNome: metadados.canalNome,
      duracaoSegundos: metadados.duracaoSegundos,
      miniaturaUrl: metadados.miniaturaUrl,
      publicadoEm: metadados.publicadoEm,
    };
  }

  async importar(url: string, idiomas?: string[], execucao: ExecucaoIngestao = {}): Promise<ResultadoIngestao> {
    const { url: normalizada, youtubeId } = normalizarUrlVideo(url);
    const agora = this.#agora();
    this.#verificar(execucao);

    // Deduplicação antes de qualquer chamada externa: se o vídeo já está na
    // biblioteca, importar de novo não deve custar rede nem tempo.
    const existente = await this.#repositorio.porYoutubeId(youtubeId);
    if (existente) {
      const transcricao = await this.#transcricoes.porVideo(existente.id);
      if (transcricao && !(execucao.retomar && transcricao.estado !== 'pronta' && transcricao.codigoMotivo !== 'sem_legenda')) {
        return {
          video: existente,
          transcricao: {
            idioma: transcricao.idioma,
            origem: transcricao.origem,
            estado: transcricao.estado === 'pronta' ? 'pronta' : 'indisponivel',
            quantidadeSegmentos: transcricao.segmentos.length,
            motivo: transcricao.motivo,
            ...(transcricao.codigoMotivo && transcricao.codigoMotivo !== 'sem_legenda' ? { erroCodigo: transcricao.codigoMotivo } : {}),
          },
          criado: false,
        };
      }
      // Existe sem transcrição (importação antiga da F2): completa agora.
      return this.#concluirIngestao(existente, normalizada, idiomas ?? this.#idiomas, agora, false, execucao);
    }

    const provisionado: Video = {
      id: randomUUID(),
      youtubeId,
      titulo: `Vídeo ${youtubeId}`,
      canalId: null,
      canalNome: null,
      duracaoSegundos: null,
      url: normalizada,
      miniaturaUrl: null,
      publicadoEm: null,
      estado: 'importando',
      criadoEm: agora,
      atualizadoEm: agora,
    };

    try {
      // O registro provisório garante que um crash no meio não perca a URL:
      // o usuário vê o item em `importando` e pode tentar de novo.
      this.#verificar(execucao);
      if (execucao.provisionar) execucao.provisionar(provisionado);
      else await this.#repositorio.inserir(provisionado);
    } catch (erro) {
      // Corrida: outro processo inseriu o mesmo youtubeId entre a consulta e o insert.
      if (erro instanceof ErroDominio && erro.codigo === 'video_duplicado') {
        const outro = await this.#repositorio.porYoutubeId(youtubeId);
        if (outro) {
          return this.#concluirIngestao(outro, normalizada, idiomas ?? this.#idiomas, agora, false, execucao);
        }
      }
      throw erro;
    }

    return this.#concluirIngestao(provisionado, normalizada, idiomas ?? this.#idiomas, agora, true, execucao);
  }

  /**
   * Busca metadados e legenda e grava o resultado final.
   *
   * Nada fica pela metade: se os metadados chegam mas a legenda falha, o vídeo
   * é marcado `parcial` e a transcrição fica `indisponivel` com motivo — a
   * informação já obtida é preservada e o estado diz a verdade.
   */
  async #concluirIngestao(
    video: Video,
    url: string,
    idiomas: string[],
    agora: string,
    criado: boolean,
    execucao: ExecucaoIngestao,
  ): Promise<ResultadoIngestao> {
    let metadados: MetadadosYtdlp;
    try {
      this.#verificar(execucao); execucao.fase?.('metadados');
      metadados = await this.#executor.inspecionar(url, execucao.sinal);
    } catch (erro) {
      this.#verificar(execucao);
      if (execucao.marcarErro) execucao.marcarErro({ ...video, estado: 'erro', atualizadoEm: agora });
      else await this.#marcarErro(video, erro, agora);
      throw erro;
    }

    let legenda: LegendaBaixada | null = null;
    let motivoLegenda: string | null = null;
    let codigoMotivo: string | null = null;
    let erroHttp: number | undefined;

    try {
      this.#verificar(execucao); execucao.fase?.('legenda');
      legenda = await this.#executor.baixarLegenda(url, idiomas, execucao.sinal);
      if (!legenda) {
        motivoLegenda = 'Este vídeo não tem legenda, nem manual nem automática.';
        codigoMotivo = 'sem_legenda';
      }
    } catch (erro) {
      this.#verificar(execucao);
      if (erro instanceof ErroDominio && erro.codigo === 'trabalho_cancelado') throw erro;
      codigoMotivo = erro instanceof ErroDominio ? erro.codigo : 'ingestao_falhou';
      erroHttp = erro instanceof ErroDominio ? erro.statusHttp : 502;
      // Falha de legenda não descarta os metadados, mas precisa ser explícita.
      motivoLegenda =
        erro instanceof ErroDominio ? erro.message : 'Não foi possível obter a legenda.';
    }

    const atualizado: Video = {
      ...video,
      titulo: metadados.titulo,
      canalId: metadados.canalId,
      canalNome: metadados.canalNome,
      duracaoSegundos: metadados.duracaoSegundos,
      miniaturaUrl: metadados.miniaturaUrl,
      publicadoEm: metadados.publicadoEm,
      estado: legenda ? 'pronto' : 'parcial',
      atualizadoEm: agora,
    };

    this.#verificar(execucao); execucao.fase?.('gravacao');
    const gravavel: TranscricaoGravavel = {
      videoId: atualizado.id, idioma: legenda?.idioma ?? idiomas[0] ?? 'pt-BR',
      origem: legenda?.origem ?? 'auto', estado: legenda ? 'pronta' : 'indisponivel',
      motivo: motivoLegenda, codigoMotivo, segmentos: legenda?.segmentos ?? [], atualizadoEm: agora,
    };
    const resultado: ResultadoIngestao = {
      video: atualizado, criado,
      transcricao: { idioma: gravavel.idioma, origem: gravavel.origem,
        estado: legenda ? 'pronta' : 'indisponivel', quantidadeSegmentos: gravavel.segmentos.length,
        motivo: motivoLegenda, ...(codigoMotivo && codigoMotivo !== 'sem_legenda' ? { erroCodigo: codigoMotivo, erroHttp } : {}) },
    };
    if (execucao.persistirResultado) execucao.persistirResultado(atualizado, gravavel, resultado);
    else this.#persistirResultado(atualizado, gravavel);
    return resultado;
  }

  #verificar(execucao: ExecucaoIngestao): void {
    if (execucao.sinal?.aborted) throw new ErroDominio('trabalho_cancelado', 'Importação cancelada.', 409);
    execucao.verificar?.();
  }

  async #marcarErro(video: Video, erro: unknown, agora: string): Promise<void> {
    const mensagem = erro instanceof ErroDominio ? erro.message : 'A ingestão falhou.';
    try {
      await this.#repositorio.atualizar({ ...video, estado: 'erro', atualizadoEm: agora });
    } catch {
      // Se nem isso funciona, o erro original é o que importa para o usuário.
    }
    void mensagem;
  }
}

/** Implementação de F1 mantida para não quebrar importações antigas. */
export class IngestaoIndisponivel implements ServicoIngestao {
  async inspecionar(): Promise<ResultadoInspecao> {
    throw new ErroDominio('indisponivel', 'Ingestão não configurada.', 503);
  }
  async importar(): Promise<ResultadoIngestao> {
    throw new ErroDominio('indisponivel', 'Ingestão não configurada.', 503);
  }
}
