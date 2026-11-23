/**
 * Integração: cache local de miniaturas e limpeza do histórico.
 *
 * Sem YouTube: o "CDN" é um servidor HTTP local que conta pedidos. Sem dados
 * pessoais: pasta temporária descartável.
 */
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { mkdtempSync, readdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { after, before, test } from 'node:test';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { criarAplicacao, type Aplicacao } from '../../src/motor/src/aplicacao.ts';
import { MAXIMO_TENTATIVAS } from '../../src/motor/src/modulos/miniaturas/servico.ts';

// 1×1 PNG: conteúdo mínimo válido para o teste de bytes.
const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8DwHwAFAAH/q842iQAAAABJRU5ErkJggg==',
  'base64',
);

let app: Aplicacao;
let base: string;
/** Nomeada fora de `app` para o `after` não fechar o banco reaberto no teste. */
let appFechada: Aplicacao | null = null;
let dados: string;
let cdn: Server;
let cdnUrl: string;
let pedidos = 0;
let statusCdn = 200;

async function json(resposta: Response) {
  return (await resposta.json()) as { ok: boolean; dados?: any; erro?: { codigo: string } };
}

const buscar = (id: string, forcar = false) => fetch(`${base}/api/miniaturas/${id}/buscar`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ forcar }),
});

/** Trabalho terminal (ou ativo) mínimo, direto no banco. */
function criarTrabalho(id: string, estado: string) {
  app.banco.db.prepare(`INSERT INTO trabalhos (id,tipo,estado,escopo,criado_em,atualizado_em)
    VALUES(?,?,?,?, '2026-11-01','2026-11-01')`).run(id, 'importar-video', estado, '{"url":"https://youtu.be/x"}');
}

before(async () => {
  dados = mkdtempSync(join(tmpdir(), 'cf-miniaturas-'));

  // Dublê do CDN: conta requisições e permite simular recusa.
  cdn = createServer((_req, res) => {
    pedidos++;
    if (statusCdn !== 200) {
      res.writeHead(statusCdn);
      res.end('negado');
      return;
    }
    res.writeHead(200, { 'content-type': 'image/png', 'content-length': PNG.length });
    res.end(PNG);
  });
  await new Promise<void>(ok => cdn.listen(0, '127.0.0.1', () => ok()));
  const endereco = cdn.address();
  const portaCdn = typeof endereco === 'object' && endereco ? endereco.port : 0;
  cdnUrl = `http://127.0.0.1:${portaCdn}/capa.png`;

  app = criarAplicacao(carregarConfig({
    CONTEXTFLOW_PORTA: '0',
    CONTEXTFLOW_AMBIENTE: 'teste',
    CONTEXTFLOW_DADOS: dados,
  }));
  app.iniciarPersistencia();

  const inserir = app.banco.db.prepare(`INSERT INTO videos
    (id,youtube_id,titulo,url,miniatura_url,estado,criado_em,atualizado_em)
    VALUES(?,?,?,?,?,'pronto','2026','2026')`);
  inserir.run('v-capa', '11111111111', 'Com capa', 'https://youtu.be/11111111111', cdnUrl);
  inserir.run('v-sem-capa', '22222222222', 'Sem capa', 'https://youtu.be/22222222222', null);
  inserir.run('v-recusa', '33333333333', 'CDN recusa', 'https://youtu.be/33333333333', cdnUrl);
  inserir.run('v-manual', '44444444444', 'Removido depois', 'https://youtu.be/44444444444', cdnUrl);

  await new Promise<void>(ok => app.servidor.listen(0, '127.0.0.1', () => ok()));
  const enderecoApp = app.servidor.address();
  base = `http://127.0.0.1:${typeof enderecoApp === 'object' && enderecoApp ? enderecoApp.port : 0}`;
});

after(async () => {
  await appFechada?.encerrar().catch(() => {});
  await app.encerrar();
  await new Promise<void>(ok => cdn.close(() => ok()));
  rmSync(dados, { recursive: true, force: true });
});

// ---------------------------------------------------------------- miniaturas

test('listagem mantém a URL remota enquanto não existe cópia local', async () => {
  const pagina = await json(await fetch(`${base}/api/biblioteca?limite=10`));
  const itens: { id: string; miniaturaUrl: string | null }[] = pagina.dados.itens;
  assert.equal(itens.find(v => v.id === 'v-capa')!.miniaturaUrl, cdnUrl);
  assert.equal(itens.find(v => v.id === 'v-sem-capa')!.miniaturaUrl, null);
});

