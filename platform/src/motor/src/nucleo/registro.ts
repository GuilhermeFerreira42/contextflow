/**
 * Registro (log) do motor.
 *
 * Regra de segurança do projeto: valores sensíveis nunca são escritos.
 * O redutor remove chaves conhecidas antes de serializar.
 */

const CHAVES_SENSIVEIS = /^(api[_-]?key|chave|token|senha|password|secret|authorization|cookie)$/i;

export type NivelLog = 'debug' | 'info' | 'aviso' | 'erro';

export interface Registrador {
  debug(mensagem: string, contexto?: Record<string, unknown>): void;
  info(mensagem: string, contexto?: Record<string, unknown>): void;
  aviso(mensagem: string, contexto?: Record<string, unknown>): void;
  erro(mensagem: string, contexto?: Record<string, unknown>): void;
}

/** Remove recursivamente chaves sensíveis. Exportado para ser testado. */
export function redigir(valor: unknown, profundidade = 0): unknown {
  if (profundidade > 6) return '[profundo]';
  if (valor === null || typeof valor !== 'object') return valor;
  if (Array.isArray(valor)) return valor.map((v) => redigir(v, profundidade + 1));

  const saida: Record<string, unknown> = {};
  for (const [chave, v] of Object.entries(valor as Record<string, unknown>)) {
    saida[chave] = CHAVES_SENSIVEIS.test(chave) ? '[redigido]' : redigir(v, profundidade + 1);
  }
  return saida;
}

export function criarRegistrador(nivelMinimo: NivelLog = 'info'): Registrador {
  const ordem: Record<NivelLog, number> = { debug: 10, info: 20, aviso: 30, erro: 40 };
  const escrever = (nivel: NivelLog, mensagem: string, contexto?: Record<string, unknown>) => {
    if (ordem[nivel] < ordem[nivelMinimo]) return;
    const linha = { momento: new Date().toISOString(), nivel, mensagem, ...(contexto ? { contexto: redigir(contexto) } : {}) };
    const destino = nivel === 'erro' ? process.stderr : process.stdout;
    destino.write(`${JSON.stringify(linha)}\n`);
  };

  return {
    debug: (m, c) => escrever('debug', m, c),
    info: (m, c) => escrever('info', m, c),
    aviso: (m, c) => escrever('aviso', m, c),
    erro: (m, c) => escrever('erro', m, c),
  };
}
