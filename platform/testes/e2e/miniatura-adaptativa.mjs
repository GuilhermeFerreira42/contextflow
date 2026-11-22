/** Item 8: dimensões reais, controles reais, dados descartáveis; sem serviços externos. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
mkdirSync(join(raiz, 'testes/.tmp'), { recursive: true });
const dados = mkdtempSync(join(raiz, 'testes/.tmp/miniatura-layout-'));
const evidencia = resolve(process.env.CONTEXTFLOW_EVIDENCIAS ?? dados);
mkdirSync(evidencia, { recursive: true });
const app = criarAplicacao(carregarConfig({ ...process.env, CONTEXTFLOW_DADOS: dados, CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste' }));
let browser, pagina;
const medidas = [], falhas = [], erros = [];
let cenarios = 0;
try {
  app.iniciarPersistencia();
  const imagem = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#234b68"/></svg>');
  for (const [i, titulo, mini] of [[1, 'Arquitetura limpa na prática: um caso real de refatoração com título longo para leitura em várias linhas. '.repeat(4), imagem], [2, 'Título curto', imagem], [3, 'Vídeo sem imagem e com título longo para conferir o fallback da miniatura', null]]) {
    app.banco.db.prepare(`INSERT INTO videos(id,youtube_id,titulo,url,miniatura_url,estado,criado_em,atualizado_em)
      VALUES(?,?,?,?,?,'pronto','2026-11-22','2026-11-22')`).run(`layout-${i}`, `layout0000${i}x`, titulo, `https://youtu.be/layout0000${i}x`, mini);
    app.banco.db.prepare(`INSERT INTO resumos VALUES(?,'fixture','modelo','v1','r1',?,'pronto',NULL,'2026','2026')`).run(`layout-${i}`, '# Resumo de teste\n\n' + 'Texto extenso preservado na coluna de resumo. '.repeat(50));
  }
  await new Promise(ok => app.servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${app.servidor.address().port}`;
  const executavel = [process.env.CHROME_BIN, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(p => p && existsSync(p));
  browser = await chromium.launch({ executablePath: executavel });
  pagina = await browser.newPage({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  pagina.setDefaultTimeout(10000);
  pagina.on('pageerror', e => erros.push(e.message));
  await pagina.route(/^https?:\/\/(?!127\.0\.0\.1)/, r => r.abort());
  await pagina.addInitScript(() => { if (!localStorage.getItem('contextflow.biblioteca.visual')) localStorage.setItem('contextflow.biblioteca.visual', JSON.stringify({ modo: 'ampliado', colunas: { canal: false, duracao: false, adicionado: false, estado: false, resumo: true, 'resumo-estado': false } })); });
  await pagina.goto(base);
  await pagina.locator('tr[data-id="layout-1"]').waitFor();
  await pagina.locator('tr[data-id="layout-1"] input').check();
  await pagina.locator('#abrir-colunas').click();
  const altura = async valor => {
    const slider = pagina.locator('#altura-linhas');
    const caixa = await slider.boundingBox();
    await pagina.mouse.click(caixa.x + 8 + (caixa.width - 16) * (valor - 64) / 536, caixa.y + caixa.height / 2);
    const atual = Number(await slider.inputValue());
    for (let n = 0; n < Math.abs(valor - atual); n++) await slider.press(valor > atual ? 'ArrowRight' : 'ArrowLeft');
    await pagina.waitForTimeout(90);
  };
  const largura = async valor => {
    const th = pagina.locator('th[data-coluna="titulo"]');
    const separador = th.locator('[role="separator"]');
    await separador.scrollIntoViewIfNeeded();
    const caixa = await separador.boundingBox();
    const atual = await th.evaluate(el => el.getBoundingClientRect().width);
    await pagina.mouse.move(caixa.x + caixa.width / 2, caixa.y + caixa.height / 2);
    await pagina.mouse.down();
    await pagina.mouse.move(caixa.x + caixa.width / 2 + valor - atual, caixa.y + caixa.height / 2, { steps: 5 });
    await pagina.mouse.up(); await pagina.waitForTimeout(120);
  };
  const medir = async (id = 'layout-1') => pagina.locator(`tr[data-id="${id}"]`).evaluate(linha => {
    const celula = linha.querySelector('.celula-video'), mini = linha.querySelector('.miniatura'), texto = linha.querySelector('.celula-video-texto');
    const m = mini.getBoundingClientRect(), t = texto.getBoundingClientRect(), c = celula.getBoundingClientRect(), r = linha.getBoundingClientRect();
    return { layout: celula.dataset.layout, largura: m.width, altura: m.height, textoTopo: t.top, textoFim: t.bottom, imagemFim: m.bottom, imagemDireita: m.right, celulaDireita: c.right, celulaFim: c.bottom, linhaFim: r.bottom };
  });
  const teste = async (nome, fn) => {
    cenarios++;
    try { await fn(); console.log(`PASS ${nome}`); }
    catch (e) { falhas.push(`${nome}: ${e.message}`); console.error(`FAIL ${nome}: ${e.message}`); await pagina.screenshot({ path: join(evidencia, `falha-${cenarios}.png`) }); }
  };
  await teste('Aumentar altura não diminui a miniatura ao trocar lateral por empilhado', async () => {
    await largura(700);
    let anterior = 0;
    for (const px of [280, 296, 304, 312, 328, 344, 360, 400, 500, 600]) {
      await altura(px); const m = await medir(); medidas.push({ px, ...m });
      assert.ok(m.largura >= anterior - 1, `imagem diminuiu de ${anterior.toFixed(1)} para ${m.largura.toFixed(1)} ao subir para ${px}px`);
      anterior = m.largura;
    }
    const m = await medir(); assert.equal(m.layout, 'empilhado');
    assert.ok(m.textoTopo >= m.imagemFim, 'título deve ficar abaixo da imagem');
    assert.ok(m.textoFim <= m.celulaFim + 1 && m.textoFim <= m.linhaFim - 4, 'todo o título/subtexto deve caber na linha');
    await pagina.screenshot({ path: join(evidencia, 'linha-alta-700.png') });
  });
  await teste('Coluna larga usa altura disponível e mantém o título inteiro abaixo', async () => {
    await altura(600); await largura(1100);
    const m = await medir(); medidas.push({ coluna: 1100, ...m });
    assert.equal(m.layout, 'empilhado');
    assert.ok(m.largura > 850 && m.altura > 450, 'imagem alta não deve parar no tamanho antigo');
    assert.ok(m.textoFim <= m.celulaFim + 1 && m.textoFim <= m.linhaFim - 4, 'texto inferior cortado');
    assert.ok(Math.abs(m.largura / m.altura - 16 / 9) < 0.015, 'imagem distorcida');
    await pagina.screenshot({ path: join(evidencia, 'linha-alta-1100.png') });
  });
  await teste('Redimensionar/reduzir altura é reversível e conserva seleção', async () => {
    await largura(700); await altura(136);
    assert.equal((await medir()).layout, 'lateral');
    assert.ok(await pagina.locator('tr[data-id="layout-1"] input').isChecked());
    await pagina.screenshot({ path: join(evidencia, 'linha-padrao.png') });
    await pagina.locator('button[data-modo="compacto"]').click();
    assert.equal((await medir()).layout, 'lateral');
    assert.deepEqual(erros, []);
  });
  await teste('Larguras estreitas/largas, título curto e fallback mantêm limites e proporção', async () => {
    await pagina.locator('button[data-modo="ampliado"]').click();
    for (const px of [64, 136, 600]) {
      await altura(px);
      for (const coluna of [180, 260, 420, 700, 1100]) {
        await largura(coluna);
        for (const id of ['layout-1', 'layout-2', 'layout-3']) {
          const m = await medir(id);
          assert.ok(m.largura > 15 && m.altura > 10, `imagem desapareceu em ${px}/${coluna}`);
          assert.ok(m.imagemDireita <= m.celulaDireita + 1, 'miniatura escapou da coluna');
          assert.ok(Math.abs(m.largura / m.altura - 16 / 9) < 0.025, `proporção mudou em ${px}/${coluna}`);
          if (m.layout === 'empilhado') {
            assert.ok(m.textoTopo >= m.imagemFim - 1, 'título sobrepôs a imagem');
            assert.ok(m.textoFim <= m.celulaFim + 1, `título cortado ao empilhar em ${px}/${coluna}/${id}: ${JSON.stringify(m)}`);
          }
        }
      }
    }
    assert.ok(await pagina.locator('tr[data-id="layout-3"] .miniatura-vazia').count());
    await largura(700); await altura(600);
    await pagina.reload(); await pagina.locator('tr[data-id="layout-1"]').waitFor();
    await pagina.waitForTimeout(150);
    assert.equal((await medir()).layout, 'empilhado');
    assert.ok(Math.abs(await pagina.locator('th[data-coluna="titulo"]').evaluate(el => el.getBoundingClientRect().width) - 700) < 2);
    assert.equal(await pagina.locator('#altura-linhas').inputValue(), '600');
    assert.deepEqual(erros, []);
    await pagina.screenshot({ path: join(evidencia, 'linha-alta-apos-reload.png') });
  });
  writeFileSync(join(evidencia, 'medidas.json'), JSON.stringify(medidas, null, 2));
  console.log(`${cenarios - falhas.length}/${cenarios} cenários de miniatura aprovados`);
  if (falhas.length) process.exitCode = 1;
} finally { await browser?.close(); await app.encerrar(); }
