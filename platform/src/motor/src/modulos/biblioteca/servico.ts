/** Biblioteca: regras de consulta e ações por identidade; SQL fica nos repositórios. */
import { randomUUID } from 'node:crypto';
import type { Video, Colecao, AcaoLote } from '@contextflow/compartilhado';
import { ErroDominio, ErroNaoEncontrado, ErroValidacao } from '../../nucleo/erros.ts';
import { CAMPOS_ORDENACAO, type FiltroBiblioteca, type PaginaBiblioteca, type RepositorioBiblioteca } from './repositorio.ts';
import type { RepositorioColecoes } from '../../persistencia/repositorio-colecoes.ts';

export function validarIds(entrada: unknown): string[] {
  if (!Array.isArray(entrada) || !entrada.length || !entrada.every(id => typeof id === 'string' && /^[A-Za-z0-9_-]{1,150}$/.test(id)))
    throw new ErroValidacao('Informe uma lista não vazia de IDs válidos.');
  return [...new Set(entrada as string[])];
}
export interface ResultadoLote {
  processados: number;
  falhas: { id: string; codigo: string; mensagem: string }[];
  trabalhoId?: string;
}
interface DependenciasBiblioteca {
  colecoes?: RepositorioColecoes;
  reimportar?: (videos: Video[], chave: string) => Promise<string>;
  cancelarImportacoes?: (youtubeId: string) => Promise<void>;
}
export class ServicoBiblioteca {
  readonly #repositorio: RepositorioBiblioteca;
  readonly #dependencias: DependenciasBiblioteca;
  constructor(repositorio: RepositorioBiblioteca, dependencias: DependenciasBiblioteca = {}) {
    this.#repositorio = repositorio; this.#dependencias = dependencias;
  }
  async consultar(entrada: {
    busca?: string; estado?: string; canalId?: string; colecaoId?: string; playlistId?: string; temResumo?: boolean;
    ordenacao?: string; ordenacaoDirecao?: string; cursor?: string; limite?: string;
  }): Promise<PaginaBiblioteca> {
    const limite = entrada.limite === undefined ? 50 : Number(entrada.limite);
    if (!Number.isInteger(limite) || limite < 1 || limite > 500) throw new ErroValidacao('limite deve ser inteiro entre 1 e 500');
    if (entrada.estado && !['novo','importando','pronto','parcial','erro'].includes(entrada.estado)) throw new ErroValidacao('Estado de vídeo inválido.');
    if (entrada.ordenacao && !(CAMPOS_ORDENACAO as readonly string[]).includes(entrada.ordenacao)) throw new ErroValidacao('Ordenação inválida.');
    if (entrada.ordenacaoDirecao && !['asc','desc'].includes(entrada.ordenacaoDirecao)) throw new ErroValidacao('Direção deve ser asc ou desc.');
    if (entrada.playlistId && !/^[A-Za-z0-9_-]{2,150}$/.test(entrada.playlistId)) throw new ErroValidacao('Playlist inválida.');
    const filtro: FiltroBiblioteca = {
      ...(entrada.busca ? {busca:entrada.busca} : {}), ...(entrada.estado ? {estado:entrada.estado as Video['estado']} : {}),
      ...(entrada.canalId ? {canalId:entrada.canalId} : {}), ...(entrada.colecaoId ? {colecaoId:entrada.colecaoId} : {}),
      ...(entrada.playlistId ? {playlistId:entrada.playlistId} : {}),
      ...(entrada.temResumo !== undefined ? {temResumo:entrada.temResumo} : {}),
      ...(entrada.ordenacao ? {ordenacao:entrada.ordenacao as FiltroBiblioteca['ordenacao']} : {}),
      ...(entrada.ordenacaoDirecao ? {ordenacaoDirecao:entrada.ordenacaoDirecao as FiltroBiblioteca['ordenacaoDirecao']} : {}),
    };
    return this.#repositorio.consultar({filtro, cursor:entrada.cursor ?? null, limite});
  }
  async obter(id: string): Promise<Video> {
    const video = await this.#repositorio.porId(id);
    if (!video) throw new ErroNaoEncontrado(`Vídeo não encontrado: ${id}`);
    return video;
  }
  async total(): Promise<number> { return this.#repositorio.contagem(); }
  async acaoLote(acao: AcaoLote, entradaIds: string[], colecaoId?: string, chaveRequisicao: string = randomUUID()): Promise<ResultadoLote> {
    const ids = validarIds(entradaIds);
    if (!['reimportar','remover','colecao'].includes(acao)) throw new ErroValidacao('Ação em lote inválida.');
    if (acao === 'colecao' && !colecaoId) throw new ErroValidacao('Escolha uma coleção.');
    const resultado: ResultadoLote = {processados:0,falhas:[]};
    const falha = (id: string, erro: unknown) => resultado.falhas.push({id,
      codigo:erro instanceof ErroDominio ? erro.codigo : 'erro_interno',
      mensagem:erro instanceof ErroDominio ? erro.message : 'Não foi possível concluir a operação.',
    });
    const reimportar: Video[] = [];
    for (const id of ids) {
      try {
        if (acao === 'reimportar') { reimportar.push(await this.obter(id)); continue; }
        if (acao === 'remover') {
          const existente = await this.#repositorio.porId(id);
          if (existente) await this.#dependencias.cancelarImportacoes?.(existente.youtubeId);
          await this.#repositorio.remover(id);
        } else await this.adicionarVideosColecao(colecaoId!, [id]);
        resultado.processados++;
      } catch (erro) { falha(id, erro); }
    }
    if (reimportar.length) {
      try {
        if (!this.#dependencias.reimportar) throw new ErroDominio('indisponivel', 'Fila de importação não disponível.', 503);
        resultado.trabalhoId = await this.#dependencias.reimportar(reimportar, chaveRequisicao);
        resultado.processados += reimportar.length;
      } catch (erro) { for (const v of reimportar) falha(v.id, erro); }
    }
    return resultado;
  }
  #colecoes(): RepositorioColecoes {
    if (!this.#dependencias.colecoes) throw new ErroDominio('indisponivel', 'Coleções não disponíveis.', 503);
    return this.#dependencias.colecoes;
  }
  async listarColecoes(): Promise<{itens:Colecao[]}> { return this.#colecoes().listar(); }
  async criarColecao(titulo: string): Promise<Colecao> { return this.#colecoes().criar(titulo); }
  async adicionarVideosColecao(id: string, entrada: string[]): Promise<{adicionados:number;jaExistiam:number}> {
    return this.#colecoes().adicionar(id, validarIds(entrada));
  }
  async removerVideoColecao(id: string, videoId: string): Promise<void> { this.#colecoes().remover(id, videoId); }
  async listarPlaylists() { return this.#colecoes().playlists(); }
  async listarCanais() { return this.#colecoes().canais(); }
}
