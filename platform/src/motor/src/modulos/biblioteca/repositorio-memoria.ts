/**
 * Implementação provisória em memória, usada na F1 para fechar o esqueleto com teste.
 * Ela existe para validar o contrato — será substituída na F2 pela persistente.
 */
import type { IdVideo, Video } from '@contextflow/compartilhado';
import type { FiltroBiblioteca, PaginaBiblioteca, RepositorioBiblioteca } from './repositorio.ts';

export class RepositorioBibliotecaMemoria implements RepositorioBiblioteca {
  private porIdMapa = new Map<IdVideo, Video>();

  async inserir(video: Video): Promise<void> {
    if (this.porIdMapa.has(video.id)) throw new Error(`vídeo duplicado por id: ${video.id}`);
    for (const existente of this.porIdMapa.values()) {
      if (existente.youtubeId === video.youtubeId) {
        throw new Error(`vídeo duplicado por youtubeId: ${video.youtubeId}`);
      }
    }
    this.porIdMapa.set(video.id, { ...video });
  }

  async atualizar(video: Video): Promise<void> {
    if (!this.porIdMapa.has(video.id)) throw new Error(`vídeo inexistente: ${video.id}`);
    this.porIdMapa.set(video.id, { ...video });
  }

  async porId(id: IdVideo): Promise<Video | null> {
    const v = this.porIdMapa.get(id);
    return v ? { ...v } : null;
  }

  async porYoutubeId(youtubeId: string): Promise<Video | null> {
    for (const v of this.porIdMapa.values()) if (v.youtubeId === youtubeId) return { ...v };
    return null;
  }

  async consultar(opcoes: { filtro: FiltroBiblioteca; cursor: string | null; limite: number }): Promise<PaginaBiblioteca> {
    const { filtro, cursor, limite } = opcoes;
    const todos = [...this.porIdMapa.values()]
      .filter((v) => (!filtro.estado || v.estado === filtro.estado))
      .filter((v) => (!filtro.canalId || v.canalId === filtro.canalId))
      .filter((v) => {
        if (!filtro.busca) return true;
        const alvo = `${v.titulo} ${v.canalNome ?? ''}`.toLowerCase();
        return alvo.includes(filtro.busca.toLowerCase());
      })
      .filter((v) => (!filtro.colecaoId || (v.colecaoIds ?? []).includes(filtro.colecaoId)))
      .filter((v) => (filtro.temResumo === undefined || v.temResumo === filtro.temResumo))
      // Ordenação estável: criadoEm desc, id como desempate. Cursor depende disso.
      .sort((a, b) => {
        if (filtro.ordenacao) {
          const dir = filtro.ordenacaoDirecao === 'asc' ? 1 : -1;
          let cmp = 0;
          switch (filtro.ordenacao) {
            case 'titulo': cmp = a.titulo.localeCompare(b.titulo); break;
            case 'canal': cmp = (a.canalNome ?? '').localeCompare(b.canalNome ?? ''); break;
            case 'duracao': cmp = (a.duracaoSegundos ?? 0) - (b.duracaoSegundos ?? 0); break;
            case 'estado': cmp = a.estado.localeCompare(b.estado); break;
            default: cmp = a.criadoEm === b.criadoEm ? a.id.localeCompare(b.id) : a.criadoEm < b.criadoEm ? 1 : -1;
          }
          return cmp * dir;
        }
        return a.criadoEm === b.criadoEm ? a.id.localeCompare(b.id) : a.criadoEm < b.criadoEm ? 1 : -1;
      });

    let inicio = 0;
    if (cursor) {
      const indice = todos.findIndex((v) => v.id === cursor);
      if (indice < 0) throw new Error(`cursor inválido: ${cursor}`);
      inicio = indice + 1;
    }

    const itens = todos.slice(inicio, inicio + limite);
    const ultimo = itens.at(-1);
    const temMais = inicio + limite < todos.length;
    return { itens, proximoCursor: temMais && ultimo ? ultimo.id : null };
  }

  async contagem(): Promise<number> {
    return this.porIdMapa.size;
  }
}
