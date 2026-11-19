#!/usr/bin/env node
/**
 * Build: compila o motor (TS → JS ESM) em `dist/` e copia os contratos
 * compartilhados. A interface é HTML/CSS/JS sem etapa de build.
 */
import { spawnSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(raiz, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

// 1) Compila TS do motor + compartilhado (sem typecheck: `npm run build` já chamou).
const tsc = join(raiz, 'node_modules', 'typescript', 'bin', 'tsc');
const resultado = spawnSync(
  process.execPath,
  [
    tsc,
    '--project', join(raiz, 'tsconfig.build.json'),
    '--outDir', dist,
  ],
  { cwd: raiz, stdio: 'inherit' },
);

if (resultado.status !== 0) {
  console.error('Falha na compilação TypeScript.');
  process.exit(resultado.status ?? 1);
}

// 2) Metadados que o Node precisa para resolver ESM nos pacotes internos.
for (const pacote of ['motor', 'compartilhado']) {
  const destino = join(dist, pacote, 'package.json');
  if (!existsSync(dirname(destino))) continue;
  cpSync(join(raiz, 'src', pacote, 'package.json'), destino);
}

console.log('build concluído em dist/');
