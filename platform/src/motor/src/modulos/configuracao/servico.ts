/**
 * Módulo `configuracao`: preferências e segredos.
 *
 * Regra dura: segredo nunca volta pela API e nunca vai para o registro.
 * A leitura devolve apenas um indicador "existe/ausente". Implementação na F8.
 */
import type { Preferencias } from '@contextflow/compartilhado';

export interface ServicoConfiguracao {
  obterPreferencias(): Promise<Preferencias>;
  salvarPreferencia<K extends keyof Preferencias>(chave: K, valor: Preferencias[K]): Promise<void>;
  /** Grava o segredo do provedor sem devolvê-lo. */
  definirSegredo(provedor: string, segredo: string): Promise<void>;
  /** Indica se há segredo configurado; o valor em si não sai do motor. */
  temSegredo(provedor: string): Promise<boolean>;
}
