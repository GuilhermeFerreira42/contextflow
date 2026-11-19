/**
 * Módulo `biblioteca`: dono dos vídeos, canais, coleções e consultas.
 * Não baixa nada e não chama IA — apenas mantém e consulta o catálogo.
 */
import type { Video } from '@contextflow/compartilhado';
import { ErroNaoEncontrado, ErroValidacao } from '../../nucleo/erros.ts';
import type { FiltroBiblioteca, PaginaBiblioteca, RepositorioBiblioteca } from './repositorio.ts';

const LIMITE_PADRAO = 50;
const LIMITE_MAXIMO = 500;

export class ServicoBiblioteca {
  private readonly repositorio: RepositorioBiblioteca;

  constructor(repositorio: RepositorioBiblioteca) {
    this.repositorio = repositorio;
  }

  async consultar(entrada: {
    busca?: string | undefined;
    estado?: string | undefined;
    canalId?: string | undefined;
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
}
