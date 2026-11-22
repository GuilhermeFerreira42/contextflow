/**
 * Repositório de biblioteca sobre SQLite.
 *
 * Implementa o MESMO contrato da F1 (`RepositorioBiblioteca`). A troca de
 * implementação não muda nada nos módulos consumidores.
 */
import type { IdVideo, Video } from '@contextflow/compartilhado';
import { ErroDominio } from '../../nucleo/erros.ts';
import type { Driver } from '../../persistencia/banco.ts';
import { ordemBiblioteca, type FiltroBiblioteca, type PaginaBiblioteca, type RepositorioBiblioteca } from './repositorio.ts';

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
  tem_resumo: number;
  colecao_ids: string;
  resumo_estado?: Video['estadoResumo'];
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
    temResumo: Boolean(linha.tem_resumo),
    colecaoIds: linha.colecao_ids ? JSON.parse(linha.colecao_ids) : [],
    ...(linha.resumo_estado ? { estadoResumo: linha.resumo_estado } : {}),
  };
}

const COLUNAS = `id, youtube_id, titulo, canal_id, canal_nome, duracao_segundos, url,
                 miniatura_url, publicado_em, estado, criado_em, atualizado_em,
                 tem_resumo, colecao_ids,
                 (SELECT estado FROM resumos r WHERE r.video_id=videos.id
                  ORDER BY CASE r.estado WHEN 'pronto' THEN 0 WHEN 'processando' THEN 1 ELSE 2 END,
                  r.atualizado_em DESC LIMIT 1) AS resumo_estado`;

export class RepositorioBibliotecaSqlite implements RepositorioBiblioteca {
  private readonly db: Driver;

  constructor(db: Driver) {
    this.db = db;
  }

  async inserir(video: Video): Promise<void> { this.inserirSincrono(video); }

  inserirSincrono(video: Video): void {
    try {
      this.db
        .prepare(
          `INSERT INTO videos (id,youtube_id,titulo,canal_id,canal_nome,duracao_segundos,url,miniatura_url,publicado_em,estado,criado_em,atualizado_em) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
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

  async porYoutubeId(youtubeId: string): Promise<Video | null> { return this.porYoutubeIdSincrono(youtubeId); }

  porYoutubeIdSincrono(youtubeId: string): Video | null {
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
    if (filtro.colecaoId) {
      condicoes.push('EXISTS(SELECT 1 FROM colecao_videos cv WHERE cv.video_id=videos.id AND cv.colecao_id=?)');
      params.push(filtro.colecaoId);
    }
    if (filtro.playlistId) {
      condicoes.push(`EXISTS(SELECT 1 FROM trabalhos filho JOIN trabalhos pai ON filho.pai_id=pai.id
        WHERE filho.youtube_id=videos.youtube_id AND pai.tipo='importar-playlist' AND json_extract(pai.escopo,'$.url')=?)`);
      params.push(`https://www.youtube.com/playlist?list=${filtro.playlistId}`);
    }
    if (filtro.temResumo !== undefined) {
      condicoes.push('tem_resumo = ?');
      params.push(filtro.temResumo ? 1 : 0);
    }
    if (filtro.importadoDe) {
      condicoes.push('criado_em >= ?');
      params.push(filtro.importadoDe);
    }
    if (filtro.importadoAte) {
      condicoes.push('criado_em < ?');
      params.push(filtro.importadoAte);
    }

    const total = Number(this.db.prepare(`SELECT COUNT(*) n FROM videos ${condicoes.length ? 'WHERE '+condicoes.join(' AND ') : ''}`).get(...params as never[])!.n);
    const { campo, direcao } = ordemBiblioteca(filtro);
    const expressoes = { criado_em: 'criado_em', titulo: 'titulo COLLATE NOCASE',
      canal: "COALESCE(canal_nome,'') COLLATE NOCASE", duracao: 'COALESCE(duracao_segundos,-1)', estado: 'estado COLLATE NOCASE' };
    const expressao = expressoes[campo];
    if (!expressao) throw new ErroDominio('validacao', 'Ordenação inválida.', 422);
    const direcaoSql = direcao === 'asc' ? 'ASC' : 'DESC';
    const comparador = direcao === 'asc' ? '>' : '<';
    if (cursor) {
      const referencia = this.db.prepare(`SELECT id,criado_em,${expressao} AS valor FROM videos WHERE id=?`).get(cursor) as
        {id:string;criado_em:string;valor:string|number}|undefined;
      if (!referencia) throw new ErroDominio('cursor_invalido', 'Cursor inválido. Recarregue a consulta.', 422);
      if (campo === 'criado_em') {
        condicoes.push(`(criado_em ${comparador} ? OR (criado_em=? AND id>?))`);
        params.push(referencia.criado_em,referencia.criado_em,referencia.id);
      } else {
        condicoes.push(`((${expressao}) ${comparador} ? OR ((${expressao})=? AND (criado_em<? OR (criado_em=? AND id>?))))`);
        params.push(referencia.valor,referencia.valor,referencia.criado_em,referencia.criado_em,referencia.id);
      }
    }
    const onde = condicoes.length ? `WHERE ${condicoes.join(' AND ')}` : '';
    const ordenacao = `${expressao} ${direcaoSql}, ${campo === 'criado_em' ? '' : 'criado_em DESC, '}id ASC`;

    // Pede limite+1 para saber se existe próxima página sem consulta extra.
    const linhas = this.db
      .prepare(`SELECT ${COLUNAS} FROM videos ${onde} ORDER BY ${ordenacao} LIMIT ?`)
      .all(...(params as never[]), limite + 1) as unknown as LinhaVideo[];

    const temMais = linhas.length > limite;
    const itens = linhas.slice(0, limite).map(paraVideo);
    return { itens, total, proximoCursor: temMais ? (itens.at(-1)?.id ?? null) : null };
  }

  async remover(id: IdVideo): Promise<void> { this.db.prepare('DELETE FROM videos WHERE id=?').run(id); }

  async contagem(): Promise<number> {
    const linha = this.db.prepare('SELECT COUNT(*) AS n FROM videos').get() as unknown as { n: number };
    return linha.n;
  }
}
