#!/usr/bin/env node
/**
 * Verificação de fumaça: sobe o motor em porta livre, confere endpoints e
 * estáticos, e derruba. Serve para quem chega no projeto saber em 5 segundos
 * se o ambiente está funcional — antes de investigar qualquer coisa.
 */
import { join } from 'node:path';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig } from '../src/motor/src/nucleo/configuracao.ts';
import { criarAplicacao } from '../src/motor/src/aplicacao.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const checagens = [];
const registrar = (nome, ok, detalhe = '') => {
  checagens.push({ nome, ok });
  console.log(`${ok ? 'OK  ' : 'FALHA'} ${nome}${detalhe ? `  (${detalhe})` : ''}`);
};

const config = carregarConfig({
  CONTEXTFLOW_PORTA: '0',
  CONTEXTFLOW_AMBIENTE: 'teste',
  CONTEXTFLOW_DADOS: join(raiz, 'testes', '.tmp', 'dados-fumaca'),
});

const app = criarAplicacao(config);
await new Promise((ok) => app.servidor.listen(0, '127.0.0.1', ok));
const porta = app.servidor.address().port;
const base = `http://127.0.0.1:${porta}`;

try {
  const saude = await fetch(`${base}/api/saude`);
  const corpoSaude = await saude.json();
  registrar('motor responde /api/saude', saude.status === 200 && corpoSaude.ok === true, `HTTP ${saude.status}`);

  const biblioteca = await fetch(`${base}/api/biblioteca`);
  const corpoBib = await biblioteca.json();
  registrar('biblioteca responde consulta paginada', biblioteca.status === 200 && Array.isArray(corpoBib.dados?.itens), `total=${corpoBib.dados?.total}`);

  const index = await fetch(`${base}/`);
  const html = await index.text();
  registrar('interface é servida na raiz', index.status === 200 && html.includes('ContextFlow'));

  const css = await fetch(`${base}/estilos/principal.css`);
  registrar('css da interface carrega', css.status === 200);
  const js = await fetch(`${base}/js/aplicacao.js`);
  registrar('js da interface carrega', js.status === 200);

  const traversal = await fetch(`${base}/..%2f..%2f..%2fetc%2fpasswd`);
  const textoTrav = await traversal.text();
  registrar('travessia de path bloqueada', !textoTrav.includes('root:'));

  const validar = await fetch(`${base}/api/ingestao/validar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ' }),
  });
  const corpoVal = await validar.json();
  registrar('validação de URL funciona', corpoVal.dados?.valido === true);

  const modulos = corpoSaude.dados?.modulos ?? {};
  console.log('\nMódulos:', JSON.stringify(modulos));
  console.log(`plataforma: ${corpoSaude.dados?.plataforma} · node ${corpoSaude.dados?.node} · pasta de dados: ${corpoSaude.dados?.pastaDados}`);
} finally {
  await app.encerrar();
}

const falhas = checagens.filter((c) => !c.ok).length;
console.log(falhas === 0 ? '\nTUDO OK' : `\n${falhas} FALHA(S)`);
process.exit(falhas === 0 ? 0 : 1);
