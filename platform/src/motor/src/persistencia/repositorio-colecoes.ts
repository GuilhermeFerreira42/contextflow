import { randomUUID } from 'node:crypto';
import type { Colecao } from '@contextflow/compartilhado';
import type { Banco } from './banco.ts';
import { ErroNaoEncontrado, ErroValidacao } from '../nucleo/erros.ts';

export class RepositorioColecoes {
  readonly #banco: Banco;
  constructor(banco: Banco) { this.#banco = banco; }

  listar(): { itens: Colecao[] } {
    const linhas = this.#banco.db.prepare(`SELECT c.id, c.titulo, COUNT(cv.video_id) contagem FROM colecoes c
      LEFT JOIN colecao_videos cv ON cv.colecao_id=c.id GROUP BY c.id ORDER BY c.titulo,c.id`).all() as unknown as Colecao[];
    return { itens: linhas.map(l => ({ ...l })) };
  }
  criar(titulo: string): Colecao {
    const nome = titulo.trim();
    if (!nome || nome.length > 200) throw new ErroValidacao('Título da coleção deve ter entre 1 e 200 caracteres.');
    const id = randomUUID();
    this.#banco.db.prepare('INSERT INTO colecoes(id,titulo) VALUES(?,?)').run(id, nome);
    return { id, titulo: nome, contagem: 0 };
  }
  #conferir(id: string): void {
    if (!this.#banco.db.prepare('SELECT id FROM colecoes WHERE id=?').get(id))
      throw new ErroNaoEncontrado('Coleção não encontrada.');
  }
  adicionar(id: string, videoIds: string[]): { adicionados: number; jaExistiam: number } {
    return this.#banco.executarTransacao(() => {
      this.#conferir(id);
      const ids = [...new Set(videoIds)];
      for (const videoId of ids) if (!this.#banco.db.prepare('SELECT id FROM videos WHERE id=?').get(videoId))
        throw new ErroNaoEncontrado(`Vídeo não encontrado: ${videoId}`);
      let adicionados = 0;
      const inserir = this.#banco.db.prepare('INSERT OR IGNORE INTO colecao_videos(colecao_id,video_id) VALUES(?,?)');
      for (const videoId of ids) adicionados += Number(inserir.run(id, videoId).changes);
      return { adicionados, jaExistiam: ids.length - adicionados };
    });
  }
  remover(id: string, videoId: string): void {
    this.#banco.executarTransacao(() => {
      this.#conferir(id);
      this.#banco.db.prepare('DELETE FROM colecao_videos WHERE colecao_id=? AND video_id=?').run(id, videoId);
    });
  }
  canais(): { itens: { id: string; nome: string; contagem: number }[] } {
    const linhas = this.#banco.db.prepare(`SELECT canal_id id, MAX(canal_nome) nome, COUNT(*) contagem
      FROM videos WHERE canal_id IS NOT NULL GROUP BY canal_id ORDER BY nome,canal_id`).all() as unknown as {id:string;nome:string|null;contagem:number}[];
    return { itens: linhas.map(l => ({ ...l, nome: l.nome ?? l.id })) };
  }
  /**
   * Meses de importação, para a árvore lateral. Agrupado no banco: derivar de
   * uma página de 500 itens daria contagem errada quando a biblioteca cresce.
   * `id` é AAAA-MM; o intervalo ISO exato é montado pelo chamador.
   */
  meses(): { itens: { id: string; nome: string; contagem: number }[] } {
    const linhas = this.#banco.db
      .prepare(
        `SELECT substr(criado_em,1,7) id, COUNT(*) contagem
           FROM videos
          GROUP BY 1
          ORDER BY 1 DESC`,
      )
      .all() as unknown as { id: string; contagem: number }[];
    return {
      itens: linhas.map((l) => {
        const [ano, mes] = l.id.split('-').map((n) => Number(n) || 1) as [number, number];
        const data = new Date(Date.UTC(ano, mes - 1, 1));
        const rotulo = data.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' });
        return { id: l.id, nome: rotulo.charAt(0).toUpperCase() + rotulo.slice(1), contagem: l.contagem };
      }),
    };
  }

  playlists(): {itens: {id:string;titulo:string;contagem:number}[]} {
    const linhas = this.#banco.db.prepare(`SELECT json_extract(pai.escopo,'$.url') url,
      MAX(json_extract(pai.escopo,'$.titulo')) titulo, COUNT(DISTINCT v.id) contagem
      FROM trabalhos pai LEFT JOIN trabalhos filho ON filho.pai_id=pai.id
      LEFT JOIN videos v ON v.youtube_id=filho.youtube_id
      WHERE pai.tipo='importar-playlist' GROUP BY json_extract(pai.escopo,'$.url') ORDER BY titulo,url`).all() as unknown as {url:string;titulo:string|null;contagem:number}[];
    return {itens:linhas.map(l => ({id:new URL(l.url).searchParams.get('list')!,titulo:l.titulo ?? l.url,contagem:l.contagem}))};
  }
}
