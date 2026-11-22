/**
 * Miniaturas para a interface.
 *
 * A interface pede `GET /api/miniaturas/:id` (imagem) e a listagem já vem com
 * `miniaturaUrl` apontando para essa rota quando existe cópia local. Assim a
 * linha não faz requisição ao YouTube nem depende de URL assinada que expira.
 *
 * Política de busca — deliberadamente conservadora:
 *  - só tenta quando a UI pede (`POST .../buscar`) ou quando a listagem precisa
 *    e o registro ainda não tem falha registrada;
 *  - no máximo `MAXIMO_TENTATIVAS` tentativas por vídeo;
 *  - uma busca por vídeo em andamento no máximo (Mapa de promessas).
 */
import type { RepositorioMiniaturas } from '../../persistencia/repositorio-miniaturas.ts';
import {
  baixarMiniatura, lerMiniaturaLocal, pastaMiniaturas,
} from '../../integracoes/miniaturas.ts';

export const MAXIMO_TENTATIVAS = 3;
export const ROTA_MINIATURA = '/api/miniaturas';

export interface ServicoMiniaturasDeps {
  pastaDados: string;
  repositorio: RepositorioMiniaturas;
  buscarUrlDoVideo: (videoId: string) => Promise<{ miniaturaUrl: string | null; youtubeId?: string } | null>;
  http?: typeof fetch;
  registrarErro?: (mensagem: string, detalhe?: unknown) => void;
}

export class ServicoMiniaturas {
  #deps: ServicoMiniaturasDeps;
  #emAndamento = new Map<string, Promise<{ ok: boolean; motivo?: string }>>();

  constructor(deps: ServicoMiniaturasDeps) {
    this.#deps = deps;
  }

  /** URL pública da miniatura, ou `null` se não há cópia local. */
  urlPublica(videoId: string): string | null {
    const registro = this.#deps.repositorio.obter(videoId);
    return registro?.arquivo ? `${ROTA_MINIATURA}/${encodeURIComponent(videoId)}` : null;
  }

  /**
   * Reescreve `miniaturaUrl` numa página de biblioteca.
   *
   * Regras: se há cópia local, a URL passa a ser a nossa. Se a cópia falhou
   * definitivamente, `null` (a UI mostra o substituto e não gasta requisição).
   * Caso contrário mantém a remota — a UI tenta e, no erro, pede a busca.
   */
  aplicarEmVideos<T extends { id: string; miniaturaUrl: string | null }>(videos: T[]): T[] {
    for (const video of videos) {
      const registro = this.#deps.repositorio.obter(video.id);
      if (registro?.arquivo) {
        video.miniaturaUrl = `${ROTA_MINIATURA}/${encodeURIComponent(video.id)}`;
      } else if (registro?.falha && registro.tentativas >= MAXIMO_TENTATIVAS) {
        video.miniaturaUrl = null;
      }
    }
    return videos;
  }

  /**
   * Garante uma cópia local, baixando se necessário.
   *
   * `forcar` ignora falhas anteriores — usado quando o usuário reimporta o
   * vídeo (a URL muda) ou pede explicitamente.
   */
  async garantir(videoId: string, { forcar = false } = {}): Promise<{ ok: boolean; motivo?: string }> {
    const emAndamento = this.#emAndamento.get(videoId);
    if (emAndamento) return emAndamento;

    const promessa = this.#garantirInterno(videoId, forcar).finally(() => {
      this.#emAndamento.delete(videoId);
    });
    this.#emAndamento.set(videoId, promessa);
    return promessa;
  }

  async #garantirInterno(videoId: string, forcar: boolean): Promise<{ ok: boolean; motivo?: string }> {
    const registro = this.#deps.repositorio.obter(videoId);

    // Já temos arquivo: confirma que ele ainda existe no disco (o usuário pode
    // ter limpado a pasta de dados).
    if (registro?.arquivo) {
      const dados = await lerMiniaturaLocal(this.#deps.pastaDados, registro.arquivo);
      if (dados && !forcar) return { ok: true };
      if (!dados) this.#deps.repositorio.remover(videoId);
    }

    if (!forcar && registro?.falha && registro.tentativas >= MAXIMO_TENTATIVAS) {
      return { ok: false, motivo: registro.falha };
    }

    // Reaproveita a URL já importada; não executa yt-dlp nem baixa vídeo.
    let origem = registro?.origem ?? null;
    let url = await this.#urlRemota(videoId, origem);
    if (!url) {
      // Sem URL e sem registro de falha do CDN: não há capa conhecida.
      this.#deps.repositorio.registrarFalha(videoId, 'vídeo sem miniatura conhecida');
      return { ok: false, motivo: 'sem miniatura' };
    }
    const candidatos = [url];
    const video = await this.#deps.buscarUrlDoVideo(videoId);
    const id = video?.youtubeId;
    let host = '';
    try { host = new URL(url).hostname; } catch { /* baixarMiniatura registra a URL inválida */ }
    if (id && /^[A-Za-z0-9_-]{11}$/.test(id) && (host === 'ytimg.com' || host.endsWith('.ytimg.com'))) {
      candidatos.push(`https://i.ytimg.com/vi/${id}/maxresdefault.jpg`, `https://i.ytimg.com/vi/${id}/hqdefault.jpg`);
    }
    let resultado: { ok: boolean; motivo?: string } = { ok: false, motivo: 'sem miniatura' };
    for (const candidato of new Set(candidatos)) {
      if (!forcar && (this.#deps.repositorio.obter(videoId)?.tentativas ?? 0) >= MAXIMO_TENTATIVAS) break;
      resultado = await baixarMiniatura(this.#deps.pastaDados, this.#deps.repositorio, videoId, candidato, this.#deps.http);
      if (resultado.ok) return resultado;
    }
    return resultado;
  }

  /** Lê a URL remota. Guardada em `videos.miniatura_url`; o deps decide como. */
  async #urlRemota(videoId: string, _origem: string | null): Promise<string | null> {
    try {
      const video = await this.#deps.buscarUrlDoVideo(videoId);
      const url = video?.miniaturaUrl ?? null;
      if (!url) return null;
      return url;
    } catch (erro) {
      this.#deps.registrarErro?.('falha ao ler URL de miniatura', erro);
      return null;
    }
  }

  /** Lê os bytes para servir a rota. */
  async bytes(videoId: string): Promise<{ dados: Buffer; contentType: string } | null> {
    const registro = this.#deps.repositorio.obter(videoId);
    if (!registro?.arquivo || !registro.contentType) return null;
    const dados = await lerMiniaturaLocal(this.#deps.pastaDados, registro.arquivo);
    if (!dados) {
      // Arquivo sumiu: some do índice para a próxima leitura não insistir.
      this.#deps.repositorio.remover(videoId);
      return null;
    }
    return { dados, contentType: registro.contentType };
  }

  get pasta(): string {
    return pastaMiniaturas(this.#deps.pastaDados);
  }
}
