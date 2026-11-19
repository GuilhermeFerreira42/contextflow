/**
 * Módulo `ingestao`: aceita links, inspeciona vídeo, obtém metadados e legendas,
 * e grava o resultado na biblioteca junto com a transcrição segmentada.
 *
 * Este módulo **não** fala com o processo externo: quem faz isso é o adaptador
 * `integracoes/ytdlp`, injetado no construtor. Nos testes, o adaptador é um
 * dublê — a regra de negócio é testada sem rede.
 */
import { randomUUID } from 'node:crypto';

import type { OrigemTranscricao, SegmentoTranscricao, Video } from '@contextflow/compartilhado';
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
}

export interface ResultadoIngestao {
  video: Video;
  transcricao: TranscricaoResumo;
  /** Falso quando o vídeo já existia: a importação foi uma reapresentação. */
  criado: boolean;
}

export interface ServicoIngestao {
  inspecionar(url: string): Promise<ResultadoInspecao>;
  importar(url: string, idiomas?: string[]): Promise<ResultadoIngestao>;
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

  async importar(url: string, idiomas?: string[]): Promise<ResultadoIngestao> {
    const { url: normalizada, youtubeId } = normalizarUrlVideo(url);
    const agora = this.#agora();

    // Deduplicação antes de qualquer chamada externa: se o vídeo já está na
    // biblioteca, importar de novo não deve custar rede nem tempo.
    const existente = await this.#repositorio.porYoutubeId(youtubeId);
    if (existente) {
      const transcricao = await this.#transcricoes.porVideo(existente.id);
      if (transcricao) {
        return {
          video: existente,
          transcricao: {
            idioma: transcricao.idioma,
            origem: transcricao.origem,
            estado: transcricao.estado === 'pronta' ? 'pronta' : 'indisponivel',
            quantidadeSegmentos: transcricao.segmentos.length,
            motivo: transcricao.motivo,
          },
          criado: false,
        };
      }
      // Existe sem transcrição (importação antiga da F2): completa agora.
      return this.#concluirIngestao(existente, normalizada, idiomas ?? this.#idiomas, agora, false);
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
      await this.#repositorio.inserir(provisionado);
    } catch (erro) {
      // Corrida: outro processo inseriu o mesmo youtubeId entre a consulta e o insert.
      if (erro instanceof ErroDominio && erro.codigo === 'video_duplicado') {
        const outro = await this.#repositorio.porYoutubeId(youtubeId);
        if (outro) {
          return this.#concluirIngestao(outro, normalizada, idiomas ?? this.#idiomas, agora, false);
        }
      }
      throw erro;
    }

    return this.#concluirIngestao(provisionado, normalizada, idiomas ?? this.#idiomas, agora, true);
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
  ): Promise<ResultadoIngestao> {
    let metadados: MetadadosYtdlp;
    try {
      metadados = await this.#executor.inspecionar(url);
    } catch (erro) {
      await this.#marcarErro(video, erro, agora);
      throw erro;
    }

    let legenda: LegendaBaixada | null = null;
    let motivoLegenda: string | null = null;

    try {
      legenda = await this.#executor.baixarLegenda(url, idiomas);
      if (!legenda) {
        motivoLegenda = 'Este vídeo não tem legenda, nem manual nem automática.';
      }
    } catch (erro) {
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

    if (legenda) {
      await this.#gravarTranscricao(atualizado, legenda, agora);
      return {
        video: atualizado,
        transcricao: {
          idioma: legenda.idioma,
          origem: legenda.origem,
          estado: 'pronta',
          quantidadeSegmentos: legenda.segmentos.length,
          motivo: null,
        },
        criado,
      };
    }

    await this.#gravarTranscricaoIndisponivel(atualizado, motivoLegenda!, agora, idiomas[0] ?? 'pt-BR');
    return {
      video: atualizado,
      transcricao: {
        idioma: idiomas[0] ?? 'pt-BR',
        origem: 'auto',
        estado: 'indisponivel',
        quantidadeSegmentos: 0,
        motivo: motivoLegenda,
      },
      criado,
    };
  }

  async #gravarTranscricao(
    video: Video,
    legenda: LegendaBaixada,
    agora: string,
  ): Promise<void> {
    this.#persistirResultado(video, {
      videoId: video.id,
      idioma: legenda.idioma,
      origem: legenda.origem,
      estado: 'pronta',
      motivo: null,
      segmentos: legenda.segmentos,
      atualizadoEm: agora,
    });
  }

  async #gravarTranscricaoIndisponivel(
    video: Video,
    motivo: string,
    agora: string,
    idioma: string,
  ): Promise<void> {
    this.#persistirResultado(video, {
      videoId: video.id,
      idioma,
      origem: 'auto',
      estado: 'indisponivel',
      motivo,
      segmentos: [] as SegmentoTranscricao[],
      atualizadoEm: agora,
    });
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
