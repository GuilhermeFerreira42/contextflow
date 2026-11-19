/**
 * Teste de integração: sobe o servidor real em porta livre e exercita o HTTP.
 * Sem mock de rede — é o mesmo caminho que o navegador usa.
 */
import assert from 'node:assert/strict';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { criarAplicacao, type Aplicacao } from '../../src/motor/src/aplicacao.ts';

let app: Aplicacao;
let base: string;

interface Envelope {
  ok: boolean;
  dados?: any;
  erro?: { codigo: string; mensagem: string };
}

async function json(resposta: Response): Promise<Envelope> {
  return (await resposta.json()) as Envelope;
}

before(async () => {
  const config = carregarConfig({
    CONTEXTFLOW_PORTA: '0',
    CONTEXTFLOW_AMBIENTE: 'teste',
    CONTEXTFLOW_DADOS: fileURLToPath(new URL('../.tmp/dados-integracao', import.meta.url)),
  });
  app = criarAplicacao(config);
  await new Promise<void>((ok) => app.servidor.listen(0, '127.0.0.1', () => ok()));
  const endereco = app.servidor.address();
  const porta = typeof endereco === 'object' && endereco ? endereco.port : 0;
  base = `http://127.0.0.1:${porta}`;
});

after(async () => {
  await app.encerrar();
});

test('GET /api/saude responde com envelope ok e diz o estado dos módulos', async () => {
  const resposta = await fetch(`${base}/api/saude`);
  assert.equal(resposta.status, 200);
  const corpo = await json(resposta);
  assert.equal(corpo.ok, true);
  assert.equal(corpo.dados.ambiente, 'teste');
  // Honestidade: módulos não implementados são declarados, não escondidos.
  assert.equal(corpo.dados.modulos.ingestao, 'indisponivel');
  assert.equal(corpo.dados.modulos.resumos, 'pendente');
});

test('GET /api/biblioteca devolve página vazia válida', async () => {
  const corpo = await json(await fetch(`${base}/api/biblioteca`));
  assert.equal(corpo.ok, true);
  assert.deepEqual(corpo.dados.itens, []);
  assert.equal(corpo.dados.total, 0);
  assert.equal(corpo.dados.proximoCursor, null);
});

test('GET /api/biblioteca com limite inválido devolve erro de validação 422', async () => {
  const resposta = await fetch(`${base}/api/biblioteca?limite=9999`);
  assert.equal(resposta.status, 422);
  const corpo = await json(resposta);
  assert.equal(corpo.ok, false);
  assert.equal(corpo.erro!.codigo, 'validacao');
});

test('GET /api/biblioteca/:id inexistente devolve 404 com código estável', async () => {
  const resposta = await fetch(`${base}/api/biblioteca/nao-existe`);
  assert.equal(resposta.status, 404);
  const corpo = await json(resposta);
  assert.equal(corpo.erro!.codigo, 'nao_encontrado');
});

test('POST /api/ingestao/validar normaliza URL válida', async () => {
  const resposta = await fetch(`${base}/api/ingestao/validar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://youtu.be/dQw4w9WgXcQ?t=10' }),
  });
  const corpo = await json(resposta);
  assert.equal(corpo.ok, true);
  assert.equal(corpo.dados.valido, true);
  assert.equal(corpo.dados.youtubeId, 'dQw4w9WgXcQ');
});

test('POST /api/ingestao/validar rejeita domínio externo sem quebrar', async () => {
  const resposta = await fetch(`${base}/api/ingestao/validar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ url: 'https://exemplo.com/video' }),
  });
  assert.equal(resposta.status, 422);
  const corpo = await json(resposta);
  assert.equal(corpo.erro!.codigo, 'validacao');
});

test('POST com JSON inválido devolve 400 e não derruba o servidor', async () => {
  const resposta = await fetch(`${base}/api/ingestao/validar`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{quebrado',
  });
  assert.equal(resposta.status, 400);
  const corpo = await json(resposta);
  assert.equal(corpo.erro!.codigo, 'json_invalido');

  // O servidor continua vivo.
  const saude = await fetch(`${base}/api/saude`);
  assert.equal(saude.status, 200);
});

test('rota de API desconhecida devolve 404 estruturado', async () => {
  const resposta = await fetch(`${base}/api/nao-existe`);
  assert.equal(resposta.status, 404);
  const corpo = await json(resposta);
  assert.equal(corpo.erro!.codigo, 'rota_desconhecida');
});

test('GET / serve a interface real', async () => {
  const resposta = await fetch(`${base}/`);
  assert.equal(resposta.status, 200);
  assert.match(resposta.headers.get('content-type') ?? '', /text\/html/);
  const html = await resposta.text();
  assert.match(html, /ContextFlow/);
  assert.match(html, /data-tela-nome="biblioteca"/);
});

test('a interface nunca recebe traversal: conteúdo devolvido é o index', async () => {
  const resposta = await fetch(`${base}/..%2f..%2f..%2f..%2fetc%2fpasswd`);
  const texto = await resposta.text();
  assert.ok(!texto.includes('root:'), 'vazou /etc/passwd');
  assert.match(texto, /<!doctype html>/i);
});

test('resposta de erro não vaza detalhe interno', async () => {
  const resposta = await fetch(`${base}/api/nao-existe`);
  const corpo = await json(resposta);
  assert.ok(!JSON.stringify(corpo).includes('/home/'), 'erro expôs caminho interno');
});
