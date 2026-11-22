import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { fileURLToPath } from 'node:url';
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const tmp = fileURLToPath(new URL('../.tmp/', import.meta.url)); mkdirSync(tmp, { recursive: true });
async function ambiente(t: { after: (fn: () => Promise<void>) => void }) {
  const pedidos: string[] = [], modo = { falha: false, maxresFalha: false };
  const cdn = createServer((req, res) => {
    pedidos.push(req.url!);
    if (modo.falha || req.url!.startsWith('/vi_lc/') || (modo.maxresFalha && req.url!.endsWith('maxresdefault.jpg'))) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'content-type': 'image/png' }); res.end(PNG);
  });
  await new Promise<void>(ok => cdn.listen(0, '127.0.0.1', ok));
  const cdnUrl = `http://127.0.0.1:${(cdn.address() as { port: number }).port}`;
  const pasta = mkdtempSync(join(tmp, 'capas-'));
  const app = criarAplicacao(carregarConfig({ CONTEXTFLOW_DADOS: pasta, CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste' }), {
    httpMiniaturas: (url, op) => fetch(cdnUrl + new URL(String(url)).pathname, op),
  });
  app.iniciarPersistencia();
  const id = 'capa-teste';
  app.banco.db.prepare(`INSERT INTO videos(id,youtube_id,titulo,url,miniatura_url,estado,criado_em,atualizado_em)
    VALUES(?,'abcdefghijk','Teste','https://youtu.be/abcdefghijk',?,'pronto','2026','2026')`).run(id, 'https://i.ytimg.com/vi_lc/abcdefghijk/maxresdefault_en-US.jpg');
  await new Promise<void>(ok => app.servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${(app.servidor.address() as { port: number }).port}`;
  t.after(async () => { await app.encerrar(); cdn.closeAllConnections(); await new Promise<void>(ok => cdn.close(() => ok())); });
  const buscar = (forcar = false) => fetch(`${base}/api/miniaturas/${id}/buscar`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ forcar }) });
  return { app, base, id, pedidos, modo, buscar };
}
test('capas: localizada404 recupera padrão e serve bytes locais sem mudar fonte', async t => {
  const a = await ambiente(t);
  assert.equal((await a.buscar()).status, 200);
  assert.equal(a.pedidos.length, 2); assert.ok(a.pedidos[1]!.endsWith('/maxresdefault.jpg'));
  const imagem = await fetch(`${a.base}/api/miniaturas/${a.id}`);
  assert.equal(imagem.status, 200); assert.deepEqual(Buffer.from(await imagem.arrayBuffer()), PNG);
  assert.match(imagem.headers.get('cache-control')!, /no-cache/);
  assert.equal((await fetch(`${a.base}/api/miniaturas/${a.id}`, { headers: { 'if-none-match': imagem.headers.get('etag')! } })).status, 304);
  const original = a.app.banco.db.prepare('SELECT miniatura_url FROM videos').get()!.miniatura_url;
  assert.match(String(original), /vi_lc/);
  await a.buscar(); assert.equal(a.pedidos.length, 2, 'cache deve evitar novas buscas');
});
test('capas: maxres ausente usa hq; falha esgotada permite recuperação explícita sem laço', async t => {
  const a = await ambiente(t); a.modo.falha = true;
  assert.equal((await a.buscar()).status, 404); assert.equal(a.pedidos.length, 3);
  await a.buscar(); assert.equal(a.pedidos.length, 3);
  a.modo.falha = false; a.modo.maxresFalha = true;
  assert.equal((await a.buscar(true)).status, 200); assert.equal(a.pedidos.length, 6);
  assert.ok(a.pedidos.at(-1)!.endsWith('hqdefault.jpg'));
  assert.equal(a.app.banco.db.prepare('SELECT tentativas FROM miniaturas').get()!.tentativas, 0);
});
test('capas: chamadas simultâneas usam uma busca e não inventam candidatos para outra origem', async t => {
  const a = await ambiente(t);
  const r = await Promise.all([a.buscar(), a.buscar(), a.buscar()]);
  assert.ok(r.every(x => x.status === 200)); assert.equal(a.pedidos.length, 2);
  a.app.banco.db.exec("DELETE FROM miniaturas; UPDATE videos SET miniatura_url='https://example.com/vi_lc/abcdefghijk/ausente.jpg'");
  a.modo.falha = true; const antes = a.pedidos.length;
  assert.equal((await a.buscar()).status, 404); assert.equal(a.pedidos.length, antes + 1);
});
test('capas: stream sem Content-Length acima de 4MB é interrompido sem salvar arquivo', async t => {
  const a = await ambiente(t);
  const { baixarMiniatura } = await import('../../src/motor/src/integracoes/miniaturas.ts');
  const { RepositorioMiniaturas } = await import('../../src/motor/src/persistencia/repositorio-miniaturas.ts');
  let cancelado = false;
  const http: typeof fetch = async () => new Response(new ReadableStream({
    pull(controlador) { controlador.enqueue(new Uint8Array(1024 * 1024)); },
    cancel() { cancelado = true; },
  }), { headers: { 'content-type': 'image/png' } });
  const r = await baixarMiniatura(a.app.config.pastaDados, new RepositorioMiniaturas(a.app.banco.db), a.id, 'https://example.com/capa.png', http);
  assert.equal(r.ok, false); assert.equal(cancelado, true);
  assert.equal(a.app.banco.db.prepare('SELECT arquivo FROM miniaturas').get()!.arquivo, null);
});
test('capas: arquivo apagado é recuperado e tentativa explícita renova o cache existente', async t => {
  const a = await ambiente(t);
  await a.buscar();
  const arquivo = a.app.banco.db.prepare('SELECT arquivo FROM miniaturas').get()!.arquivo as string;
  unlinkSync(join(a.app.config.pastaDados, 'miniaturas', arquivo));
  assert.equal((await a.buscar()).status, 200); assert.equal(a.pedidos.length, 4);
  assert.equal((await a.buscar(true)).status, 200); assert.equal(a.pedidos.length, 6);
});
