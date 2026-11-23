/** Painel horizontal: controles existentes, persistência e espaço de leitura. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
mkdirSync(join(raiz, 'testes/.tmp'), { recursive: true });
const dados = mkdtempSync(join(raiz, 'testes/.tmp/visualizacao-'));
const evidencia = resolve(process.env.CONTEXTFLOW_EVIDENCIAS ?? dados); mkdirSync(evidencia, { recursive: true });
const app = criarAplicacao(carregarConfig({ CONTEXTFLOW_DADOS: dados, CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste' }));
let browser;
const erros = [], falhas = [];
let total = 0;
try {
  app.iniciarPersistencia();
  const capa = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#29496a"/></svg>');
  for (let i = 0; i < 80; i++) {
    app.banco.db.prepare(`INSERT INTO videos(id,youtube_id,titulo,url,miniatura_url,estado,criado_em,atualizado_em)
      VALUES(?,?,?,?,?,'pronto','2026','2026')`).run(`visual-${i}`, `vs${String(i).padStart(9,'0')}`, `Vídeo teste ${String(i).padStart(2,'0')} — decisões de arquitetura`, `https://youtu.be/vs${String(i).padStart(9,'0')}`, capa);
    app.banco.db.prepare(`INSERT INTO resumos VALUES(?,'fixture','modelo','v1','r1',?,'pronto',NULL,'2026','2026')`).run(`visual-${i}`, '# Decisões e exemplos\n\n' + 'Resumo organizado para conferir leitura, dimensões e espaço disponível. '.repeat(20));
  }
  await new Promise(ok => app.servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${app.servidor.address().port}`;
  const exe = [process.env.CHROME_BIN, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(p => p && existsSync(p));
  browser = await chromium.launch({ executablePath: exe });
  const contexto = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const pagina = await contexto.newPage(); pagina.setDefaultTimeout(10000);
  pagina.on('pageerror', e => erros.push(e.message));
  await pagina.addInitScript(() => {
    if (!localStorage.getItem('contextflow.biblioteca.visual')) localStorage.setItem('contextflow.biblioteca.visual', JSON.stringify({ leitura: { mostrarTempos: false, textoCorrido: true } }));
  });
  await pagina.goto(base); await pagina.locator('tr[data-id="visual-0"]').waitFor();
  const painel = pagina.locator('#painel-colunas'), abrir = pagina.locator('#abrir-colunas');
  const esperar = () => pagina.waitForTimeout(120);
  const ler = () => pagina.evaluate(() => ({ visual: JSON.parse(localStorage.getItem('contextflow.biblioteca.visual')), altura: localStorage.getItem('contextflow.biblioteca.altura') }));
  const expandir = async () => { if (!(await painel.isVisible())) { await abrir.click(); await esperar(); } };
  const teste = async (nome, fn) => {
    total++;
    try { await fn(); console.log(`PASS ${nome}`); }
    catch (e) { falhas.push(nome); console.error(`FAIL ${nome}: ${e.stack}`); await pagina.screenshot({ path: join(evidencia, `falha-${total}.png`) }).catch(() => {}); }
  };
  await teste('Acesso único, três grupos horizontais, fechar/Escape e espaço recuperado', async () => {
    assert.ok(!(await painel.isVisible()));
    assert.equal(await pagina.getByRole('button', { name: 'Visualização', exact: true }).count(), 1);
    assert.equal(await pagina.getByRole('button', { name: 'Colunas', exact: true }).count(), 0);
    const fechado = await pagina.locator('#biblioteca-viewport').boundingBox();
    await abrir.focus(); await abrir.press('Enter'); await esperar();
    assert.equal(await abrir.getAttribute('aria-expanded'), 'true');
    const geometria = await painel.evaluate(el => ({ altura: el.getBoundingClientRect().height, grupos: [...el.querySelectorAll('.visualizacao-grupo')].map(g => ({ x:g.getBoundingClientRect().x,y:g.getBoundingClientRect().y,w:g.getBoundingClientRect().width })) }));
    assert.equal(geometria.grupos.length, 3);
    assert.ok(geometria.grupos.every(g => Math.abs(g.y - geometria.grupos[0].y) < 2));
    assert.ok(geometria.altura < 185, `painel alto demais: ${geometria.altura}`);
    const aberto = await pagina.locator('#biblioteca-viewport').boundingBox();
    assert.ok(fechado.height - aberto.height > 100, 'tabela deve ceder espaço ao painel');
    console.log(`Medidas desktop: painel=${geometria.altura}px, tabela aberta=${aberto.height}px, tabela recolhida=${fechado.height}px`);
    await pagina.screenshot({ path: join(evidencia, 'desktop-aberto.png') });
    await pagina.locator('#fechar-visualizacao').click(); await esperar();
    assert.ok(await abrir.evaluate(el => el === document.activeElement));
    assert.ok(Math.abs((await pagina.locator('#biblioteca-viewport').boundingBox()).height - fechado.height) < 2);
    await pagina.screenshot({ path: join(evidencia, 'desktop-recolhido.png') });
    await expandir(); await pagina.locator('#altura-linhas').focus(); await pagina.keyboard.press('Escape');
    assert.ok(!(await painel.isVisible())); assert.equal(await abrir.getAttribute('aria-expanded'), 'false');
    assert.ok(await abrir.evaluate(el => el === document.activeElement));
  });
  await teste('Controles imediatos e persistência após navegação, reload e novo contexto', async () => {
    await expandir(); await painel.getByLabel('Canal', { exact: true }).uncheck();
    await pagina.locator('#altura-linhas').focus(); await pagina.keyboard.press('End');
    await pagina.locator('#aumentar-fonte').click(); await pagina.locator('#aumentar-fonte').click();
    await pagina.locator('tr[data-id="visual-0"] input').check();
    const th = pagina.locator('th[data-coluna="titulo"]'); const handle = th.locator('[role="separator"]');
    const box = await handle.boundingBox(), w = await th.evaluate(el => el.getBoundingClientRect().width);
    await pagina.mouse.move(box.x + box.width/2,box.y + box.height/2); await pagina.mouse.down();
    await pagina.mouse.move(box.x + box.width/2 + 560-w,box.y + box.height/2,{steps:5}); await pagina.mouse.up(); await esperar();
    let p = await ler(); assert.equal(p.altura, '600'); assert.equal(p.visual.fonteResumo, 15); assert.equal(p.visual.colunas.canal,false); assert.ok(Math.abs(p.visual.larguras.titulo-560)<2);
    assert.equal(await pagina.locator('th[data-coluna="canal"]').isVisible(),false);
    assert.equal(await pagina.locator('tr[data-id="visual-0"]').evaluate(el=>Math.round(el.getBoundingClientRect().height)),600);
    await pagina.locator('[data-aba="configuracoes"]').click(); await pagina.locator('[data-aba="biblioteca"]').click();
    assert.ok(await painel.isVisible()); assert.ok(await pagina.locator('tr[data-id="visual-0"] input').isChecked());
    await pagina.reload(); await pagina.locator('tr[data-id="visual-0"]').waitFor(); assert.ok(!(await painel.isVisible()));
    assert.deepEqual(await ler(),p);
    const estado = await contexto.storageState(); const novo = await browser.newContext({ storageState:estado, viewport:{width:1440,height:1000} });
    const outra = await novo.newPage(); await outra.goto(base); await outra.locator('tr[data-id="visual-0"]').waitFor();
    assert.equal(await outra.locator('#altura-linhas').inputValue(),'600');
    assert.equal(await outra.locator('#fonte-valor').textContent(),'15 px');
    assert.equal(await outra.locator('th[data-coluna="canal"]').isVisible(),false); await novo.close();
  });
  await teste('Restauros individuais e geral preservam modo, seleção, filtro e leitura', async () => {
    await expandir(); await pagina.locator('#restaurar-altura').click();
    assert.equal((await ler()).altura,'136'); assert.equal((await ler()).visual.fonteResumo,15);
    await pagina.locator('#restaurar-fonte').click(); assert.equal((await ler()).visual.fonteResumo,13);
    await pagina.locator('#restaurar-larguras').click(); assert.deepEqual((await ler()).visual.larguras,{});
    await painel.getByLabel('Canal',{exact:true}).uncheck(); await pagina.locator('#aumentar-fonte').click();
    await pagina.locator('#altura-linhas').focus(); await pagina.keyboard.press('End');
    await pagina.locator('button[data-modo="compacto"]').click();
    await pagina.locator('tr[data-id="visual-0"] input').check();
    const busca=pagina.locator('input[type="search"]'); await busca.fill('Vídeo teste'); await pagina.waitForTimeout(350);
    await pagina.locator('#restaurar-visualizacao').click(); await esperar();
    const p=await ler(); assert.equal(p.altura,'136'); assert.equal(p.visual.fonteResumo,13); assert.equal(p.visual.modo,'compacto');
    assert.ok(Object.values(p.visual.colunas).every(Boolean)); assert.deepEqual(p.visual.larguras,{});
    assert.deepEqual(p.visual.leitura,{mostrarTempos:false,textoCorrido:true});
    assert.ok(await pagina.locator('tr[data-id="visual-0"] input').isChecked()); assert.equal(await busca.inputValue(),'Vídeo teste');
    assert.equal(await pagina.locator('tr[data-id="visual-0"]').evaluate(el=>Math.round(el.getBoundingClientRect().height)),64);
    await pagina.locator('button[data-modo="ampliado"]').click();
    assert.equal(await pagina.locator('tr[data-id="visual-0"]').evaluate(el=>Math.round(el.getBoundingClientRect().height)),136);
  });
  await teste('Responsivo 1280/1024/768/390/320 sem sobreposição ou transbordo horizontal', async () => {
    for(const largura of [1280,1024,768,390,320]) {
      await pagina.setViewportSize({width:largura,height:900}); await expandir(); await esperar();
      const medidas=await painel.evaluate(el=>{const p=el.getBoundingClientRect();return{scroll:el.scrollWidth,client:el.clientWidth,grupos:[...el.querySelectorAll('.visualizacao-grupo')].map(g=>{const r=g.getBoundingClientRect();return{x:r.x,y:r.y,right:r.right,bottom:r.bottom}}),left:p.left,right:p.right}});
      assert.ok(medidas.scroll<=medidas.client+1,`scroll horizontal no painel a ${largura}`);
      assert.ok(medidas.grupos.every(g=>g.x>=medidas.left&&g.right<=medidas.right+1),`grupo escapou a ${largura}`);
      assert.ok(await pagina.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),`página larga a ${largura}`);
      if(largura<=390) assert.ok(medidas.grupos[1].y>=medidas.grupos[0].bottom);
      await painel.screenshot({path:join(evidencia,`painel-${largura}.png`)});
      await pagina.locator('#fechar-visualizacao').click(); assert.ok(await abrir.isVisible());
    }
    assert.deepEqual(erros,[]);
  });
  console.log(`${total-falhas.length}/${total} cenários de Visualização aprovados`); if(falhas.length)process.exitCode=1;
}finally{await browser?.close();await app.encerrar();}
