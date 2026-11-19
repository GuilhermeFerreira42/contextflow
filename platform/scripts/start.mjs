#!/usr/bin/env node
/**
 * Execução "de produção": roda a partir do build em dist/.
 * Se o build não existir, falha com mensagem clara (não roda fonte por acidente).
 */
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const entrada = join(raiz, 'dist', 'motor', 'src', 'principal.js');

if (!existsSync(entrada)) {
  console.error('Build ausente. Rode `npm run build` antes de `npm start`.');
  process.exit(1);
}

// node:sqlite emite ExperimentalWarning; suprimimos de forma explícita e visível.
const filho = spawn(process.execPath, ['--experimental-sqlite', '--disable-warning=ExperimentalWarning', entrada], {
  stdio: 'inherit',
  env: { ...process.env, CONTEXTFLOW_AMBIENTE: process.env.CONTEXTFLOW_AMBIENTE ?? 'producao' },
});

const repassar = (sinal) => () => filho.kill(sinal);
process.on('SIGINT', repassar('SIGINT'));
process.on('SIGTERM', repassar('SIGTERM'));
filho.on('exit', (codigo) => process.exit(codigo ?? 1));
