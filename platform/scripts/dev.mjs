#!/usr/bin/env node
/**
 * Servidor de desenvolvimento.
 *
 * Usa o type stripping nativo do Node 22 (`--experimental-strip-types`): o
 * TypeScript roda direto, sem etapa de build. Em troca, o código fonte evita
 * sintaxe que exige transpilação (enums, namespaces, decorators).
 */
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const entrada = join(raiz, 'src', 'motor', 'src', 'principal.ts');

const filho = spawn(
  process.execPath,
  ['--experimental-sqlite', '--experimental-strip-types', '--disable-warning=ExperimentalWarning', entrada],
  { stdio: 'inherit', env: { ...process.env, CONTEXTFLOW_AMBIENTE: process.env.CONTEXTFLOW_AMBIENTE ?? 'desenvolvimento' } },
);

const repassar = (sinal) => () => filho.kill(sinal);
process.on('SIGINT', repassar('SIGINT'));
process.on('SIGTERM', repassar('SIGTERM'));
filho.on('exit', (codigo) => process.exit(codigo ?? 1));
