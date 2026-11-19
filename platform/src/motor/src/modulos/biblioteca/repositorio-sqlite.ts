/**
 * Repositório de biblioteca sobre SQLite.
 *
 * Implementa o MESMO contrato da F1 (`RepositorioBiblioteca`). A troca de
 * implementação não muda nada nos módulos consumidores.
 */
import type { IdVideo, Video } from '@contextflow/compartilhado';
import { ErroDominio } from '../../nucleo/erros.ts';
import type { Driver } from '../../persistencia/banco.ts';
import type { FiltroBiblioteca, PaginaBiblioteca, RepositorioBiblioteca } from './repositorio.ts';

interface LinhaVideo {
  id: string;
  youtube_id: string;
  titulo: string;
  canal_id: string | null;
  canal_nome: string | null;
  duracao_segundos: number | null;
  url: string;
  miniatura_url: string | null;
  publicado_em: string | null;
  estado: Video['estado'];
  criado_em: string;
  atualizado_em: string;
}

function paraVideo(linha: LinhaVideo): Video {
  return {
    id: linha.id,
    youtubeId: linha.youtube_id,
    titulo: linha.titulo,
    canalId: linha.canal_id,
    canalNome: linha.canal_nome,
    duracaoSegundos: linha.duracao_segundos,
    url: linha.url,
    miniaturaUrl: linha.miniatura_url,
    publicadoEm: linha.publicado_em,
    estado: linha.estado,
    criadoEm: linha.criado_em,
    atualizadoEm: linha.atualizado_em,
  };
}

const COLUNAS = `id, youtube_id, titulo, canal_id, canal_nome, duracao_segundos, url,
                 miniatura_url, publicado_em, estado, criado_em, atualizado_em`;

export class RepositorioBibliotecaSqlite implements RepositorioBiblioteca {
  private readonly db: Driver;

  constructor(db: Driver) {
    this.db = db;
  }

  async inserir(video: Video): Promise<void> {
    try {
      this.db
        .prepare(
          `INSERT INTO videos (${COLUNAS}) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
        )
        .run(
          video.id,
          video.youtubeId,
          video.titulo,
          video.canalId,
          video.canalNome,
          video.duracaoSegundos,
          video.url,
          video.miniaturaUrl,
          video.publicadoEm,
          video.estado,
          video.criadoEm,
          video.atualizadoEm,
        );
    } catch (erro) {
      const mensagem = erro instanceof Error ? erro.message : String(erro);
      if (mensagem.includes('UNIQUE constraint failed: videos.youtube_id')) {
        throw new ErroDominio('video_duplicado', `Vídeo já existe: ${video.youtubeId}`, 409);
      }
      if (mensagem.includes('UNIQUE constraint failed: videos.id')) {
        throw new ErroDominio('id_duplicado', `Identificador já usado: ${video.id}`, 409);
      }
      throw erro;
    }
  }

  async atualizar(video: Video): Promise<void> {
    this.atualizarSincrono(video);
  }

  /** Usado pela unidade de persistencia em transacao sincrona. */
  atualizarSincrono(video: Video): void {
    const resultado = this.db
      .prepare(
        `UPDATE videos SET youtube_id=?, titulo=?, canal_id=?, canal_nome=?, duracao_segundos=?,
         url=?, miniatura_url=?, publicado_em=?, estado=?, atualizado_em=? WHERE id=?`,
      )
      .run(
        video.youtubeId,
        video.titulo,
        video.canalId,
        video.canalNome,
        video.duracaoSegundos,
        video.url,
        video.miniaturaUrl,
        video.publicadoEm,
        video.estado,
        video.atualizadoEm,
        video.id,
      );
    if (resultado.changes === 0) throw new ErroDominio('nao_encontrado', `Vídeo inexistente: ${video.id}`, 404);
  }

  async porId(id: IdVideo): Promise<Video | null> {
    const linha = this.db.prepare(`SELECT ${COLUNAS} FROM videos WHERE id = ?`).get(id) as unknown as LinhaVideo | undefined;
    return linha ? paraVideo(linha) : null;
  }

  async porYoutubeId(youtubeId: string): Promise<Video | null> {
    const linha = this.db.prepare(`SELECT ${COLUNAS} FROM videos WHERE youtube_id = ?`).get(youtubeId) as unknown as LinhaVideo | undefined;
    return linha ? paraVideo(linha) : null;
  }

  /**
   * Consulta paginada por cursor (keyset) — não por OFFSET.
   * O cursor é o par (criado_em, id), o que mantém a ordem estável mesmo com
   * inserções concorrentes e não desloca páginas.
   */
  async consultar(opcoes: {
    filtro: FiltroBiblioteca;
    cursor: string | null;
    limite: number;
  }): Promise<PaginaBiblioteca> {
    const { filtro, cursor, limite } = opcoes;
    const condicoes: string[] = [];
    const params: unknown[] = [];

    if (filtro.estado) {
      condicoes.push('estado = ?');
      params.push(filtro.estado);
    }
    if (filtro.canalId) {
      condicoes.push('canal_id = ?');
      params.push(filtro.canalId);
    }
    if (filtro.busca) {
      condicoes.push('(titulo LIKE ? OR canal_nome LIKE ?)');
      const alvo = `%${filtro.busca}%`;
      params.push(alvo, alvo);
    }

    if (cursor) {
      const referencia = this.db
        .prepare('SELECT criado_em, id FROM videos WHERE id = ?')
        .get(cursor) as unknown as { criado_em: string; id: string } | undefined;
      if (!referencia) throw new ErroDominio('cursor_invalido', `Cursor inválido: ${cursor}`, 422);
      condicoes.push('(criado_em < ? OR (criado_em = ? AND id > ?))');
      params.push(referencia.criado_em, referencia.criado_em, referencia.id);
    }

    const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    // Pede limite+1 para saber se existe próxima página sem consulta extra.
    const linhas = this.db
      .prepare(`SELECT ${COLUNAS} FROM videos ${onde} ORDER BY criado_em DESC, id ASC LIMIT ?`)
      .all(...(params as never[]), limite + 1) as unknown as LinhaVideo[];

    const temMais = linhas.length > limite;
    const itens = linhas.slice(0, limite).map(paraVideo);
    return { itens, proximoCursor: temMais ? (itens.at(-1)?.id ?? null) : null };
  }

  async contagem(): Promise<number> {
    const linha = this.db.prepare('SELECT COUNT(*) AS n FROM videos').get() as unknown as { n: number };
    return linha.n;
  }
}