test('buscar baixa uma vez e passa a servir pela própria origem', async () => {
  const antes = pedidos;
  const resposta = await buscar('v-capa');
  assert.equal(resposta.status, 200);
  const corpo = await json(resposta);
  assert.equal(corpo.dados.ok, true);
  assert.equal(corpo.dados.miniaturaUrl, '/api/miniaturas/v-capa');
  assert.equal(pedidos, antes + 1);

  const imagem = await fetch(`${base}/api/miniaturas/v-capa`);
  assert.equal(imagem.status, 200);
  assert.equal(imagem.headers.get('content-type'), 'image/png');
  assert.match(imagem.headers.get('cache-control') ?? '', /no-cache/);
  assert.ok(imagem.headers.get('etag'), 'capa deve permitir revalidar sem congelar recuperação');
  assert.equal(Buffer.from(await imagem.arrayBuffer()).length, PNG.length);

  const pagina = await json(await fetch(`${base}/api/biblioteca?limite=10`));
  const item = pagina.dados.itens.find((v: { id: string }) => v.id === 'v-capa');
  assert.equal(item.miniaturaUrl, '/api/miniaturas/v-capa');

  // Segunda busca usa o cache: nenhum pedido novo ao CDN.
  const aposPrimeira = pedidos;
  await buscar('v-capa');
  assert.equal(pedidos, aposPrimeira);
});

test('sem capa conhecida: 404 declarado e nada é baixado', async () => {
  const antes = pedidos;
  const resposta = await buscar('v-sem-capa');
  assert.equal(resposta.status, 404);
  const corpo = await json(resposta);
  assert.equal(corpo.dados.ok, false);
  assert.equal(pedidos, antes);
});

test('CDN que recusa não gera laço e desiste depois do limite', async () => {
  statusCdn = 403;
  try {
    for (let i = 0; i < MAXIMO_TENTATIVAS; i++) {
      const resposta = await buscar('v-recusa');
      assert.equal(resposta.status, 404);
    }
    // Depois do limite a listagem não oferece mais a URL: a interface mostra
    // o substituto em vez de uma imagem quebrada.
    const pagina = await json(await fetch(`${base}/api/biblioteca?limite=10`));
    assert.equal(pagina.dados.itens.find((v: { id: string }) => v.id === 'v-recusa').miniaturaUrl, null);

    // Insistir sem `forcar` não bate no CDN.
    const antes = pedidos;
    await buscar('v-recusa');
    assert.equal(pedidos, antes);
  } finally {
    statusCdn = 200;
  }

  // `forcar` (reimportação) volta a tentar e funciona quando o CDN volta.
  const forcado = await buscar('v-recusa', true);
  assert.equal(forcado.status, 200);
});

test('rota de miniatura inexistente responde 404, não 500', async () => {
  const resposta = await fetch(`${base}/api/miniaturas/nao-existe`);
  assert.equal(resposta.status, 404);
});

// ------------------------------------------------- histórico de importações

/*
 * Remoção individual (F6-B, item 3 do pedido).
 *
 * A regra que estes testes protegem é a distinção entre três coisas que a
 * interface mostra juntas:
 *   - remover do histórico = apagar o REGISTRO da tarefa;
 *   - cancelar            = interromper a tarefa;
 *   - remover da biblioteca = apagar vídeo + transcrição + resumo.
 * Trocar uma pela outra apaga dados do usuário — por isso cada uma tem teste.
 */

test('DELETE /api/trabalhos/:id remove só o registro e preserva a biblioteca', async () => {
  criarTrabalho('tr-individual', 'concluido');
  const antes = await json(await fetch(`${base}/api/biblioteca?limite=10`));
  const resposta = await fetch(`${base}/api/trabalhos/tr-individual`, { method: 'DELETE' });
  assert.equal(resposta.status, 200);
  const corpo = await json(resposta);
  assert.equal(corpo.dados.removido, true);

  const detalhe = await fetch(`${base}/api/trabalhos/tr-individual`);
  assert.equal(detalhe.status, 404, 'o trabalho sai do histórico de verdade');

  const depois = await json(await fetch(`${base}/api/biblioteca?limite=10`));
  assert.equal(depois.dados.total, antes.dados.total, 'nenhum vídeo é apagado junto');
});

test('DELETE /api/trabalhos/:id recusa trabalho ativo com 409', async () => {
  criarTrabalho('tr-individual-ativo', 'executando');
  const resposta = await fetch(`${base}/api/trabalhos/tr-individual-ativo`, { method: 'DELETE' });
  assert.equal(resposta.status, 409);
  const corpo = await json(resposta);
  assert.equal(corpo.erro?.codigo, 'trabalho_ativo');
  // Continua existindo: recusar não pode ser um "apagou pela metade".
  assert.equal((await fetch(`${base}/api/trabalhos/tr-individual-ativo`)).status, 200);

  // Higiene: os testes seguintes contam ativos. Este trabalho é um ativo de
  // mentira (não tem executor), então sai por SQL em vez de cancelamento.
  app.banco.db.prepare("DELETE FROM trabalhos WHERE id='tr-individual-ativo'").run();
});

test('DELETE /api/trabalhos/:id inexistente responde 404 (não 500)', async () => {
  const resposta = await fetch(`${base}/api/trabalhos/nunca-existiu`, { method: 'DELETE' });
  assert.equal(resposta.status, 404);
});

