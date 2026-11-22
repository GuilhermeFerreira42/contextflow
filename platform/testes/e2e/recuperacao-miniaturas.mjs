/** Recuperação de capa com CDN controlado e decodificação real pelo navegador. */
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
mkdirSync(join(raiz, 'testes/.tmp'), { recursive: true });
const dados = mkdtempSync(join(raiz, 'testes/.tmp/recuperar-capa-'));
const evidencias = resolve(process.env.CONTEXTFLOW_EVIDENCIAS ?? dados); mkdirSync(evidencias, { recursive: true });
const exe = [process.env.CHROME_BIN, chromium.executablePath(), 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/chromium'].find(p => p && existsSync(p));
const browser = await chromium.launch({ executablePath: exe });
let app, cdn;
try {
  const pagina = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  pagina.setDefaultTimeout(10000);
  const png = Buffer.from(await pagina.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 180;
    c.getContext('2d').fillStyle = '#247a58'; c.getContext('2d').fillRect(0, 0, 320, 180);
    return c.toDataURL('image/png').split(',')[1];
  }), 'base64');
  const erros = []; pagina.on('pageerror', e => erros.push(e.message));
  let pedidos = 0, recusar = false;
  cdn = createServer(async (req, res) => {
    pedidos++; await new Promise(ok => setTimeout(ok, 100));
    if (recusar || req.url.startsWith('/vi_lc/')) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'image/png' }); res.end(png);
  });
  await new Promise(ok => cdn.listen(0, '127.0.0.1', ok));
  const cdnUrl = `http://127.0.0.1:${cdn.address().port}`;
  app = criarAplicacao(carregarConfig({ CONTEXTFLOW_DADOS: dados, CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste' }), {
    httpMiniaturas: (url, op) => fetch(cdnUrl + new URL(String(url)).pathname, op),
  }); app.iniciarPersistencia();
  for (const [id, yid, titulo] of [['auto', 'aaaaaaaaaaa', 'Capa automática'], ['manual', 'bbbbbbbbbbb', 'Capa recuperada'], ['erro', 'ccccccccccc', 'Capa indisponível']]) {
    app.banco.db.prepare(`INSERT INTO videos(id,youtube_id,titulo,url,miniatura_url,estado,criado_em,atualizado_em)
      VALUES(?,?,?,?,?,'pronto','2026','2026')`).run(id, yid, titulo, `https://youtu.be/${yid}`, `https://i.ytimg.com/vi_lc/${yid}/maxresdefault_en-US.jpg`);
  }
  for (const id of ['manual', 'erro']) app.banco.db.prepare("INSERT INTO miniaturas(video_id,falha,tentativas,atualizado_em) VALUES(?,'HTTP 404',3,'2026')").run(id);
  await new Promise(ok => app.servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${app.servidor.address().port}`;
  await pagina.route('https://i.ytimg.com/**', r => r.fulfill({ status: 404, body: '' }));
  const carregou = id => pagina.waitForFunction(id => {
    const img = document.querySelector(`tr[data-id="${id}"] .miniatura img`);
    return img?.complete && img.naturalWidth === 320;
  }, id);
  await pagina.goto(base); await carregou('auto');
  assert.equal(pedidos, 2); console.log('PASS URL localizada404 recupera JPEG/PNG padrão e decodifica imagem');
  await pagina.locator('tr[data-id="manual"] input').check();
  const recuperar = pagina.locator('tr[data-id="manual"] .tentar-miniatura');
  await recuperar.click(); assert.ok(await recuperar.isDisabled());
  await carregou('manual'); assert.equal(await recuperar.count(), 0);
  assert.ok(await pagina.locator('tr[data-id="manual"] input').isChecked());
  await pagina.locator('tr[data-id="manual"] .abrir-painel').click();
  await pagina.waitForFunction(() => { const i = document.querySelector('#painel-miniatura img'); return i?.complete && i.naturalWidth === 320; });
  await pagina.keyboard.press('Escape');
  const antes = pedidos; await pagina.reload(); await carregou('auto'); await carregou('manual');
  assert.equal(pedidos, antes); console.log('PASS Tentativa manual após cache esgotado, seleção/leitura e reload usam cópia local');
  await pagina.screenshot({ path: join(evidencias, 'capas-recuperadas.png') });
  recusar = true;
  await pagina.locator('tr[data-id="erro"] .tentar-miniatura').click();
  await pagina.waitForFunction(() => document.querySelector('tr[data-id="erro"] .sem-miniatura')?.textContent === 'Miniatura indisponível');
  assert.ok(await pagina.locator('tr[data-id="erro"] .tentar-miniatura').isEnabled());
  assert.equal(pedidos, antes + 3); await pagina.waitForTimeout(300); assert.equal(pedidos, antes + 3);
  assert.deepEqual(erros, []); console.log('PASS Falha declarada sem laço e sem exceções JavaScript');
  console.log('3/3 cenários de recuperação aprovados');
} finally { await browser.close(); await app?.encerrar(); cdn?.closeAllConnections(); if (cdn) await new Promise(ok => cdn.close(ok)); }
