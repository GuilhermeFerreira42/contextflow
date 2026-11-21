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
  /** F5: filtro por vínculo exato com uma coleção. */
  colecaoId?: string;
  playlistId?: string;
  /** F5: filtro por presença de resumo. */
  temResumo?: boolean;
  /**
   * F5-UI: recorte por data de importação, usado pela árvore lateral
   * ("Data de importação" → Novembro 2026). ISO 8601, intervalo semiaberto
   * `[inicio, fim)`. Aditivo: quem não passar continua vendo tudo.
   */
  importadoDe?: string;
  importadoAte?: string;
  /** F5: campo de ordenação. */
  ordenacao?: 'criado_em' | 'titulo' | 'canal' | 'duracao' | 'estado';
  /** F5: direção da ordenação. */
  ordenacaoDirecao?: 'asc' | 'desc';
}

export interface PaginaBiblioteca {
  itens: Video[];
  total: number;
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
  remover(id: IdVideo): Promise<void>;
}

export const CAMPOS_ORDENACAO = ['criado_em', 'titulo', 'canal', 'duracao', 'estado'] as const;
export function ordemBiblioteca(filtro: FiltroBiblioteca) {
  const campo = filtro.ordenacao ?? 'criado_em';
  const direcao = filtro.ordenacaoDirecao ?? (campo === 'criado_em' ? 'desc' : 'asc');
  return { campo, direcao };
}

const compararTexto = (a: string, b: string) => {
  const ascii = (v: string) => v.replace(/[A-Z]/g, c => c.toLowerCase());
  const x = ascii(a), y = ascii(b);
  return x < y ? -1 : x > y ? 1 : 0;
};
export function compararVideos(a: Video, b: Video, filtro: FiltroBiblioteca): number {
  const { campo, direcao } = ordemBiblioteca(filtro);
  let principal: number;
  switch (campo) {
    case 'titulo': principal = compararTexto(a.titulo, b.titulo); break;
    case 'canal': principal = compararTexto(a.canalNome ?? '', b.canalNome ?? ''); break;
    case 'duracao': principal = (a.duracaoSegundos ?? -1) - (b.duracaoSegundos ?? -1); break;
    case 'estado': principal = compararTexto(a.estado, b.estado); break;
    default: principal = a.criadoEm < b.criadoEm ? -1 : a.criadoEm > b.criadoEm ? 1 : 0;
  }
  if (principal) return principal * (direcao === 'asc' ? 1 : -1);
  if (a.criadoEm !== b.criadoEm) return a.criadoEm > b.criadoEm ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}
