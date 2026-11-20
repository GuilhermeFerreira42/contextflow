/**
 * Contrato do repositório de biblioteca.
 *
 * A persistência real (SQLite/arquivo + migrações) entra na F2. Aqui o contrato é
 * declarado e uma implementação em memória permite fechar F1 com teste real.
 * Trocar a implementação NÃO pode mudar este contrato.
 */
import type { IdVideo, Video } from '@contextflow/compartilhado';

export interface FiltroBiblioteca {
  busca?: string;
  estado?: Video['estado'];
  canalId?: string;
  /** F5: filtro por coleção (usa LIKE no JSON array). */
  colecaoId?: string;
  /** F5: filtro por presença de resumo. */
  temResumo?: boolean;
  /** F5: campo de ordenação. */
  ordenacao?: 'criado_em' | 'titulo' | 'canal' | 'duracao' | 'estado';
  /** F5: direção da ordenação. */
  ordenacaoDirecao?: 'asc' | 'desc';
}

export interface PaginaBiblioteca {
  itens: Video[];
  /** Cursor opaco para a próxima página; null quando acabou. */
  proximoCursor: string | null;
}

export interface RepositorioBiblioteca {
  inserir(video: Video): Promise<void>;
  atualizar(video: Video): Promise<void>;
  porId(id: IdVideo): Promise<Video | null>;
  porYoutubeId(youtubeId: string): Promise<Video | null>;
  consultar(opcoes: { filtro: FiltroBiblioteca; cursor: string | null; limite: number }): Promise<PaginaBiblioteca>;
  contagem(): Promise<number>;
}
