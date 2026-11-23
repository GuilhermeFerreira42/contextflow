/** F6 no navegador real: servidor IA local controlado, sem chaves ou cobrança reais. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { createServer } from 'node:http';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { RepositorioTranscricoesSqlite } from '../../src/motor/src/persistencia/repositorio-transcricoes.ts';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
mkdirSync(join(raiz, 'testes/.tmp'), { recursive: true });
const pasta = mkdtempSync(join(raiz, 'testes/.tmp/f6-ui-'));
const evidencia = resolve(process.env.CONTEXTFLOW_EVIDENCIAS ?? pasta);
mkdirSync(evidencia, { recursive: true });
const modo = { bloquear: false, status: 200, chamadas: 0, texto: 'Resumo controlado de interface.' };
const mock = createServer(async (req, res) => {
  for await (const _ of req) { /* consumir corpo sem logar a fonte */ }
  if (modo.bloquear) return;
  res.writeHead(modo.status, { 'content-type': 'application/json' });
  if (modo.status !== 200) { res.end('{"error":"fixture"}'); return; }
  if (req.method === 'GET') { res.end(req.url === '/models' ? '{"data":[{"id":"fixture"}]}' : '{"models":[{"name":"fixture"}]}'); return; }
  modo.chamadas++;
  if (req.url === '/chat/completions') { res.end(JSON.stringify({ choices: [{ message: { content: `${modo.texto} Compatível.` }, finish_reason: 'stop' }], usage: { prompt_tokens: 20, completion_tokens: 10 } })); return; }
  res.end(JSON.stringify({ message: { content: `${modo.texto} Chamada ${modo.chamadas}.` }, done: true, prompt_eval_count: 20, eval_count: 10 }));
});
const app = criarAplicacao(carregarConfig({ ...process.env, CONTEXTFLOW_DADOS: pasta, CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste' }));
let browser, page;
const falhas = [], erros = [];
let total = 0;
try {
  await new Promise(ok => mock.listen(0, '127.0.0.1', ok));
  const endpoint = `http://127.0.0.1:${mock.address().port}`;
  app.iniciarPersistencia();
  const transcricoes = new RepositorioTranscricoesSqlite(app.banco.db);
  for (const [i, texto] of ['Fonte detalhada do vídeo. '.repeat(150), 'Outra fonte para o lote.', null].entries()) {
    const id = `f6-ui-${i+1}`;
    app.banco.db.prepare(`INSERT INTO videos(id,youtube_id,titulo,url,estado,criado_em,atualizado_em)
      VALUES(?,?,?,?,'pronto','2026-11-22T00:00:00.000Z','2026-11-22T00:00:00.000Z')`).run(id, `ui${String(i).padStart(9,'0')}`, `Vídeo F6 ${i+1}`, `https://youtu.be/ui${String(i).padStart(9,'0')}`);
    if (texto) transcricoes.salvarSincrono({ videoId: id, idioma: 'pt', origem: 'manual', estado: 'pronta', atualizadoEm: new Date().toISOString(), segmentos: [{ inicioMs: 0, fimMs: 6000, texto }] });
  }
  await new Promise(ok => app.servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${app.servidor.address().port}`;
  const executavel = [process.env.CHROME_BIN, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && existsSync(p));
  browser = await chromium.launch({ executablePath: executavel });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce', permissions: ['clipboard-read', 'clipboard-write'] });
  page = await context.newPage(); page.setDefaultTimeout(15000); page.on('pageerror', e => erros.push(e.message));
  const nav = async tela => { await page.locator(`[data-aba="${tela}"]`).click(); await page.locator(`[data-tela-nome="${tela}"]`).waitFor(); };
  const req = async caminho => (await (await fetch(base + caminho)).json()).dados;
  const terminal = async id => {
    for (let i = 0; i < 200; i++) { const j = await req(`/api/trabalhos/${id}`); if (['concluido','falhou','cancelado'].includes(j.estado)) return j; await new Promise(ok => setTimeout(ok, 50)); }
    throw new Error('Trabalho F6 não terminou.');
  };
  const teste = async (nome, fn) => {
    total++;
    try { await fn(); console.log(`PASS ${nome}`); }
    catch (e) { falhas.push(nome); console.error(`FAIL ${nome}: ${e.stack}`); await page.screenshot({ path: join(evidencia, `falha-${total}.png`) }).catch(() => {}); }
  };
  await page.goto(base);
  await page.locator('tr[data-id="f6-ui-1"]').waitFor();
  await teste('Configurar Ollama pela UI, salvar, testar e recarregar', async () => {
    await nav('configuracoes');
    await page.locator('#ia-provedor option[value="ollama"]').waitFor({ state: 'attached' });
    await page.locator('#ia-provedor').selectOption('ollama');
    await page.locator('#ia-modelo').fill('fixture'); await page.locator('#ia-endpoint').fill(endpoint);
    await page.locator('#ia-contexto').fill('2048'); await page.locator('#ia-saida').fill('128');
    await page.locator('#ia-preco-entrada').fill('1'); await page.locator('#ia-preco-saida').fill('2');
    await page.locator('#ia-salvar').click();
    await page.waitForFunction(() => document.querySelector('#ia-resultado').textContent.includes('salva'));
    await page.locator('#ia-testar').click();
    await page.waitForFunction(() => document.querySelector('#ia-resultado').textContent.includes('Nenhum resumo'));
    await page.reload(); await page.locator('#ia-modelo').waitFor();
    await page.waitForFunction(() => document.querySelector('#ia-modelo').value === 'fixture');
    assert.equal(await page.locator('#ia-chave').inputValue(), '');
    await page.screenshot({ path: join(evidencia, 'configuracao.png') });
  });
  await teste('Estimar/confirmar lote, explicitar sem legenda e salvar pela fila', async () => {
    await nav('biblioteca');
    for (const id of ['f6-ui-1','f6-ui-2','f6-ui-3']) await page.locator(`tr[data-id="${id}"] input`).check();
    await page.locator('#gerar-resumos-selecao').click();
    await page.locator('#resumos-confirmar').waitFor();
    await page.waitForFunction(() => !document.querySelector('#resumos-confirmar').disabled);
    assert.match(await page.locator('#resumos-custo').innerText(), /Custo estimado/);
    assert.match(await page.locator('#resumos-itens').innerText(), /não tem transcrição/);
    assert.equal(modo.chamadas, 0, 'estimativa não chama o modelo');
    await page.screenshot({ path: join(evidencia, 'estimativa.png') });
    await page.locator('#resumos-confirmar').click();
    await page.waitForURL('**/#importacoes');
    const jobs = (await req('/api/trabalhos')).itens.filter(j => j.tipo === 'gerar-resumo');
    assert.equal(jobs.length, 2);
    for (const j of jobs) assert.equal((await terminal(j.id)).estado, 'concluido');
    await page.waitForFunction(() => [...document.querySelectorAll('.trabalho-meta')].some(p => p.textContent.includes('Concluído')));
    await page.screenshot({ path: join(evidencia, 'fila.png') });
    assert.ok(modo.chamadas > 2, 'fonte longa exerceu map-reduce');
  });
  await teste('Leitura, cópia, histórico e resumo na grade após reload', async () => {
    await nav('biblioteca');
    await page.waitForFunction(() => document.querySelector('tr[data-id="f6-ui-1"] .resumo-linha')?.textContent.includes('Resumo controlado'));
    await page.locator('tr[data-id="f6-ui-1"] .abrir-painel').click();
    await page.waitForFunction(() => document.querySelector('#painel-resumo').textContent.includes('Resumo controlado'));
    await page.locator('#painel-copiar-resumo').click();
    assert.match(await page.evaluate(() => navigator.clipboard.readText()), /Resumo controlado/);
    await page.locator('#painel-historico').click();
    await page.locator('#historico-resumos-conteudo details').waitFor();
    assert.equal(await page.locator('#historico-resumos-conteudo details').count(), 1);
    await page.screenshot({ path: join(evidencia, 'historico.png') });
    await page.locator('#historico-resumos-fechar').click(); await page.locator('#fechar-painel').click();
    await page.reload();
    await page.waitForFunction(() => document.querySelector('tr[data-id="f6-ui-1"] .resumo-linha')?.textContent.includes('Resumo controlado'));
  });
  await teste('Cancelar/repetir pela UI preserva anterior e atualiza prévia sem reload', async () => {
    await nav('configuracoes'); await page.locator('#ia-versao').fill('v2'); await page.locator('#ia-salvar').click();
    await page.waitForFunction(() => document.querySelector('#ia-resultado').textContent.includes('salva'));
    await nav('biblioteca');
    if (await page.locator('#limpar-selecao').isEnabled()) await page.locator('#limpar-selecao').click();
    await page.locator('tr[data-id="f6-ui-1"] input').check();
    modo.bloquear = true;
    await page.locator('#gerar-resumos-selecao').click();
    await page.waitForFunction(() => !document.querySelector('#resumos-confirmar').disabled);
    await page.locator('#resumos-confirmar').click(); await page.waitForURL('**/#importacoes');
    const jobs = (await req('/api/trabalhos')).itens;
    const novo = jobs.find(j => ['na-fila','executando'].includes(j.estado)); assert.ok(novo);
    await page.locator(`.trabalho[data-id="${novo.id}"] [data-acao="cancelar"]`).click();
    assert.equal((await terminal(novo.id)).estado, 'cancelado');
    assert.match((await req('/api/biblioteca/f6-ui-1/resumo')).texto, /Resumo controlado/);
    modo.bloquear = false; modo.texto = 'Resumo novo da interface.';
    await page.locator(`.trabalho[data-id="${novo.id}"] [data-acao="repetir"]`).click();
    assert.equal((await terminal(novo.id)).estado, 'concluido');
    await nav('biblioteca');
    await page.waitForFunction(() => document.querySelector('tr[data-id="f6-ui-1"] .resumo-linha')?.textContent.includes('Resumo novo'));
    assert.equal((await req('/api/resumos/f6-ui-1')).itens.filter(r => r.estado === 'pronto').length, 2);
    await page.screenshot({ path: join(evidencia, 'biblioteca-com-resumo.png') });
  });
  await teste('Erro de autenticação aparece na fila sem apagar resumo pronto', async () => {
    await nav('configuracoes'); await page.locator('#ia-versao').fill('v3'); await page.locator('#ia-salvar').click();
    await page.waitForFunction(() => document.querySelector('#ia-resultado').textContent.includes('salva'));
    await nav('biblioteca'); modo.status = 401;
    await page.locator('#gerar-resumos-selecao').click();
    await page.waitForFunction(() => !document.querySelector('#resumos-confirmar').disabled);
    await page.locator('#resumos-confirmar').click(); await page.waitForURL('**/#importacoes');
    const novo = (await req('/api/trabalhos')).itens.find(j => j.estado !== 'concluido' && j.tipo === 'gerar-resumo');
    const t = await terminal(novo.id); assert.equal(t.estado, 'falhou'); assert.equal(t.erroCodigo, 'auth_invalido');
    await page.waitForFunction(id => document.querySelector(`.trabalho[data-id="${id}"]`)?.textContent.includes('autenticação'), novo.id);
    assert.match((await req('/api/biblioteca/f6-ui-1/resumo')).texto, /Resumo novo/);
    await page.screenshot({ path: join(evidencia, 'erro-provedor.png') });
  });
  await teste('Nenhuma exceção JavaScript e formulário em janela estreita', async () => {
    modo.status = 200;
    await nav('configuracoes'); await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    assert.ok(await page.locator('#lista-config dd').evaluateAll(itens => itens.every(el => el.scrollWidth <= el.clientWidth)), 'Preferências devem quebrar linhas sem texto cortado');
    await page.screenshot({ path: join(evidencia, 'configuracao-estreita.png') });
    assert.deepEqual(erros, []);
  });
  await teste('LiteLLM sem chave: salvar/testar formulário atual, modelos e saída acima de 8192', async () => {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator('#ia-provedor').selectOption('compativel');
    await page.locator('#ia-endpoint').fill(endpoint.replace('127.0.0.1', '0.0.0.0'));
    await page.locator('#ia-modelo').fill('modelo-inexistente');
    await page.locator('#ia-contexto').fill('200000'); await page.locator('#ia-saida').fill('131072');
    const antes = modo.chamadas;
    await page.locator('#ia-testar').click();
    await page.waitForFunction(() => document.querySelector('#ia-resultado').textContent.includes('não consta'));
    assert.equal(await page.locator('#ia-endpoint').inputValue(), endpoint);
    assert.equal(await page.locator('#ia-modelos option').first().getAttribute('value'), 'fixture');
    assert.equal(modo.chamadas, antes, 'conexão não gera texto');
    await page.locator('#ia-modelo').fill('fixture'); await page.locator('#ia-testar').click();
    await page.waitForFunction(() => document.querySelector('#ia-resultado').textContent.includes('Nenhum resumo') && !document.querySelector('#ia-resultado').textContent.includes('não consta'));
    await page.reload(); await page.waitForFunction(() => document.querySelector('#ia-saida').value === '131072');
    assert.equal(await page.locator('#ia-chave').inputValue(), '');
    await page.screenshot({ path: join(evidencia, 'litellm-saida-longa.png') });
    await nav('biblioteca'); await page.locator('tr[data-id="f6-ui-1"] input').check();
    await page.locator('#gerar-resumos-selecao').click();
    await page.waitForFunction(() => !document.querySelector('#resumos-confirmar').disabled);
    await page.locator('#resumos-confirmar').click(); await page.waitForURL('**/#importacoes');
    const jobs = (await req('/api/trabalhos')).itens.filter(j => j.tipo === 'gerar-resumo');
    for (const job of jobs) await terminal(job.id);
    assert.match((await req('/api/biblioteca/f6-ui-1/resumo')).texto, /Compatível/);
    assert.deepEqual(erros, []);
  });
  await teste('Prompt personalizado persiste; erro preserva edição e carga atrasada não apaga texto', async () => {
    await nav('configuracoes');
    const comando = 'Liste decisões e exemplos em linguagem simples, sem inventar dados.';
    await page.locator('#ia-prompt').fill(comando);
    assert.match(await page.locator('#ia-resultado').innerText(), /não salvas/);
    await page.locator('#ia-salvar').click();
    await page.waitForFunction(() => document.querySelector('#ia-resultado').textContent.includes('salva'));
    const persistido = await page.locator('#ia-prompt').inputValue();
    assert.ok(persistido.startsWith(comando)); assert.equal(persistido.split('{transcricao}').length - 1, 1);
    await page.reload(); await page.waitForFunction(() => !document.querySelector('#ia-prompt').disabled);
    assert.equal(await page.locator('#ia-prompt').inputValue(), persistido);
    const rota = '**/api/resumos/configuracao';
    await page.route(rota, r => r.request().method() === 'POST'
      ? r.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, erro: { mensagem: 'Falha controlada ao salvar.' } }) }) : r.continue());
    const editado = comando + '\nInclua um glossário.';
    await page.locator('#ia-prompt').fill(editado); await page.locator('#ia-salvar').click();
    await page.waitForFunction(() => document.querySelector('#ia-resultado').textContent.includes('Falha controlada'));
    assert.equal(await page.locator('#ia-prompt').inputValue(), editado);
    assert.equal((await req('/api/resumos/configuracao')).configuracao.prompt, persistido);
    await page.unroute(rota);
    let liberar; const aguardar = new Promise(ok => { liberar = ok; });
    await page.route(rota, async r => { await aguardar; await r.continue(); });
    await page.reload({ waitUntil: 'domcontentloaded' });
    assert.ok(await page.locator('#ia-prompt').isDisabled());
    liberar(); await page.waitForFunction(() => !document.querySelector('#ia-prompt').disabled);
    assert.equal(await page.locator('#ia-prompt').inputValue(), persistido);
    await page.unroute(rota);
    await page.screenshot({ path: join(evidencia, 'prompt-personalizado-persistido.png') });
    assert.deepEqual(erros, []);
  });
  console.log(`\n${total-falhas.length}/${total} cenários F6 Playwright aprovados. Provedor HTTP controlado; não é serviço/modelo real.`);
  process.exitCode = falhas.length ? 1 : 0;
} finally {
  await browser?.close(); await app.encerrar();
  mock.closeAllConnections(); await new Promise(ok => mock.close(ok));
}
