/**
 * Módulo `ingestao`: aceita links, inspeciona vídeo/playlist, obtém metadados e
 * legendas, e normaliza os segmentos com tempo.
 *
 * F1 declara o contrato. A implementação real (yt-dlp) entra na F3, em
 * `integracoes/ytdlp`, sem mudar as assinaturas abaixo.
 */
import { ErroIndisponivel, ErroValidacao } from '../../nucleo/erros.ts';

export interface ResultadoInspecao {
  youtubeId: string;
  titulo: string;
  canalId: string | null;
  canalNome: string | null;
  duracaoSegundos: number | null;
  miniaturaUrl: string | null;
  publicadoEm: string | null;
}

export interface ServicoIngestao {
  inspecionar(url: string): Promise<ResultadoInspecao>;
}

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
  }

  if (!id || !/^[A-Za-z0-9_-]{11}$/.test(id)) {
    throw new ErroValidacao('A URL não aponta para um vídeo válido do YouTube');
  }
  return { youtubeId: id, url: `https://www.youtube.com/watch?v=${id}` };
}

/** Implementação provisória: falha de forma explícita até a F3 existir. */
export class IngestaoIndisponivel implements ServicoIngestao {
  async inspecionar(): Promise<ResultadoInspecao> {
    throw new ErroIndisponivel('Ingestão ainda não implementada nesta fase (F1/F2).');
  }
}
