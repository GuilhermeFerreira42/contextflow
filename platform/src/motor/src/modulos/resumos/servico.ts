/**
 * Módulo `resumos`: orquestra provedores, prompts, proveniência e custos.
 * Não depende de UI e não renderiza nada. Implementação real na F6.
 */
import type { Resumo } from '@contextflow/compartilhado';

export interface ProvedorResumo {
  id: string;
  modelos: string[];
  /** Gera a partir de uma transcrição já persistida. Nunca recebe chave por parâmetro. */
  gerar(entrada: { modelo: string; prompt: string; texto: string }): Promise<{ texto: string; custoEstimado: number | null }>;
}

export interface ServicoResumos {
  solicitar(videoIds: string[], modeloId: string, promptId: string): Promise<Resumo[]>;
}
