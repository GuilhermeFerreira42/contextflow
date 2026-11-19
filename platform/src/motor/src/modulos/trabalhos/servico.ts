/**
 * Módulo `trabalhos`: fila persistente com estados, concorrência limitada,
 * cancelamento cooperativo e retry idempotente.
 *
 * F1 declara o contrato. A fila real entra na F4.
 */
import type { EstadoTrabalho, TipoTrabalho, Trabalho } from '@contextflow/compartilhado';

export interface ServicoTrabalhos {
  criar(tipo: TipoTrabalho, escopo: Record<string, unknown>): Promise<Trabalho>;
  obter(id: string): Promise<Trabalho | null>;
  listar(estado?: EstadoTrabalho): Promise<Trabalho[]>;
  cancelar(id: string): Promise<void>;
}