test('DELETE /api/trabalhos/historico não é capturado pela rota :id', async () => {
  // Regressão de ordem de rotas: `:id` antes da literal fazia a limpeza por
  // categoria responder 404 — o caminho "historico" virava um id.
  // O corpo pede um estado sem nenhuma linha: só a ROTA é o que se testa aqui
  // (limpar 'concluido' aqui apagaria dados que os testes acima usam).
  const resposta = await fetch(`${base}/api/trabalhos/historico`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ estados: ['cancelado'] }),
  });
  assert.equal(resposta.status, 200);
  assert.equal(resposta.status === 200 && (await resposta.json()).dados.removidos, 0);
});

test('histórico recusa estado não terminal em vez de apagar em silêncio', async () => {
  criarTrabalho('tr-ativo', 'executando');
  const resposta = await fetch(`${base}/api/trabalhos/historico`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ estados: ['executando'] }),
  });
  assert.equal(resposta.status, 422);
  const resumo = await json(await fetch(`${base}/api/trabalhos/historico/resumo`));
  assert.equal(resumo.dados.ativo, 1);
});

test('limpar histórico remove só os terminais pedidos e preserva a biblioteca', async () => {
  criarTrabalho('tr-concluido', 'concluido');
  criarTrabalho('tr-falhou', 'falhou');
  criarTrabalho('tr-cancelado', 'cancelado');
  const antes = await json(await fetch(`${base}/api/biblioteca?limite=10`));

  const resposta = await fetch(`${base}/api/trabalhos/historico`, {
    method: 'DELETE',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ estados: ['falhou'] }),
  });
  assert.equal(resposta.status, 200);
  const corpo = await json(resposta);
  assert.equal(corpo.dados.removidos, 1);
  assert.equal(corpo.dados.preservados, 1); // o ativo continua

  const resumo = await json(await fetch(`${base}/api/trabalhos/historico/resumo`));
  assert.equal(resumo.dados.falhou, 0);
  assert.equal(resumo.dados.concluido, 1);
  assert.equal(resumo.dados.cancelado, 1);
  assert.equal(resumo.dados.ativo, 1);

  // Nenhum vídeo, transcrição ou resumo saiu junto: limpar histórico é só
  // sobre a entrada de fila.
  const depois = await json(await fetch(`${base}/api/biblioteca?limite=10`));
  assert.equal(depois.dados.total, antes.dados.total);
});

test('limpeza persiste após reabrir a persistência (equivalente a reiniciar)', async () => {
  // Estado esperado antes de "reiniciar": o falho já saiu, o ativo ficou.
  const antes = await json(await fetch(`${base}/api/trabalhos/historico/resumo`));
  assert.equal(antes.dados.falhou, 0);
  const versao = app.banco.versaoAtual();

  // Abrir uma SEGUNDA aplicação sobre o mesmo arquivo é o que um reinício do
  // motor faz: nada fica em memória que não esteja no banco ou em disco.
  // (`app` continua aberta e é fechada no `after` — fechá-la aqui faria o
  // `after` mexer num banco já fechado.)
  appFechada = criarAplicacao(carregarConfig({
    CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste', CONTEXTFLOW_DADOS: dados,
  }));
  appFechada.iniciarPersistencia();
  await new Promise<void>(ok => appFechada!.servidor.listen(0, '127.0.0.1', () => ok()));
  const endereco = appFechada.servidor.address();
  const baseNova = `http://127.0.0.1:${typeof endereco === 'object' && endereco ? endereco.port : 0}`;
  try {
    assert.equal(appFechada.banco.versaoAtual(), versao);
    const resumo = await json(await fetch(`${baseNova}/api/trabalhos/historico/resumo`));
    assert.equal(resumo.dados.falhou, 0);
    assert.equal(resumo.dados.ativo, antes.dados.ativo);
    assert.equal(resumo.dados.total, antes.dados.total);
    // A miniatura em cache continua servível depois de reiniciar.
    const imagem = await fetch(`${baseNova}/api/miniaturas/v-capa`);
    assert.equal(imagem.status, 200);
  } finally {
    await appFechada.encerrar();
    appFechada = null;
  }
});

test('o cache fica em <dados>/miniaturas, com o índice no banco e sem bytes', async () => {
  const arquivos = readdirSync(join(dados, 'miniaturas'));
  assert.ok(arquivos.length >= 1);
  assert.ok(arquivos.every(nome => /^[a-f0-9]+\.(jpg|png|webp|gif)$/.test(nome)),
    `nomes devem ser hashes com extensão segura: ${arquivos.join(', ')}`);
  const colunas = app.banco.db.prepare('PRAGMA table_info(miniaturas)').all() as { name: string }[];
  assert.ok(!colunas.some(c => /blob|bytea|conteudo/i.test(c.name)),
    'o banco guarda só metadados; a imagem fica em disco');
});
