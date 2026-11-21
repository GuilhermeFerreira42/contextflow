/** Regressão Playwright: dados descartáveis, sem YouTube nem banco pessoal. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
mkdirSync(join(raiz, 'testes/.tmp'), { recursive: true });
const dados = mkdtempSync(join(raiz, 'testes/.tmp/refinamentos-ui-'));
const evidencia = resolve(process.env.CONTEXTFLOW_EVIDENCIAS ?? dados);
mkdirSync(evidencia, { recursive: true });
const app = criarAplicacao(carregarConfig({
  ...process.env, CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste', CONTEXTFLOW_DADOS: dados,
}));
let browser;
const falhas = [];
const erros = [];
let cenarios = 0;
try {
  app.iniciarPersistencia();
  const inserir = app.banco.db.prepare(`INSERT INTO videos
    (id,youtube_id,titulo,canal_id,canal_nome,duracao_segundos,url,miniatura_url,estado,criado_em,atualizado_em)
    VALUES(?,?,?,?,?,300,?,?,'pronto','2026-11-01','2026-11-01')`);
  const resumo = 'O estudo acompanha a evolução de uma biblioteca pessoal. A equipe organiza os vídeos, preserva a fonte e compara decisões com resultados verificáveis. '.repeat(100);
  const imagem = 'data:image/svg+xml,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#234b68"/><path d="m140 60 50 30-50 30z" fill="#b9d9ff"/></svg>');
  app.banco.executarTransacao(() => {
    for (let i = 0; i < 5000; i++) {
      const id = `volume-${String(i).padStart(5, '0')}`;
      inserir.run(id, `v${String(i).padStart(10, '0')}`, `Estudo ${String(i).padStart(5, '0')}`,
        'canal-estudo', 'Canal de estudo', `https://www.youtube.com/watch?v=v${String(i).padStart(10, '0')}`, imagem);
      if (i < 8) app.banco.db.prepare(`INSERT INTO resumos VALUES(?,'fixture','modelo','p1','r1',?,'pronto',NULL,'2026','2026')`).run(id, resumo);
    }
  });
  await new Promise(ok => app.servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${app.servidor.address().port}`;
  const executavel = [process.env.CHROME_BIN, chromium.executablePath(),
    'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium', '/usr/bin/google-chrome',
  ].find(p => p && existsSync(p));
  browser = await chromium.launch({ executablePath: executavel, headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.on('pageerror', e => erros.push(e.message));
  const frames = () => page.evaluate(() => new Promise(ok => requestAnimationFrame(() => requestAnimationFrame(ok))));
  const pronto = async () => {
    await page.goto(base);
    await page.locator('tr[data-id="volume-00000"]').waitFor();
    await page.waitForFunction(() => document.querySelector('tr[data-id="volume-00000"] .resumo-linha')?.textContent.includes('O estudo'));
  };
  const painel = async () => {
    if (!await page.locator('#painel-colunas').isVisible()) await page.locator('#abrir-colunas').click();
  };
  const colunas = async nomes => {
    await painel();
    for (const caixa of await page.locator('#colunas-lista input').all()) {
      const nome = await caixa.locator('..').innerText();
      await caixa.setChecked(nomes.includes(nome));
    }
    await frames();
  };
  const altura = async valor => {
    await painel();
    let atual = Number((await page.locator('#altura-valor').innerText()).match(/\d+/)[0]);
    while (atual !== valor) {
      await page.locator(atual < valor ? '#aumentar-altura' : '#diminuir-altura').click();
      atual = Number((await page.locator('#altura-valor').innerText()).match(/\d+/)[0]);
    }
    await frames();
  };
  const medir = () => page.locator('tr[data-id="volume-00000"]').evaluate(linha => {
    const img = linha.querySelector('.miniatura').getBoundingClientRect();
    const texto = linha.querySelector('.resumo-linha').getBoundingClientRect();
    return { linha: linha.getBoundingClientRect().height, imagem: { largura: img.width, altura: img.height }, texto: texto.height };
  });
  const teste = async (nome, fn) => {
    cenarios++;
    try { await fn(); console.log(`PASS ${nome}`); }
    catch (e) {
      falhas.push(nome); console.error(`FAIL ${nome}: ${e.stack}`);
      await page.screenshot({ path: join(evidencia, `falha-${cenarios}.png`) }).catch(() => {});
    }
  };
  await pronto();
  await teste('seleção estreita com colunas ocultas e espaçadores virtuais', async () => {
    for (const visiveis of [[], ['Conteúdo do resumo'], ['Situação do resumo'], ['Canal', 'Conteúdo do resumo']]) {
      await colunas(visiveis);
      const m = await page.locator('tr[data-id="volume-00000"]').evaluate(linha => {
        const selecao = linha.querySelector('.col-selecao').getBoundingClientRect();
        const video = linha.querySelector('[data-coluna="titulo"]').getBoundingClientRect();
        return { selecao: selecao.width, inicioVideo: video.left - linha.getBoundingClientRect().left,
          colSpan: document.querySelector('tr[data-espacador] td').colSpan,
          visiveis: [...linha.cells].filter(c => getComputedStyle(c).display !== 'none').length };
      });
      console.log('  colunas', JSON.stringify({ visiveis, ...m }));
      assert.ok(Math.abs(m.selecao - 46) < 1, `seleção deve ter 46px: ${m.selecao}`);
      assert.ok(m.inicioVideo < 48, `vídeo deslocado: ${m.inicioVideo}`);
      assert.equal(m.colSpan, m.visiveis, 'espaçador não pode criar colunas fantasmas');
    }
    await page.screenshot({ path: join(evidencia, 'grade-alinhada.png') });
  });
  await teste('três alturas aumentam imagem proporcional e texto visível', async () => {
    await colunas(['Conteúdo do resumo']);
    const medidas = [];
    for (const valor of [88, 136, 200]) {
      await altura(valor);
      const m = await medir(); medidas.push(m);
      assert.ok(Math.abs(m.linha - valor) < 1, `linha ${m.linha}, esperado ${valor}`);
      assert.ok(Math.abs(m.imagem.largura / m.imagem.altura - 16 / 9) < 0.05);
      await page.screenshot({ path: join(evidencia, `altura-${valor}.png`) });
    }
    console.log('  alturas', JSON.stringify(medidas));
    for (let i = 1; i < medidas.length; i++) {
      assert.ok(medidas[i].imagem.largura > medidas[i-1].imagem.largura + 8, 'miniatura deve crescer');
      assert.ok(medidas[i].texto > medidas[i-1].texto + 15, 'mais resumo deve ficar visível');
    }
    await page.locator('[data-modo="compacto"]').click(); await frames();
    assert.ok(Math.abs((await medir()).linha - 64) < 1);
    await page.locator('[data-modo="ampliado"]').click();
    await altura(136);
  });
  await teste('lateral no topo, logo estável em hover/foco e dez ciclos reais', async () => {
    const botao = page.locator('#recolher-barra');
    const posicao = await botao.boundingBox();
    assert.ok(posicao.y < 70, `controle precisa ficar no topo: y=${posicao.y}`);
    for (let i = 0; i < 10; i++) {
      await botao.click();
      assert.equal(await botao.getAttribute('aria-expanded'), 'false');
      await page.waitForFunction(() => {
        const b = document.querySelector('#recolher-barra').getBoundingClientRect();
        return b.width === 36 && b.x < 15;
      });
      const antes = await botao.boundingBox();
      await page.locator('#abrir-colunas').focus();
      await page.mouse.move(700, 60);
      await page.waitForFunction(() => getComputedStyle(document.querySelector('#recolher-barra .marca-simbolo')).opacity === '1');
      assert.ok(await page.locator('#recolher-barra .marca-simbolo').isVisible(), 'logo visível em repouso');
      assert.equal(await page.locator('#recolher-barra .marca-simbolo').evaluate(el => getComputedStyle(el).opacity), '1');
      await botao.hover(); await frames();
      assert.equal(await page.locator('#recolher-barra .marca-simbolo').evaluate(el => getComputedStyle(el).opacity), '0');
      assert.deepEqual(await botao.boundingBox(), antes, 'hover não desloca botão');
      if (i === 0) await page.screenshot({ path: join(evidencia, 'lateral-hover.png') });
      await botao.click();
      assert.equal(await botao.getAttribute('aria-expanded'), 'true');
      await page.waitForFunction(() => Math.abs(document.querySelector('.barra-lateral').getBoundingClientRect().width - 256) < 1);
    }
    await botao.click(); await pronto();
    assert.equal(await botao.getAttribute('aria-expanded'), 'false');
    // Tab real ativa :focus-visible; focus() após clique mantém modalidade
    // de ponteiro no Chrome e não comprova navegação pelo teclado.
    await page.locator('.pular-conteudo').focus();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'recolher-barra');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#recolher-barra .marca-simbolo')).opacity === '0');
    assert.equal(await page.locator('#recolher-barra .marca-simbolo').evaluate(el => getComputedStyle(el).opacity), '0');
    await botao.press('Enter'); assert.equal(await botao.getAttribute('aria-expanded'), 'true');
    await botao.press('Space'); assert.equal(await botao.getAttribute('aria-expanded'), 'false');
    await page.mouse.move(700, 60); await page.locator('#abrir-colunas').focus();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('#recolher-barra .marca-simbolo')).opacity === '1');
    await frames();
    console.log('  logo recolhida', JSON.stringify(await page.locator('#recolher-barra').evaluate(el => {
      const logo = el.querySelector('.marca-simbolo'), b = el.getBoundingClientRect(), l = logo.getBoundingClientRect();
      return {botao: {x:b.x,y:b.y,w:b.width,h:b.height}, logo:{x:l.x,y:l.y,w:l.width,h:l.height}, display:getComputedStyle(logo).display,
        opacity:getComputedStyle(logo).opacity, background:getComputedStyle(logo).backgroundImage};
    })));
    assert.ok(await page.locator('#recolher-barra .marca-simbolo').isVisible());
    await page.screenshot({ path: join(evidencia, 'lateral-recolhida.png') });
    await botao.click();
  });
  await teste('rolagem de 5.000 vídeos preserva identidade e seleção nas alturas', async () => {
    await pronto();
    await page.locator('tr[data-id="volume-00000"] input[type="checkbox"]').check();
    for (const valor of [88, 136, 200]) {
      await altura(valor);
      await page.locator('#biblioteca-viewport').evaluate((v, a) => { v.scrollTop = a * 3000; }, valor);
      await page.waitForFunction(() => {
        const v = document.querySelector('#biblioteca-viewport').getBoundingClientRect();
        const r = document.querySelector('tr[data-id="volume-03000"]')?.getBoundingClientRect();
        return r && r.bottom > v.top && r.top < v.bottom;
      });
      assert.ok(await page.locator('tr[data-id]').count() < 100);
      await page.locator('#biblioteca-viewport').evaluate(v => { v.scrollTop = 0; });
      await page.locator('tr[data-id="volume-00000"]').waitFor();
      assert.ok(await page.locator('tr[data-id="volume-00000"] input').isChecked());
    }
  });
  await teste('larguras, navegação e gaveta sem transbordo da página', async () => {
    for (const largura of [1920, 1366, 960, 768, 390]) {
      await page.setViewportSize({ width: largura, height: 1000 }); await frames();
      for (const recolhida of largura > 900 ? [false, true] : [false]) {
        if (largura > 900 && (await page.locator('.aplicativo').getAttribute('data-barra') === 'recolhida') !== recolhida) {
          await page.locator('#recolher-barra').click(); await frames();
        }
        for (const visiveis of [[], ['Conteúdo do resumo'], ['Canal','Duração','Adicionado em','Estado do vídeo','Conteúdo do resumo','Situação do resumo']]) {
          await colunas(visiveis);
          assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `transbordo ${largura}`);
          const caixa = await page.locator('#biblioteca-viewport').boundingBox();
          assert.ok(largura - caixa.x - caixa.width < 35, `Biblioteca deve aproveitar a largura: janela=${largura}, margem=${largura - caixa.x - caixa.width}`);
        }
        for (const aba of ['importacoes', 'configuracoes', 'biblioteca']) {
          if (largura <= 900) await page.locator('#abrir-menu-mobile').click();
          await page.locator(`[data-aba="${aba}"]`).click();
          assert.ok(await page.locator(`[data-tela-nome="${aba}"]`).isVisible());
        }
      }
      if (largura <= 900) {
        await page.locator('#abrir-menu-mobile').click();
        await page.keyboard.press('Escape');
        assert.equal(await page.locator('#abrir-menu-mobile').getAttribute('aria-expanded'), 'false');
      }
      await page.screenshot({ path: join(evidencia, `janela-${largura}.png`) });
    }
  });
  await teste('expansão por toque sem depender de hover', async () => {
    const toque = await browser.newContext({ viewport: { width: 1200, height: 900 }, hasTouch: true, reducedMotion: 'reduce' });
    const p = await toque.newPage();
    try {
      await p.goto(base); await p.locator('#recolher-barra').tap();
      assert.equal(await p.locator('#recolher-barra').getAttribute('aria-expanded'), 'false');
      await p.locator('#recolher-barra').tap();
      assert.equal(await p.locator('#recolher-barra').getAttribute('aria-expanded'), 'true');
    } finally { await toque.close(); }
  });
  await teste('nenhuma exceção JavaScript no navegador', async () => assert.deepEqual(erros, []));
  console.log(`\n${cenarios-falhas.length}/${cenarios} cenários Playwright aprovados. Evidências: ${evidencia}`);
  process.exitCode = falhas.length ? 1 : 0;
} finally {
  await browser?.close();
  await app.encerrar();
}
