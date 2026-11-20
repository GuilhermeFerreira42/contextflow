/**
 * Módulo `biblioteca`: dono dos vídeos, canais, coleções e consultas.
 * Não baixa nada e não chama IA — apenas mantém e consulta o catálogo.
 */
import { randomUUID } from 'node:crypto';
import type { Video, Colecao, AcaoLote } from '@contextflow/compartilhado';
import { ErroNaoEncontrado, ErroValidacao } from '../../nucleo/erros.ts';
import type { FiltroBiblioteca, PaginaBiblioteca, RepositorioBiblioteca } from './repositorio.ts';
import type { Driver } from '../../persistencia/banco.ts';

const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO = 500;

export class ServicoBiblioteca {
  private readonly repositorio: RepositorioBiblioteca;
  private readonly db: Driver | null;

  constructor(repositorio: RepositorioBiblioteca, db?: Driver | null) {
    this.repositorio = repositorio;
    this.db = db ?? null;
  }

  private requerDb(): Driver {
    if (!this.db) throw new ErroValidacao('Operação requer acesso ao banco de dados');
    return this.db;
  }

  async consultar(entrada: {
    busca?: string | undefined;
    estado?: string | undefined;
    canalId?: string | undefined;
    colecaoId?: string | undefined;
    temResumo?: boolean | undefined;
    ordenacao?: string | undefined;
    ordenacaoDirecao?: string | undefined;
    cursor?: string | undefined;
    limite?: string | undefined;
  }): Promise<PaginaBiblioteca> {
    const limite = entrada.limite === undefined ? LIMITE_PADRAO : Number.parseInt(entrada.limite, 10);
    if (!Number.isInteger(limite) || limite < 1 || limite > LIMITE_MAXIMO) {
      throw new ErroValidacao(`limite deve ser inteiro entre 1 e ${LIMITE_MAXIMO}`);
    }

    const filtro: FiltroBiblioteca = {
      ...(entrada.busca ? { busca: entrada.busca } : {}),
      ...(entrada.estado ? { estado: entrada.estado as Video['estado'] } : {}),
      ...(entrada.canalId ? { canalId: entrada.canalId } : {}),
      ...(entrada.colecaoId ? { colecaoId: entrada.colecaoId } : {}),
      ...(entrada.temResumo !== undefined ? { temResumo: entrada.temResumo } : {}),
      ...(entrada.ordenacao ? { ordenacao: entrada.ordenacao as FiltroBiblioteca['ordenacao'] } : {}),
      ...(entrada.ordenacaoDirecao ? { ordenacaoDirecao: entrada.ordenacaoDirecao as FiltroBiblioteca['ordenacaoDirecao'] } : {}),
    };

    return this.repositorio.consultar({ filtro, cursor: entrada.cursor ?? null, limite });
  }

  async obter(id: string): Promise<Video> {
    const video = await this.repositorio.porId(id);
    if (!video) throw new ErroNaoEncontrado(`Vídeo não encontrado: ${id}`);
    return video;
  }

  async total(): Promise<number> {
    return this.repositorio.contagem();
  }

  /** F5: ação em lote — reimportar, remover ou mover para coleção. */
  async acaoLote(acao: AcaoLote, ids: string[], colecaoId?: string): Promise<{ processados: number; falhas: Array<{ id: string; codigo: string; mensagem: string }> }> {
    const falhas: Array<{ id: string; codigo: string; mensagem: string }> = [];
    let processados = 0;

    for (const id of ids) {
      try {
        if (acao === 'reimportar') {
          const video = await this.repositorio.porId(id);
          if (!video) throw new ErroNaoEncontrado(`Vídeo não encontrado: ${id}`);
          processados++;
        } else if (acao === 'remover') {
          await this.repositorio.atualizar({ ...(await this.obter(id)), estado: 'erro' } as Video);
          processados++;
        } else if (acao === 'colecao' && colecaoId) {
          await this.adicionarVideosColecao(colecaoId, [id]);
          processados++;
        }
      } catch (erro) {
        falhas.push({
          id,
          codigo: erro instanceof ErroValidacao ? 'validacao' : erro instanceof ErroNaoEncontrado ? 'nao_encontrado' : 'erro_interno',
          mensagem: erro instanceof Error ? erro.message : 'Falha interna',
        });
      }
    }

    return { processados, falhas };
  }

  /** F5: lista todas as coleções com contagem de vídeos. */
  async listarColecoes(): Promise<{ itens: Colecao[] }> {
    const db = this.requerDb();
    const linhas = db.prepare(`
      SELECT c.id, c.titulo, COUNT(cv.video_id) AS contagem
      FROM colecoes c
      LEFT JOIN colecao_videos cv ON c.id = cv.colecao_id
      GROUP BY c.id, c.titulo
      ORDER BY c.titulo ASC
    `).all() as unknown as { id: string; titulo: string; contagem: number }[];

    return { itens: linhas.map(l => ({ id: l.id, titulo: l.titulo, contagem: l.contagem })) };
  }

  /** F5: cria uma nova coleção. */
  async criarColecao(titulo: string): Promise<Colecao> {
    const db = this.requerDb();
    const id = randomUUID();
    db.prepare('INSERT INTO colecoes (id, titulo) VALUES (?, ?)').run(id, titulo);
    return { id, titulo, contagem: 0 };
  }

  /** F5: adiciona vídeos a uma coleção (ignora duplicados). */
  async adicionarVideosColecao(colecaoId: string, videoIds: string[]): Promise<{ adicionados: number; jaExistiam: number }> {
    const db = this.requerDb();
    const colecao = db.prepare('SELECT id FROM colecoes WHERE id = ?').get(colecaoId) as { id: string } | undefined;
    if (!colecao) throw new ErroNaoEncontrado(`Coleção não encontrada: ${colecaoId}`);

    let adicionados = 0;
    let jaExistiam = 0;

    for (const videoId of videoIds) {
      const video = await this.repositorio.porId(videoId);
      if (!video) continue;

      try {
        db.prepare('INSERT INTO colecao_videos (colecao_id, video_id) VALUES (?, ?)').run(colecaoId, videoId);
        const novasColecoes = [...new Set([...(video.colecaoIds ?? []), colecaoId])];
        db.prepare('UPDATE videos SET colecao_ids = ?, atualizado_em = ? WHERE id = ?')
          .run(JSON.stringify(novasColecoes), new Date().toISOString(), videoId);
        adicionados++;
      } catch (erro) {
        const msg = erro instanceof Error ? erro.message : String(erro);
        if (msg.includes('UNIQUE constraint failed: colecao_videos')) {
          jaExistiam++;
        } else {
          throw erro;
        }
      }
    }

    return { adicionados, jaExistiam };
  }

  /** F5: remove um vídeo de uma coleção. */
  async removerVideoColecao(colecaoId: string, videoId: string): Promise<void> {
    const db = this.requerDb();
    const resultado = db.prepare('DELETE FROM colecao_videos WHERE colecao_id = ? AND video_id = ?').run(colecaoId, videoId);
    if (resultado.changes === 0) throw new ErroNaoEncontrado('Vínculo não encontrado.');

    const video = await this.repositorio.porId(videoId);
    if (video) {
      const novasColecoes = (video.colecaoIds ?? []).filter(id => id !== colecaoId);
      db.prepare('UPDATE videos SET colecao_ids = ?, atualizado_em = ? WHERE id = ?')
        .run(JSON.stringify(novasColecoes), new Date().toISOString(), videoId);
    }
  }
}