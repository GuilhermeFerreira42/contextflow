import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { fileURLToPath } from 'node:url';

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==', 'base64');
const tmp = fileURLToPath(new URL('../.tmp/', import.meta.url)); mkdirSync(tmp, { recursive: true });

/**
 * Reparo em lote de miniaturas (F6-B, parte D-2).
 *
 * O CDN é local, como no teste da F6-A: o que se verifica é a regra do reparo,
 * não a disponibilidade da internet.
 */
async function ambiente(t: { after: (fn: () => Promise<void>) => void }) {
  const pedidos: string[] = [];
  const cdn = createServer((req, res) => {
    pedidos.push(req.url!);
    if (req.url!.endsWith('hqdefault.jpg')) { res.writeHead(200, { 'content-type': 'image/png' }); res.end(PNG); return; }
    res.writeHead(404); res.end();
  });
  await new Promise<void>((ok) => cdn.listen(0, '127.0.0.1', ok));
  const cdnUrl = `http://127.0.0.1:${(cdn.address() as { port: number }).port}`;
  const pasta = mkdtempSync(join(tmp, 'reparo-'));
  const app = criarAplicacao(carregarConfig({ CONTEXTFLOW_DADOS: pasta, CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste' }), {
    httpMiniaturas: (url, op) => fetch(cdnUrl + new URL(String(url)).pathname, op),
  });
  app.iniciarPersistencia();
  const inserir = app.banco.db.prepare(`INSERT INTO videos(id,youtube_id,titulo,url,miniatura_url,estado,criado_em,atualizado_em)
    VALUES(?,?,?,?,?, 'pronto','2026','2026')`);
  // Vídeo antigo: capa localizada que 404 e SEM arquivo — o caso que o reparo existe para resolver.
  inserir.run('antigo', 'abcdefghijk', 'Antigo', 'https://youtu.be/abcdefghijk', 'https://i.ytimg.com/vi_lc/abcdefghijk/maxresdefault_en-US.jpg');
  // Vídeo cuja capa aponta para um host ARBITRÁRIO (não YouTube) que não responde.
  // `youtube_id` é NOT NULL no schema, então "sem origem" se expressa pelo host da capa.
  inserir.run('sem-origem', 'zzzzzzzzzzz', 'Fonte arbitrária', 'https://exemplo.test/video', 'https://exemplo.test/ausente.png');
  await new Promise<void>((ok) => app.servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${(app.servidor.address() as { port: number }).port}`;
  t.after(async () => { await app.encerrar(); cdn.closeAllConnections(); await new Promise<void>((ok) => cdn.close(() => ok())); });
  const reparar = (corpo: Record<string, unknown> = {}) => fetch(`${base}/api/miniaturas/reparar`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo),
  });
  return { app, base, pedidos, reparar };
}

test('reparo: recupera o que falta, declara falha do que não tem candidato e serve pela origem', async (t) => {
  const a = await ambiente(t);
  const resposta = await a.reparar();
  assert.equal(resposta.status, 200);
  const { dados } = (await resposta.json()) as {
    dados: { total: number; recuperados: number; falhas: { videoId: string; motivo: string }[] };
  };

  // Universo: só quem não tem arquivo local. As duas linhas entram (nenhuma tem cópia).
  assert.equal(dados.total, 2);
  assert.equal(dados.recuperados, 1, 'o vídeo YouTube é recuperável pelo CDN');

  const falha = dados.falhas.find((f) => f.videoId === 'sem-origem');
  assert.ok(falha, 'a fonte sem candidato precisa aparecer no relatório, não sumir');
  assert.equal(dados.falhas.length, 1);

  // A capa recuperada é servida pela própria origem e é o PNG do CDN.
  const imagem = await fetch(`${a.base}/api/miniaturas/antigo`);
  assert.equal(imagem.status, 200);
  assert.deepEqual(Buffer.from(await imagem.arrayBuffer()), PNG);
  assert.equal(imagem.headers.get('content-type')!.startsWith('image/png'), true);

  // Nada de URL inventada para a fonte arbitrária: nenhum pedido saiu do CDN.
  assert.ok(!a.pedidos.some((p) => p.includes('zzzzzzzzzzz')), 'não se infere CDN para host de outra fonte');
  assert.ok(!a.pedidos.some((p) => p.includes('exemplo.test')), 'o host falso não é requisitado');
});

test('reparo: quem já tem cópia local não é rebaixado; só entra com forcar explícito', async (t) => {
  const a = await ambiente(t);
  await a.reparar();
  const antes = a.pedidos.length;

  const semForcar = await a.reparar();
  const { dados: dados1 } = (await semForcar.json()) as { dados: { total: number; recuperados: number } };
  assert.equal(dados1.total, 1, 'só a fonte sem candidato segue pendente');
  assert.equal(dados1.recuperados, 0);
  assert.equal(a.pedidos.length, antes, 'capa boa não é baixada de novo');

  const comForcar = await a.reparar({ forcar: true });
  const { dados: dados2 } = (await comForcar.json()) as { dados: { total: number; recuperados: number } };
  assert.equal(dados2.total, 2, 'forcar inclui quem já está resolvido');
  assert.equal(dados2.recuperados, 1);
  assert.ok(a.pedidos.length > antes, 'forcar refaz a busca');
});

test('reparo: respeita o limite de tentativas e não vira laço', async (t) => {
  const a = await ambiente(t);
  // Vídeo com capa no CDN de OUTRO id: os candidatos derivados do youtubeId
  // falham (maxres 404) e só o hq responde — então o reparo tira o arquivo do zero.
  a.app.banco.db.exec("UPDATE videos SET miniatura_url='https://i.ytimg.com/vi/outroid0000/maxresdefault.jpg' WHERE id='antigo'");
  // Esgota o teto à mão: é o estado em que um vídeo antigo chega depois de três
  // fracassos, e é exatamente o que o reparo NÃO deve furar sozinho.
  a.app.banco.db.exec(`INSERT INTO miniaturas (video_id, arquivo, falha, tentativas, atualizado_em)
    VALUES ('antigo', NULL, 'CDN indisponível', 3, '2026')`);
  const linhasAntes = a.app.banco.db.prepare("SELECT COUNT(*) n FROM miniaturas").get()!.n;

  const antes = a.pedidos.length;
  const r = await a.reparar();
  const { dados } = (await r.json()) as { dados: { recuperados: number; falhas: { videoId: string }[] } };

  assert.equal(dados.recuperados, 0, 'alvo no teto não é recuperado');
  assert.ok(dados.falhas.some((f) => f.videoId === 'antigo'), 'e aparece no relatório com motivo');
  assert.equal(a.pedidos.length, antes, 'nenhum pedido novo ao CDN');
  assert.equal(a.app.banco.db.prepare("SELECT tentativas FROM miniaturas WHERE video_id='antigo'").get()!.tentativas, 3);
  assert.equal(a.app.banco.db.prepare("SELECT COUNT(*) n FROM miniaturas").get()!.n, linhasAntes);

  // `forcar` é a decisão explícita que destrava o teto.
  const comForcar = await a.reparar({ forcar: true });
  const { dados: dadosF } = (await comForcar.json()) as { dados: { recuperados: number } };
  assert.equal(dadosF.recuperados, 1, 'forcar recupera quem estava no teto');
  assert.equal(a.app.banco.db.prepare("SELECT tentativas FROM miniaturas WHERE video_id='antigo'").get()!.tentativas, 0);
});
