import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, mkdirSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { Banco, MIGRACOES } from '../../src/motor/src/persistencia/banco.ts';
import { RepositorioTranscricoesSqlite } from '../../src/motor/src/persistencia/repositorio-transcricoes.ts';
import { ClienteProvedor, dividirTexto } from '../../src/motor/src/modulos/resumos/provedores.ts';
import { validarConfig } from '../../src/motor/src/modulos/resumos/configuracao.ts';

const tmp = fileURLToPath(new URL('../.tmp/', import.meta.url));
mkdirSync(tmp, { recursive: true });
const esperar = (ms: number) => new Promise(ok => setTimeout(ok, ms));
async function ambiente(t: { after: (fn: () => Promise<void>) => void }) {
  const pasta = mkdtempSync(join(tmp, 'f6-'));
  const pedidos: Array<{ url: string; corpo: any; auth: string | undefined }> = [];
  const modo = { status: 200, falharAte: 0, bloquear: false, fechadas: 0, texto: 'Resumo controlado do servidor de teste.' };
  const mock = createServer(async (req, res) => {
    const partes: Buffer[] = []; for await (const p of req) partes.push(Buffer.from(p));
    const corpo = partes.length ? JSON.parse(Buffer.concat(partes).toString()) : null;
    pedidos.push({ url: req.url!, corpo, auth: String(req.headers.authorization ?? req.headers['x-api-key'] ?? '') });
    res.on('close', () => { if (!res.writableEnded) modo.fechadas++; });
    if (modo.bloquear) return;
    const status = corpo && modo.falharAte > 0 && pedidos.filter(p => p.corpo).length <= modo.falharAte ? 429 : modo.status;
    res.writeHead(status, { 'content-type': 'application/json' });
    if (status !== 200) { res.end(JSON.stringify({ error: { message: 'Não propagar corpo privado do provedor.' } })); return; }
    const texto = `${modo.texto} Chamada ${pedidos.length}.`;
    res.end(JSON.stringify(req.url?.endsWith('/models') ? { data: [{ id: 'fixture' }] }
      : req.url?.endsWith('/api/tags') ? { models: [{ name: 'fixture' }] }
        : req.url?.endsWith('/messages') ? { content: [{ type: 'text', text: texto }], stop_reason: 'end_turn', usage: { input_tokens: 12, output_tokens: 8 } }
          : req.url?.endsWith('/api/chat') ? { message: { content: texto }, done: true, prompt_eval_count: 12, eval_count: 8 }
            : { choices: [{ message: { content: texto }, finish_reason: 'stop' }], usage: { prompt_tokens: 12, completion_tokens: 8 } }));
  });
  await new Promise<void>(ok => mock.listen(0, '127.0.0.1', ok));
  const urlMock = `http://127.0.0.1:${(mock.address() as { port: number }).port}`;
  const criar = () => criarAplicacao(carregarConfig({ CONTEXTFLOW_DADOS: pasta, CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste' }), {
    httpIA: (entrada, opcoes) => fetch(`${urlMock}${new URL(String(entrada)).pathname}`, opcoes),
  });
  let app = criar();
  app.iniciarPersistencia();
  await new Promise<void>(ok => app.servidor.listen(0, '127.0.0.1', ok));
  let base = `http://127.0.0.1:${(app.servidor.address() as { port: number }).port}`;
  const reiniciar = async () => {
    await app.encerrar();
    app = criar(); app.iniciarPersistencia();
    await new Promise<void>(ok => app.servidor.listen(0, '127.0.0.1', ok));
    base = `http://127.0.0.1:${(app.servidor.address() as { port: number }).port}`;
  };
  t.after(async () => { await app.encerrar(); mock.closeAllConnections(); await new Promise<void>(ok => mock.close(() => ok())); });
  const api = async (caminho: string, corpo?: unknown, headers: Record<string, string> = {}) => {
    const res = await fetch(base + caminho, { method: corpo === undefined ? 'GET' : 'POST',
      headers: { 'content-type': 'application/json', ...headers }, body: corpo === undefined ? undefined : JSON.stringify(corpo) });
    return { status: res.status, ...await res.json() as any };
  };
  const config = (extra = {}) => ({ provedor: 'ollama', modelo: 'fixture', baseUrl: urlMock,
    prompt: 'Resuma sem inventar: {transcricao}', versaoPrompt: 'v1', contexto: 2048, maxSaida: 128,
    concorrencia: 1, timeoutSegundos: 1, ...extra });
  const fonte = async (id = 'v1', texto = 'Fonte de teste. Segunda frase da fonte.') => {
    if (!app.banco.db.prepare('SELECT 1 FROM videos WHERE id=?').get(id)) app.banco.db.prepare(`INSERT INTO videos
      (id,youtube_id,titulo,duracao_segundos,url,estado,criado_em,atualizado_em) VALUES(?,?,?,120,?,'pronto','2026','2026')`).run(id, id.padEnd(11, 'x'), `Vídeo ${id}`, `https://youtu.be/${id.padEnd(11, 'x')}`);
    if (texto) await new RepositorioTranscricoesSqlite(app.banco.db).salvar({ videoId: id, idioma: 'pt', origem: 'manual', estado: 'pronta', atualizadoEm: new Date().toISOString(), segmentos: [{ inicioMs: 0, fimMs: 4000, texto }] });
  };
  const gerar = async (ids = ['v1'], chave = randomUUID()) => {
    const estimativa = await api('/api/resumos/estimar', { videoIds: ids });
    assert.equal(estimativa.status, 200);
    const corpo = { videoIds: ids, confirmarCusto: true, chaveRequisicao: chave, assinaturaEstimativa: estimativa.dados.assinaturaEstimativa };
    const resposta = await api('/api/resumos/gerar', corpo);
    return { resposta, corpo, estimativa: estimativa.dados };
  };
  const terminal = async (id: string) => {
    const fim = Date.now() + 15000;
    while (Date.now() < fim) {
      const r = await api(`/api/trabalhos/${id}`);
      if (['concluido', 'falhou', 'cancelado'].includes(r.dados.estado)) return r.dados;
      await esperar(30);
    }
    throw new Error('Trabalho não terminou no prazo do teste.');
  };
  return { app, pasta, base, urlMock, api, config, fonte, gerar, terminal, pedidos, modo, reiniciar };
}

test('F6: configuração persiste, DPAPI/POSIX protege chave e banco/backup/API não a expõem', async t => {
  const a = await ambiente(t);
  const chaveFixture = 'segredo-ficticio-apenas-para-teste';
  const salvo = await a.api('/api/resumos/configuracao', a.config({ provedor: 'compativel', apiKey: chaveFixture }));
  assert.equal(salvo.status, 200); assert.equal(salvo.dados.temChave, true);
  assert.ok(!JSON.stringify(salvo).includes(chaveFixture));
  assert.ok(!readFileSync(join(a.pasta, 'ia/config.json'), 'utf8').includes(chaveFixture));
  const secrets = join(a.pasta, 'ia/secrets.json');
  if (process.platform === 'win32') assert.ok(!readFileSync(secrets, 'utf8').includes(chaveFixture));
  else assert.equal(statSync(secrets).mode & 0o777, 0o600);
  assert.equal((await a.api('/api/resumos/testar', {})).status, 200);
  assert.equal(a.pedidos.at(-1)!.auth, `Bearer ${chaveFixture}`);
  const backup = join(a.pasta, 'backup-sem-segredos.db');
  a.app.banco.db.prepare('VACUUM INTO ?').run(backup);
  assert.ok(!readFileSync(backup).includes(Buffer.from(chaveFixture)));
  const alterado = await a.api('/api/resumos/configuracao', a.config({ provedor: 'compativel', baseUrl: 'http://127.0.0.1:12345' }));
  assert.equal(alterado.dados.temChave, false, 'não reaproveitar chave em outro destino');
});

test('F6: geração real pela fila, histórico, projeção e repetição idempotente sem nova chamada', async t => {
  const a = await ambiente(t); await a.fonte(); await a.api('/api/resumos/configuracao', a.config());
  const g = await a.gerar(); assert.equal(g.resposta.status, 202); assert.equal(g.estimativa.totalCusto, null);
  const id = g.resposta.dados.trabalhos[0].id;
  const final = await a.terminal(id); assert.equal(final.estado, 'concluido'); assert.equal(final.resultado.uso.entrada, 12);
  const h = await a.api('/api/resumos/v1'); assert.equal(h.dados.itens.length, 1); assert.equal(h.dados.itens[0].desatualizado, false);
  assert.equal((await a.api('/api/biblioteca/v1')).dados.temResumo, true);
  assert.match((await a.api('/api/biblioteca/v1/resumo')).dados.texto, /Resumo controlado/);
  const chamadas = a.pedidos.length;
  const repetida = await a.api('/api/resumos/gerar', g.corpo); assert.equal(repetida.status, 202);
  assert.equal(repetida.dados.trabalhos[0].id, id);
  const outra = await a.gerar(); assert.deepEqual(outra.resposta.dados.reutilizados, ['v1']); assert.equal(a.pedidos.length, chamadas);
});

test('F6: lote pula ausência de legenda, deduplica IDs e exige confirmação/estimativa atual', async t => {
  const a = await ambiente(t); await a.fonte(); await a.fonte('v2'); await a.fonte('sem', '');
  await a.api('/api/resumos/configuracao', a.config({ precoEntrada: 1, precoSaida: 2 }));
  assert.equal((await a.api('/api/resumos/gerar', { videoIds: ['v1'] })).status, 422);
  const antigo = await a.api('/api/resumos/estimar', { videoIds: ['v1'] });
  await a.fonte('v1', 'Fonte modificada.');
  assert.equal((await a.api('/api/resumos/gerar', { videoIds: ['v1'], confirmarCusto: true, chaveRequisicao: randomUUID(), assinaturaEstimativa: antigo.dados.assinaturaEstimativa })).status, 409);
  const g = await a.gerar(['v1', 'v1', 'v2', 'sem']);
  assert.equal(g.resposta.status, 202); assert.equal(g.resposta.dados.trabalhos.length, 2); assert.equal(g.resposta.dados.ignorados.length, 1);
  assert.ok(g.estimativa.totalCusto > 0);
  for (const r of g.resposta.dados.trabalhos) assert.equal((await a.terminal(r.id)).estado, 'concluido');
});

test('F6: 429 retenta, 401 não retenta e erro não apaga resumo anterior', async t => {
  const a = await ambiente(t); await a.fonte(); await a.api('/api/resumos/configuracao', a.config());
  a.modo.falharAte = 2;
  const g = await a.gerar(); assert.equal((await a.terminal(g.resposta.dados.trabalhos[0].id)).estado, 'concluido');
  assert.equal(a.pedidos.length, 3);
  await a.api('/api/resumos/configuracao', a.config({ versaoPrompt: 'v2' }));
  a.modo.status = 401;
  const falha = await a.gerar(); const terminal = await a.terminal(falha.resposta.dados.trabalhos[0].id);
  assert.equal(terminal.estado, 'falhou'); assert.equal(terminal.erroCodigo, 'auth_invalido'); assert.equal(a.pedidos.length, 4);
  assert.ok(!terminal.erro.includes('corpo privado'));
  assert.equal((await a.api('/api/biblioteca/v1')).dados.temResumo, true);
  assert.match((await a.api('/api/biblioteca/v1/resumo')).dados.texto, /Resumo controlado/);
  a.modo.status = 200;
  await a.api(`/api/trabalhos/${terminal.id}/repetir`, { chaveRequisicao: randomUUID() });
  assert.equal((await a.terminal(terminal.id)).estado, 'concluido');
  assert.equal((await a.api('/api/resumos/v1')).dados.itens.length, 2);
});

test('F6: cancelamento encerra HTTP, não salva parcial e retry usa snapshot original', async t => {
  const a = await ambiente(t); await a.fonte(); await a.api('/api/resumos/configuracao', a.config({ timeoutSegundos: 30 }));
  a.modo.bloquear = true;
  const g = await a.gerar(), id = g.resposta.dados.trabalhos[0].id;
  for (let i = 0; i < 100 && !a.pedidos.length; i++) await esperar(20);
  assert.equal(a.pedidos.length, 1);
  await a.api(`/api/trabalhos/${id}/cancelar`, {});
  assert.equal((await a.terminal(id)).estado, 'cancelado');
  assert.equal((await a.api('/api/resumos/v1')).dados.itens.some((r: any) => r.estado === 'pronto'), false);
  assert.ok(a.modo.fechadas > 0);
  await a.api('/api/resumos/configuracao', a.config({ modelo: 'outro-modelo', versaoPrompt: 'v2' }));
  a.modo.bloquear = false;
  await a.api(`/api/trabalhos/${id}/repetir`, { chaveRequisicao: randomUUID() });
  assert.equal((await a.terminal(id)).estado, 'concluido');
  assert.equal(a.pedidos.at(-1)!.corpo.model, 'fixture');
});

test('F6: texto longo usa partes/consolidação e preserva revisões após reimportação', async t => {
  const a = await ambiente(t); await a.fonte('v1', 'Texto longo de origem. '.repeat(220));
  await a.api('/api/resumos/configuracao', a.config());
  const g = await a.gerar(); assert.ok(g.estimativa.itens[0].partes > 1);
  const final = await a.terminal(g.resposta.dados.trabalhos[0].id); assert.equal(final.estado, 'concluido');
  assert.ok(a.pedidos.length > 2); assert.equal(final.resultado.uso.chamadas, a.pedidos.length);
  const primeiro = (await a.api('/api/resumos/v1')).dados.itens[0];
  await a.fonte('v1', 'Conteúdo diferente da transcrição.');
  assert.equal((await a.api('/api/resumos/v1')).dados.itens[0].desatualizado, true);
  const novo = await a.gerar(); assert.equal((await a.terminal(novo.resposta.dados.trabalhos[0].id)).estado, 'concluido');
  const h = (await a.api('/api/resumos/v1')).dados.itens;
  assert.equal(h.length, 2); assert.notEqual(h[0].revisaoTranscricao, primeiro.revisaoTranscricao);
  assert.ok(h.some((r: any) => r.texto === primeiro.texto));
});

test('F6: contratos HTTP OpenAI, Anthropic e Ollama com transporte local controlado', async t => {
  const a = await ambiente(t);
  const cliente = new ClienteProvedor((url, op) => fetch(a.urlMock + new URL(String(url)).pathname, op));
  for (const provedor of ['openai', 'anthropic', 'ollama', 'compativel']) {
    const c = validarConfig(a.config({ provedor, baseUrl: provedor === 'openai' ? 'https://api.openai.com/v1' : provedor === 'anthropic' ? 'https://api.anthropic.com/v1' : a.urlMock }));
    const r = await cliente.completar(c, provedor === 'ollama' ? null : 'chave-fixture', 'Resumo da fonte.', AbortSignal.timeout(3000), () => {});
    assert.match(r.texto, /Resumo controlado/); assert.equal(r.uso.entrada, 12); assert.equal(r.uso.saida, 8);
  }
  assert.ok(a.pedidos.some(p => p.url === '/v1/chat/completions' && p.corpo.max_completion_tokens === 128));
  assert.ok(a.pedidos.some(p => p.url === '/v1/messages' && p.corpo.max_tokens === 128));
  assert.ok(a.pedidos.some(p => p.url === '/api/chat' && p.corpo.stream === false));
});

test('F6: endpoint inseguro/origem externa rejeitados e divisão preserva Unicode', async t => {
  const a = await ambiente(t);
  assert.equal((await a.api('/api/resumos/configuracao', a.config({ baseUrl: 'http://example.com' }))).status, 422);
  assert.equal((await a.api('/api/resumos/configuracao', a.config(), { origin: 'https://outro-site.example' })).status, 403);
  const texto = 'ação e memória 😀 '.repeat(100);
  const partes = dividirTexto(texto, 128); assert.equal(partes.join(''), texto);
  assert.ok(partes.every(p => Buffer.byteLength(p) <= 128));
});

test('F6: migração preserva legado/projeção, backup e bloqueia rollback destrutivo', () => {
  const pasta = mkdtempSync(join(tmp, 'migracao-f6-'));
  const b = Banco.abrir({ arquivo: join(pasta, 'base.db') });
  try {
    b.migrar(MIGRACOES.filter(m => m.versao < 5));
    b.db.exec("INSERT INTO videos(id,youtube_id,titulo,url,estado,criado_em,atualizado_em) VALUES('v','12345678901','Legado','https://youtu.be/12345678901','pronto','2026','2026'); INSERT INTO resumos VALUES('v','local','modelo','v1','r1','Legado preservado','pronto',NULL,'2026','2026');");
    b.migrar(); assert.equal(b.versaoAtual(), 6); assert.equal(readdirSync(join(pasta, 'backups')).length, 1);
    assert.equal(b.db.prepare('SELECT texto FROM resumos').get()!.texto, 'Legado preservado');
    b.db.exec("INSERT INTO resumos VALUES('v','local','modelo','v1','r2','Revisão nova','pronto',NULL,'2026','2026')");
    // A reversão é feita migração a migração, cada uma na própria transação:
    // a 6 (cache de miniaturas, só cache) sai antes, e a F6 recusa descer
    // mais. O banco sobrevive num estado consistente, na versão 5.
    assert.throws(() => b.reverterPara(4), /histórico F6/); assert.equal(b.versaoAtual(), 5);
    assert.equal(b.db.prepare('SELECT COUNT(*) n FROM resumos').get()!.n, 2);
    b.db.exec('DELETE FROM resumos'); assert.equal(b.db.prepare('SELECT tem_resumo FROM videos').get()!.tem_resumo, 0);
  } finally { b.fechar(); }
});

test('F6: 5xx esgota três tentativas e timeout interrompe o HTTP sem resumo pronto', async t => {
  const a = await ambiente(t); await a.fonte(); await a.api('/api/resumos/configuracao', a.config());
  a.modo.status = 503;
  const falha = await a.gerar();
  const fim = await a.terminal(falha.resposta.dados.trabalhos[0].id);
  assert.equal(fim.erroCodigo, 'provedor_indisponivel'); assert.equal(a.pedidos.length, 3);
  a.modo.bloquear = true;
  await a.api(`/api/trabalhos/${fim.id}/repetir`, { chaveRequisicao: randomUUID() });
  const timeout = await a.terminal(fim.id);
  assert.equal(timeout.erroCodigo, 'timeout_provedor'); assert.equal(a.pedidos.length, 6);
  assert.ok(a.modo.fechadas >= 3);
  assert.equal((await a.api('/api/biblioteca/v1')).dados.temResumo, false);
});

test('F6: JSON/estrutura/saída inválidos não viram resumo; espera de retry é cancelável', async t => {
  const a = await ambiente(t);
  const c = validarConfig(a.config());
  for (const corpo of ['{inválido', 'null', '{}', JSON.stringify({ message: { content: 'Parcial' }, done_reason: 'length' })]) {
    const cliente = new ClienteProvedor(async () => new Response(corpo));
    await assert.rejects(cliente.completar(c, null, 'Fonte.', AbortSignal.timeout(2000), () => {}),
      (e: any) => ['resposta_invalida', 'saida_incompleta'].includes(e.codigo));
  }
  let chamadas = 0;
  const cancelar = new AbortController();
  const cliente = new ClienteProvedor(async () => { chamadas++; return new Response('{}', { status: 429, headers: { 'retry-after': '30' } }); });
  const inicio = Date.now();
  await assert.rejects(cliente.completar(c, null, 'Fonte.', cancelar.signal,
    fase => { if (fase.includes('Aguardando')) cancelar.abort(); }), (e: any) => e.codigo === 'trabalho_cancelado');
  assert.equal(chamadas, 1); assert.ok(Date.now() - inicio < 1000);
});

test('F6: concorrência configurada serializa chamadas de vídeos diferentes', async t => {
  const a = await ambiente(t); await a.fonte(); await a.fonte('v2');
  await a.api('/api/resumos/configuracao', a.config({ timeoutSegundos: 30, concorrencia: 1 }));
  a.modo.bloquear = true;
  const g = await a.gerar(['v1', 'v2']);
  for (let i = 0; i < 100 && !a.pedidos.length; i++) await esperar(20);
  await esperar(150); assert.equal(a.pedidos.length, 1);
  await a.api(`/api/trabalhos/${g.resposta.dados.trabalhos[0].id}/cancelar`, {});
  await a.terminal(g.resposta.dados.trabalhos[0].id);
  a.modo.bloquear = false;
  // A segunda chamada pode ter começado antes de liberar o servidor; cancelar/repetir
  // exercita a liberação da capacidade em ambos os caminhos.
  const segundo = g.resposta.dados.trabalhos[1].id;
  await a.api(`/api/trabalhos/${segundo}/cancelar`, {});
  const final = await a.terminal(segundo);
  if (final.estado === 'cancelado') await a.api(`/api/trabalhos/${segundo}/repetir`, { chaveRequisicao: randomUUID() });
  assert.equal((await a.terminal(segundo)).estado, 'concluido');
});

test('F6: reabrir motor recupera trabalho interrompido e snapshot persistido', async t => {
  const a = await ambiente(t); await a.fonte();
  await a.api('/api/resumos/configuracao', a.config({ timeoutSegundos: 30 }));
  a.modo.bloquear = true;
  const g = await a.gerar(), id = g.resposta.dados.trabalhos[0].id;
  for (let i = 0; i < 100 && !a.pedidos.length; i++) await esperar(20);
  assert.equal(a.pedidos.length, 1);
  // A alteração de configuração não deve mudar o pedido já aprovado.
  await a.api('/api/resumos/configuracao', a.config({ modelo: 'modelo-posterior' }));
  a.modo.bloquear = false;
  await a.reiniciar();
  assert.equal((await a.terminal(id)).estado, 'concluido');
  assert.equal(a.pedidos.at(-1)!.corpo.model, 'fixture');
  assert.equal((await a.api('/api/resumos/configuracao')).dados.configuracao.modelo, 'modelo-posterior');
  const h = (await a.api('/api/resumos/v1')).dados.itens;
  assert.equal(h.filter((r: any) => r.estado === 'pronto').length, 1);
});

test('F6 LiteLLM: normaliza endereço de escuta, testa/lista e gera sem chave com saída alta', async t => {
  const a = await ambiente(t); await a.fonte();
  const salvo = await a.api('/api/resumos/configuracao', a.config({ provedor: 'compativel', baseUrl: a.urlMock.replace('127.0.0.1', '0.0.0.0'), contexto: 200000, maxSaida: 131072 }));
  assert.equal(salvo.status, 200); assert.equal(salvo.dados.configuracao.baseUrl, a.urlMock);
  assert.equal(salvo.dados.temChave, false);
  const teste = await a.api('/api/resumos/testar', {});
  assert.equal(teste.status, 200); assert.deepEqual(teste.dados.modelos, ['fixture']);
  assert.equal(teste.dados.modeloListado, true); assert.equal(a.pedidos.length, 1);
  const g = await a.gerar(); assert.equal(g.resposta.status, 202);
  assert.equal((await a.terminal(g.resposta.dados.trabalhos[0].id)).estado, 'concluido');
  assert.equal(a.pedidos.at(-1)!.corpo.max_tokens, 131072);
  assert.equal(a.pedidos.at(-1)!.auth, '');
  a.modo.status = 401;
  const recusado = await a.api('/api/resumos/testar', {});
  assert.equal(recusado.status, 401);
  assert.match(JSON.stringify(recusado), /auth_invalido/);
});

test('F6 LiteLLM: reserva de entrada, limite global e chave oficial continuam validados', async t => {
  const a = await ambiente(t);
  assert.equal(validarConfig(a.config({ contexto: 16384, maxSaida: 8192 })).maxSaida, 8192);
  for (const extra of [{ contexto: 16384, maxSaida: 16384 }, { contexto: 1000000, maxSaida: 1000001 }, { contexto: 2048, maxSaida: 1024, prompt: 'x'.repeat(1500) + '{transcricao}' }]) {
    assert.equal((await a.api('/api/resumos/configuracao', a.config(extra))).status, 422);
  }
  const cliente = new ClienteProvedor();
  const c = validarConfig(a.config({ provedor: 'openai', baseUrl: 'https://api.openai.com/v1' }));
  await assert.rejects(cliente.testar(c, null), (e: any) => e.codigo === 'chave_ausente');
});

test('F6: instruções sem marcador persistem após reabertura e chegam ao provedor com a transcrição', async t => {
  const a = await ambiente(t); await a.fonte();
  const instrucoes = 'Explique em tópicos curtos.\nDestaque exemplos e dúvidas sem inventar fatos.';
  const r = await a.api('/api/resumos/configuracao', a.config({ prompt: instrucoes }));
  assert.equal(r.status, 200);
  const salvo = r.dados.configuracao.prompt;
  assert.ok(salvo.startsWith(instrucoes));
  assert.equal(salvo.split('{transcricao}').length - 1, 1);
  await a.reiniciar();
  assert.equal((await a.api('/api/resumos/configuracao')).dados.configuracao.prompt, salvo);
  const g = await a.gerar(); assert.equal((await a.terminal(g.resposta.dados.trabalhos[0].id)).estado, 'concluido');
  assert.ok(a.pedidos.at(-1)!.corpo.messages[0].content.startsWith(instrucoes));
  assert.match(a.pedidos.at(-1)!.corpo.messages[0].content, /Fonte de teste/);
  assert.equal((await a.api('/api/resumos/configuracao', a.config({ prompt: 'x'.repeat(20001) }))).status, 422);
  assert.equal((await a.api('/api/resumos/configuracao')).dados.configuracao.prompt, salvo);
});

test('salvar somente prompt preserva campos mais recentes, segredo e persiste após reinício', async t => {
  const a = await ambiente(t);
  assert.equal((await a.api('/api/resumos/configuracao', a.config({ apiKey: 'fixture-nao-real' }))).status, 200);
  const antiga = (await a.api('/api/resumos/configuracao')).dados.configuracao;
  const segredo = readFileSync(join(a.pasta, 'ia', 'secrets.json'), 'utf8');
  await a.api('/api/resumos/configuracao', a.config({ modelo: 'mais-recente' }));
  const atualizada = await a.api('/api/resumos/configuracao', { ...antiga, prompt: 'Comando isolado.', somentePrompt: true, removerChave: true });
  assert.equal(atualizada.status, 200);
  assert.equal(atualizada.dados.configuracao.modelo, 'mais-recente');
  assert.match(atualizada.dados.configuracao.prompt, /^Comando isolado\./);
  assert.equal(readFileSync(join(a.pasta, 'ia', 'secrets.json'), 'utf8'), segredo);
  const invalida = await a.api('/api/resumos/configuracao', { somentePrompt: true, prompt: '' });
  assert.equal(invalida.status, 422);
  await a.reiniciar();
  assert.equal((await a.api('/api/resumos/configuracao')).dados.configuracao.prompt, atualizada.dados.configuracao.prompt);
});
