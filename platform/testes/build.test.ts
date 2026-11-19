/**
 * Garante que o build produz JS executável: o modo fonte usa imports `.ts`,
 * e o `tsc` precisa reescrevê-los para `.js`. Se isso quebrar, `npm start`
 * para de funcionar mesmo com testes verdes em modo fonte.
 */
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const raiz = fileURLToPath(new URL('..', import.meta.url));

test('build gera dist com imports .js reescritos', { timeout: 180_000 }, () => {
  execFileSync(process.execPath, [join(raiz, 'scripts', 'build.mjs')], { cwd: raiz, stdio: 'pipe' });

  const entrada = join(raiz, 'dist', 'motor', 'src', 'principal.js');
  assert.ok(existsSync(entrada), 'dist/motor/src/principal.js não foi gerado');

  const codigo = readFileSync(entrada, 'utf8');
  assert.ok(codigo.includes("./nucleo/configuracao.js"), 'import .js não foi reescrito');
  assert.ok(!codigo.includes("from \"./nucleo/configuracao.ts\""), 'dist ainda referencia .ts');
});
