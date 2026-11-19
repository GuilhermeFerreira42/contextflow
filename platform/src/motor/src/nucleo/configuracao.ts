/**
 * Configuração de execução do motor.
 *
 * Tudo vem de variável de ambiente com padrão seguro. Nenhum caminho absoluto de
 * máquina de desenvolvimento é aceito: o padrão é derivado do SO do usuário.
 */
import { existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

export interface ConfigMotor {
  /** Porta HTTP local. 0 = sistema escolhe uma livre (bom para testes). */
  porta: number;
  /** Endereço de bind. Local por padrão — expor remoto exige decisão explícita. */
  host: string;
  /** Pasta de dados (banco, artefatos). Fora do Git. */
  pastaDados: string;
  /** Pasta pública servida pela interface. */
  pastaInterface: string;
  /** Idiomas de legenda em ordem de preferência (BCP-47). */
  idiomasLegenda: string[];
  ambiente: 'desenvolvimento' | 'teste' | 'producao';
}

/** Pasta padrão de dados por SO, sem inventar caminho absoluto de projeto. */
export function pastaDadosPadrao(): string {
  const base =
    process.platform === 'win32'
      ? process.env.APPDATA ?? join(homedir(), 'AppData', 'Roaming')
      : process.env.XDG_DATA_HOME ?? join(homedir(), '.local', 'share');
  return join(base, 'ContextFlow');
}

/**
 * Localiza a interface sem depender de o código estar em src/ ou em dist/.
 * Sobe de `nucleo/` até a pasta do pacote (que tem package.json) e desce em
 * `src/interface/publico`.
 */
export function pastaInterfacePadrao(urlModulo: string = import.meta.url): string {
  let atual = new URL('.', urlModulo);
  for (let i = 0; i < 6; i++) {
    const candidato = new URL('src/interface/publico', atual);
    try {
      if (existsSync(fileURLToPath(candidato))) return fileURLToPath(candidato);
    } catch {
      // segue subindo
    }
    const pai = new URL('../', atual);
    if (pai.href === atual.href) break;
    atual = pai;
  }
  throw new Error('Interface não encontrada: esperado src/interface/publico no pacote');
}

export function carregarConfig(env: NodeJS.ProcessEnv = process.env): ConfigMotor {
  const ambienteBruto = env.CONTEXTFLOW_AMBIENTE ?? 'desenvolvimento';
  const ambiente =
    ambienteBruto === 'teste' || ambienteBruto === 'producao' ? ambienteBruto : 'desenvolvimento';

  const porta = Number.parseInt(env.CONTEXTFLOW_PORTA ?? '4780', 10);
  if (!Number.isInteger(porta) || porta < 0 || porta > 65535) {
    throw new Error(`CONTEXTFLOW_PORTA inválida: ${env.CONTEXTFLOW_PORTA}`);
  }

  const idiomasLegenda = (
    env.CONTEXTFLOW_IDIOMAS ??
    env.CONTEXTFLOW_IDIOMAS_LEGENDA ??
    'pt-BR,pt,en'
  )
    .split(',')
    .map((i) => i.trim())
    .filter((i) => i.length > 0);

  return {
    porta,
    host: env.CONTEXTFLOW_HOST ?? '127.0.0.1',
    pastaDados: env.CONTEXTFLOW_DADOS ?? pastaDadosPadrao(),
    pastaInterface: env.CONTEXTFLOW_INTERFACE ?? pastaInterfacePadrao(),
    idiomasLegenda: idiomasLegenda.length > 0 ? idiomasLegenda : ['pt-BR', 'pt', 'en'],
    ambiente,
  };
}
