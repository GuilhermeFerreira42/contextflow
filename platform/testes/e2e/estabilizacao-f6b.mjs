/** Estabilização F6-B: app real e dados descartáveis, sem IA/YouTube reais. */
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { chromium } from 'playwright';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
mkdirSync(resolve('testes/.tmp'), {recursive:true});
const pasta = mkdtempSync(resolve('testes/.tmp/estabilizacao-'));
const evidencia = resolve(process.env.CONTEXTFLOW_EVIDENCIAS ?? pasta); mkdirSync(evidencia, {recursive:true});
let liberar; let bloqueado = true;
const bloqueios = new Map();
const espera = new Promise(ok => liberar = ok);
const executor = {
  async disponivel() { return {disponivel:true, versao:'fixture', caminho:'fixture'}; },
  async inspecionar(url) {
    if (bloqueado) await espera;
    const id = new URL(url).searchParams.get('v');
    if (bloqueios.has(id)) await bloqueios.get(id);
    return {id, titulo:'Título longo para verificar o acompanhamento sem rolagem horizontal. '.repeat(7), canalId:'fixture',canalNome:'Canal',duracaoSegundos:12,miniaturaUrl:null,publicadoEm:null,legendasManuais:id === 'semlegenda1' ? [] : ['es'],legendasAutomaticas:[]};
  },
  async baixarLegenda(url) {
    if (new URL(url).searchParams.get('v') === 'semlegenda1') return null;
    return {idioma:'es',origem:'manual',segmentos:[{inicioMs:0,fimMs:2000,texto:'Fuente controlada.'}]};
  },
};
let liberarResumo;
let esperaResumo;
const pedidosIA = [];
const app = criarAplicacao(carregarConfig({...process.env,CONTEXTFLOW_DADOS:pasta,CONTEXTFLOW_PORTA:'0',CONTEXTFLOW_AMBIENTE:'teste'}),{
  executorYtdlp:executor,
  async httpIA(_url, opcoes) {
    pedidosIA.push(JSON.parse(opcoes.body));
    await esperaResumo;
    return Response.json({choices:[{message:{content:'Resumo automático controlado.'},finish_reason:'stop'}]});
  },
});
let browser, page, total=0; const erros=[];
try {
 app.iniciarPersistencia(); await new Promise(ok=>app.servidor.listen(0,'127.0.0.1',ok));
 const base=`http://127.0.0.1:${app.servidor.address().port}`;
 const api=async (path, body)=>{const r=await fetch(base+path,{method:body===undefined?'GET':'POST',headers:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});const j=await r.json();assert.ok(r.ok,JSON.stringify(j));return j.dados;};
 await api('/api/resumos/configuracao',{provedor:'compativel',modelo:'fixture',baseUrl:'http://127.0.0.1:4000',prompt:'Original {transcricao}',versaoPrompt:'v1',contexto:20000,maxSaida:1000,concorrencia:1,timeoutSegundos:90});
 const colecao=await api('/api/colecoes',{titulo:'Coleção preservada'});
 const exe=[process.env.CHROME_BIN,chromium.executablePath(),'C:/Program Files/Google/Chrome/Application/chrome.exe'].find(p=>p&&existsSync(p));
 browser=await chromium.launch({executablePath:exe}); page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});page.on('pageerror',e=>erros.push(e.message));page.setDefaultTimeout(15000);
 const teste=async(nome,fn)=>{await fn();total++;console.log(`PASS ${nome}`);};
 await page.goto(base+'/#configuracoes');await page.waitForFunction(()=>!document.querySelector('#ia-prompt').disabled);
 await teste('comando salva automaticamente sem salvar outros campos e persiste no reload',async()=>{
   await page.locator('#ia-modelo').fill('edicao-nao-salva');await page.locator('#ia-prompt').fill('Meu comando personalizado, sem marcador.');
   await page.waitForFunction(()=>document.querySelector('#ia-resultado').textContent.includes('salvo automaticamente'));
   const c=(await api('/api/resumos/configuracao')).configuracao;assert.equal(c.modelo,'fixture');assert.match(c.prompt,/^Meu comando/);assert.ok(c.prompt.includes('{transcricao}'));
   assert.equal(await page.locator('#ia-modelo').inputValue(),'edicao-nao-salva');
   await page.reload();await page.waitForFunction(()=>!document.querySelector('#ia-prompt').disabled);assert.equal(await page.locator('#ia-prompt').inputValue(),c.prompt);
 });
 await teste('resposta atrasada não sobrescreve edição recente; salvar manual aguarda autosave',async()=>{
   let soltar, requisitou;const pronto=new Promise(ok=>requisitou=ok), atraso=new Promise(ok=>soltar=ok);let primeiro=true;
   await page.route('**/api/resumos/configuracao',async r=>{
     if(r.request().method()!=='POST'||!primeiro)return r.continue();
     primeiro=false;const resposta=await r.fetch();requisitou();await atraso;await r.fulfill({response:resposta});
   });
   try {
     await page.locator('#ia-prompt').fill('Comando antigo em trânsito');await pronto;
     await page.locator('#ia-prompt').fill('Comando mais recente');await page.locator('#ia-salvar').click();
     soltar();await page.waitForFunction(()=>document.querySelector('#ia-resultado').textContent==='Configuração de IA salva.');
     assert.match((await api('/api/resumos/configuracao')).configuracao.prompt,/^Comando mais recente/);
     assert.match(await page.locator('#ia-prompt').inputValue(),/^Comando mais recente/);
   } finally {soltar();await page.unroute('**/api/resumos/configuracao');}
 });
 await teste('falha no autosave mantém edição e informa comando não salvo',async()=>{
   await page.route('**/api/resumos/configuracao',r=>r.request().method()==='POST'?r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({ok:false,erro:{mensagem:'Falha controlada.'}})}):r.continue());
   await page.locator('#ia-prompt').fill('Edição preservada na falha');await page.waitForFunction(()=>document.querySelector('#ia-resultado').textContent.includes('Comando não salvo'));
   assert.equal(await page.locator('#ia-prompt').inputValue(),'Edição preservada na falha');await page.unroute('**/api/resumos/configuracao');
 });
 await page.locator('[data-aba="biblioteca"]').click();
 let id;
 await teste('modal fecha no aceite 202 enquanto importação ainda está bloqueada; coleção preservada',async()=>{
   await page.locator('#abrir-adicionar-link').click();await page.locator('#adicionar-url').fill('https://www.youtube.com/watch?v=abcdefghijk');
   await page.locator('#adicionar-colecao-destino').selectOption(colecao.id);
   await page.locator('#confirmar-adicionar').click();await page.locator('#dialogo-adicionar').waitFor({state:'hidden'});
   const jobs=(await api('/api/trabalhos')).itens;id=jobs[0].id;assert.ok(!['concluido','falhou'].includes(jobs[0].estado));
   await page.locator('#cartao-acompanhamento').waitFor();assert.equal(new URL(page.url()).hash,'#biblioteca');
   await page.reload();
   await page.locator(`.acompanhamento-item[data-id="${id}"]`).waitFor();
 });
 await teste('ocultar remove todo cartão e polling não reabre; não cancela trabalho',async()=>{
   await page.locator('#acompanhamento-recolher').click();await page.locator('#cartao-acompanhamento').waitFor({state:'hidden'});
   await page.reload();
   await page.locator('#atividade-biblioteca').waitFor();
   assert.ok(await page.locator('#cartao-acompanhamento').isHidden());
   assert.ok(!['cancelado','falhou','concluido'].includes((await api('/api/trabalhos/'+id)).estado));
   bloqueado=false;liberar();
   await page.waitForFunction(async id=>(await (await fetch('/api/trabalhos/'+id)).json()).dados.estado==='concluido',id);
   await page.waitForFunction(async id=>(await (await fetch('/api/biblioteca?colecaoId='+id)).json()).dados.itens?.length===1,colecao.id);
 });
 await teste('limpar finalizados só limpa apresentação, sem apagar histórico; card sem overflow',async()=>{
   await page.locator('#abrir-adicionar-link').click();await page.locator('#adicionar-url').fill('https://www.youtube.com/watch?v=lmnopqrstuv');await page.locator('#confirmar-adicionar').click();
   await page.locator('#dialogo-adicionar').waitFor({state:'hidden'});await page.waitForFunction(()=>!document.querySelector('#acompanhamento-limpar').disabled);
   for(const width of [1440,768,390]) {await page.setViewportSize({width,height:900});await page.waitForTimeout(100);assert.ok(await page.locator('#acompanhamento-lista').evaluate(e=>e.scrollWidth<=e.clientWidth+1));await page.screenshot({path:join(evidencia,`acompanhamento-${width}.png`)});}
   const antes=(await api('/api/trabalhos')).itens.length;await page.locator('#acompanhamento-limpar').click();assert.ok(await page.locator('#cartao-acompanhamento').isHidden());assert.equal((await api('/api/trabalhos')).itens.length,antes);
 });
 await teste('barra responsiva não sobrepõe seleção, coleções e visualização',async()=>{
   for (const selecionados of [false,true]) {
     await page.setViewportSize({width:1440,height:1000});
     if(selecionados) await page.locator('#selecionar-visiveis').click();
     for(const width of [1440,768,390,320]) {
       await page.setViewportSize({width,height:1000});
       await page.waitForTimeout(350);
       const sobreposicoes=await page.evaluate(()=>{
         const alvo=document.querySelector('[data-tela-nome="biblioteca"] > .barra-ferramentas');
         const caixas=[...alvo.querySelectorAll('button,select')].filter(e=>e.getClientRects().length).map(e=>({id:e.id||e.textContent.trim(),r:e.getBoundingClientRect()}));
         return caixas.flatMap((a,i)=>caixas.slice(i+1).filter(b=>Math.min(a.r.right,b.r.right)-Math.max(a.r.left,b.r.left)>1&&Math.min(a.r.bottom,b.r.bottom)-Math.max(a.r.top,b.r.top)>1).map(b=>[a.id,b.id]));
       });
       assert.deepEqual(sobreposicoes,[],`${width}px, seleção=${selecionados}`);
       await page.screenshot({path:join(evidencia,`barra-${width}-${selecionados}.png`)});
     }
   }
   await page.locator('#limpar-selecao').click();
 });
 await teste('limpar preserva ativos; fechar não cancela nem apaga histórico',async()=>{
   await page.setViewportSize({width:1440,height:1000});
   const adicionar=async id=>{await page.locator('#abrir-adicionar-link').click();await page.locator('#adicionar-url').fill('https://www.youtube.com/watch?v='+id);await page.locator('#confirmar-adicionar').click();await page.locator('#dialogo-adicionar').waitFor({state:'hidden'});};
   await adicionar('terminado01');await page.waitForFunction(()=>!document.querySelector('#acompanhamento-limpar').disabled);
   let soltar;bloqueios.set('aguardando1',new Promise(ok=>soltar=ok));
   try {
     await adicionar('aguardando1');await page.waitForFunction(()=>document.querySelectorAll('.acompanhamento-item').length===2);
     await page.locator('#acompanhamento-limpar').click();assert.equal(await page.locator('.acompanhamento-item').count(),1);
     assert.ok(await page.locator('#acompanhamento-limpar').isDisabled());
     const ativo=(await api('/api/trabalhos')).itens.find(t=>!['concluido','falhou','cancelado'].includes(t.estado));assert.ok(ativo);
     await page.locator('#acompanhamento-fechar').click();assert.ok(await page.locator('#cartao-acompanhamento').isHidden());
     assert.notEqual((await api('/api/trabalhos/'+ativo.id)).estado,'cancelado');
   } finally {soltar();bloqueios.delete('aguardando1');}
 });
 await teste('resposta antiga não fecha nem limpa um formulário reaberto',async()=>{
   let soltar, requisitou;const pronto=new Promise(ok=>requisitou=ok), atraso=new Promise(ok=>soltar=ok);
   await page.route('**/api/trabalhos',async r=>{if(r.request().method()!=='POST')return r.continue();requisitou();await atraso;await r.continue();});
   try {
     await page.locator('#abrir-adicionar-link').click();await page.locator('#adicionar-url').fill('https://www.youtube.com/watch?v=antigo00001');await page.locator('#confirmar-adicionar').click();await pronto;
     await page.locator('#cancelar-adicionar').click();await page.locator('#abrir-adicionar-link').click();await page.locator('#adicionar-url').fill('https://www.youtube.com/watch?v=novo0000001');
     soltar();await page.waitForTimeout(1500);
     assert.ok(await page.locator('#dialogo-adicionar').isVisible());assert.equal(await page.locator('#adicionar-url').inputValue(),'https://www.youtube.com/watch?v=novo0000001');assert.ok(await page.locator('#confirmar-adicionar').isEnabled());
     await page.locator('#cancelar-adicionar').click();
   } finally {soltar();await page.unroute('**/api/trabalhos');}
 });
 await teste('importar e resumir com consentimento, mantendo o mesmo trabalho após F5', async () => {
   await page.locator('#acompanhamento-fechar').click();
   esperaResumo = new Promise(ok => liberarResumo = ok);
   await page.locator('#abrir-adicionar-link').click();
   await page.locator('#adicionar-url').fill('https://youtu.be/resumoauto1');
   assert.equal(await page.locator('#adicionar-resumir').isChecked(), false);
   await page.locator('#adicionar-resumir').check();
   await page.locator('#confirmar-adicionar').click();
   await page.locator('#dialogo-adicionar').waitFor({state:'hidden'});
   const resumo = page.locator('.acompanhamento-item[data-estado="executando"]').filter({hasText:'Resumo:'});
   await resumo.waitFor();
   const resumoId = await resumo.getAttribute('data-id');
   await page.reload();
   await page.locator('#atividade-biblioteca').waitFor();
   await page.locator(`.acompanhamento-item[data-id="${resumoId}"][data-estado="executando"]`).waitFor();
   assert.equal(pedidosIA.length, 1);
   assert.match(pedidosIA[0].messages[0].content, /Comando mais recente/);
   liberarResumo();
   await page.locator(`.acompanhamento-item[data-id="${resumoId}"][data-estado="concluido"]`).waitFor();
   const trabalho = await api('/api/trabalhos/'+resumoId);
   const salvo = await api('/api/biblioteca/'+trabalho.videoId+'/resumo');
   assert.equal(salvo.texto,'Resumo automático controlado.');
   assert.equal(pedidosIA.length, 1);
 });
 await teste('importação sem legenda ou com resumo pronto dispensa nova chamada de IA', async () => {
   for (const [youtubeId, mensagem] of [['semlegenda1', /sem transcrição/], ['resumoauto1', /já está pronto/]]) {
     await page.locator('#abrir-adicionar-link').click();
     await page.locator('#adicionar-url').fill('https://youtu.be/'+youtubeId);
     await page.locator('#adicionar-resumir').check();
     const aceito = page.waitForResponse(r => r.url().endsWith('/api/trabalhos') && r.request().method() === 'POST');
     await page.locator('#confirmar-adicionar').click();
     const {dados} = await (await aceito).json();
     const item = page.locator(`.acompanhamento-item[data-id="${dados.id}"][data-estado="concluido"]`);
     await item.waitFor();
     assert.match(await item.textContent(), mensagem);
   }
   assert.equal(pedidosIA.length, 1);
 });
 await teste('Biblioteca importa texto misto, preserva texto inválido e lembra expansão após F5', async () => {
   await page.locator('#abrir-adicionar-link').click();
   const painel = page.locator('#painel-lote-biblioteca');
   await painel.locator('summary').click();
   const campo = painel.locator('textarea');
   await campo.fill('Só texto e https://example.org');
   await painel.getByRole('button', {name:'Adicionar à fila'}).click();
   await painel.getByText('Nenhum link de vídeo do YouTube').waitFor();
   assert.equal(await campo.inputValue(), 'Só texto e https://example.org');
   await campo.fill('https://youtu.be/lote0000001 | Primeiro\nhttps://example.org\n[Segundo](https://youtu.be/lote0000002)\nhttps://youtu.be/lote0000001?t=10');
   await painel.getByRole('button', {name:'Adicionar à fila'}).click();
   await page.locator('#dialogo-adicionar').waitFor({state:'hidden'});
   const mensagem = await page.locator('#resultado-biblioteca').textContent();
   assert.match(mensagem, /2 vídeos adicionados.*1 linha.*1 link repetido/);
   await page.reload();
   await page.locator('#abrir-adicionar-link').click();
   await campo.waitFor();
   await painel.locator('summary').click();
   await campo.waitFor({state:'hidden'});
   await page.waitForFunction(() => localStorage.getItem('contextflow.importar-lote.biblioteca') === 'fechado');
   await page.reload();
   await page.locator('#abrir-adicionar-link').click();
   assert.ok(await campo.isHidden());
   await page.locator('#cancelar-adicionar').click();
 });
 await teste('Importações usa a mesma limpeza de texto e lembra expansão', async () => {
   await page.locator('[data-aba="importacoes"]').click();
   const painel = page.locator('#painel-lote-importacoes');
   await painel.locator('summary').click();
   await painel.locator('textarea').fill('Título antes do link https://youtu.be/lote0000003.\nhttps://www.youtube.com/@outro');
   const aceite = page.waitForResponse(r => r.url().endsWith('/api/ingestao/lote') && r.request().method() === 'POST');
   await painel.getByRole('button', {name:'Adicionar à fila'}).click();
   const resposta = await aceite;
   assert.equal(resposta.status(), 202);
   const {dados} = await resposta.json();
   assert.deepEqual(dados.lote, {videos:1, linhasIgnoradas:1, duplicatas:0});
   assert.equal((await api('/api/trabalhos/'+dados.id)).contadores.total, 1);
   await page.reload();
   await painel.locator('textarea').waitFor();
 });
 await teste('Itens de lote com 130 vídeos ocupam toda a tabela e preservam paginação', async () => {
   const ids = Array.from({length:130}, (_, i) => `big${String(i).padStart(8, '0')}`);
   let soltar;
   const esperaItens = new Promise(ok => soltar = ok);
   for (const id of ids) bloqueios.set(id, esperaItens);
   try {
     const lote = await api('/api/ingestao/lote', {
       urls:ids.map(id => 'https://youtu.be/'+id), chaveRequisicao:'layout-lote-grande',
     });
     const pai = page.locator(`tr.trabalho[data-id="${lote.id}"]`);
     const botao = pai.locator('[data-acao="itens"]');
     const detalhe = pai.locator('xpath=following-sibling::tr[1][contains(@class, "linha-detalhe")]');
     await botao.click();
     assert.equal(await botao.getAttribute('aria-expanded'), 'true');
     await detalhe.locator('.item-filho').nth(49).waitFor();
     const dimensoes = await detalhe.evaluate(tr => ({
       detalhe:tr.getBoundingClientRect().width,
       tabela:tr.closest('table').getBoundingClientRect().width,
       pai:tr.previousElementSibling.getBoundingClientRect().height,
     }));
     assert.ok(dimensoes.detalhe >= dimensoes.tabela - 2);
     assert.ok(dimensoes.pai < 80);
     await detalhe.getByRole('button',{name:'Mais itens'}).click();
     await detalhe.locator('.item-filho').nth(99).waitFor();
     await page.waitForResponse(r => r.url().includes('/api/trabalhos?raizes=1&limite=50'));
     await detalhe.getByRole('button',{name:'Mais itens'}).click();
     await detalhe.locator('.item-filho').nth(129).waitFor();
     assert.equal(await detalhe.locator('.item-filho').count(), 130);
     assert.ok(await detalhe.getByRole('button',{name:'Mais itens'}).isHidden());
     const lista = detalhe.locator('.lista-filhos');
     const rolagem = await lista.evaluate(e => { e.scrollTop = 600; return e.scrollTop; });
     assert.ok(rolagem > 0);
     for (let i = 0; i < 2; i++) await page.waitForResponse(r => r.url().includes(`/api/trabalhos/${lote.id}/itens?limite=50&cursor=`));
     assert.equal(await lista.evaluate(e => e.scrollTop), rolagem);
     await page.setViewportSize({width:390,height:850});
     await page.locator('.caixa-tabela-trabalhos').evaluate(caixa => { caixa.scrollLeft = caixa.scrollWidth; });
     await page.waitForFunction(id => {
       const painel = document.querySelector(`#itens-trabalho-${id}`);
       const caixa = painel?.closest('.caixa-tabela-trabalhos');
       if (!caixa) return false;
       const r = painel.getBoundingClientRect();
       const c = caixa.getBoundingClientRect();
       return r.left >= c.left - 2 && r.right <= c.left + caixa.clientWidth + 2;
     }, lote.id);
     const estreita = await detalhe.locator('.painel-itens-trabalho').evaluate(painel => {
       const caixa = painel.closest('.caixa-tabela-trabalhos');
       const visivel = caixa.getBoundingClientRect();
       const retangulo = painel.getBoundingClientRect();
       return { inicio:retangulo.left, fim:retangulo.right, esquerda:visivel.left,
         direita:visivel.left + caixa.clientWidth, scroll:caixa.scrollLeft };
     });
     assert.ok(estreita.inicio >= estreita.esquerda - 2 && estreita.fim <= estreita.direita + 2, JSON.stringify(estreita));
     await detalhe.getByRole('button',{name:'Recolher itens'}).click();
     assert.equal(await botao.getAttribute('aria-expanded'), 'false');
     await detalhe.waitFor({state:'detached'});
   } finally {
     soltar();
     for (const id of ids) bloqueios.delete(id);
   }
 });
 await teste('resultado parcial mostra concluídos e a rolagem do histórico sobrevive ao polling', async () => {
   await page.setViewportSize({width:1450,height:760});
   const repo = app.trabalhos.repositorio;
   let misto;
   let antigo;
   app.banco.executarTransacao(() => {
     const marcar = app.banco.db.prepare('UPDATE trabalhos SET estado=?, fase=?, progresso=1, criado_em=?, atualizado_em=? WHERE id=?');
     misto = repo.inserir('importar-lote', {urls:[]});
     marcar.run('falhou','finalizado','2099-01-01','2099-01-01',misto);
     for (let i=0;i<130;i++) {
       const youtubeId = `mix${String(i).padStart(8,'0')}`;
       const filho = repo.inserir('importar-video', {titulo:`Vídeo misto ${i}`,posicao:i}, youtubeId, misto);
       const data = new Date(Date.UTC(2005,0,1,0,i)).toISOString();
       marcar.run(i < 37 ? 'concluido' : 'falhou','finalizado',data,data,filho);
     }
     for (let i=0;i<66;i++) {
       const raiz = repo.inserir('importar-video', {titulo:`Histórico ${i}`});
       const data = new Date(Date.UTC(2000,0,1,0,i)).toISOString();
       marcar.run('concluido','finalizado',data,data,raiz);
       if (!i) antigo = raiz;
     }
   });
   await page.reload();
   const pai = page.locator(`tr.trabalho[data-id="${misto}"]`);
   await pai.locator('[data-acao="itens"]').click();
   assert.equal(await pai.locator('.selo').textContent(), 'Parcial');
   const painel = page.locator(`#itens-trabalho-${misto}`);
   await painel.locator('.item-filho').nth(49).waitFor();
   assert.equal(await painel.locator('.item-filho .selo[data-estado="erro"]').count(), 50);
   assert.equal(await painel.locator('.contagem-itens-trabalho .selo[data-estado="pronto"]').textContent(), '37 concluídos');
   await painel.getByRole('combobox',{name:'Filtrar itens por estado'}).selectOption('concluido');
   await painel.locator('.item-filho .selo[data-estado="pronto"]').nth(36).waitFor();
   assert.equal(await painel.locator('.item-filho').count(), 37);
   await painel.getByRole('button',{name:'Recolher itens'}).click();
   await page.locator('#mais-trabalhos').click();
   const raizAntiga = page.locator(`tr[data-id="${antigo}"]`);
   await raizAntiga.waitFor();
   const posicao = await page.evaluate(() => {
     const tabela = document.querySelector('#lista-trabalhos');
     const tela = document.querySelector('.conteudo');
     tabela.scrollTop = 880;
     tela.scrollTop = tela.scrollHeight;
     return [tabela.scrollTop,tela.scrollTop];
   });
   assert.ok(posicao.every(valor => valor > 0));
   for (let i=0;i<2;i++) {
     await page.waitForResponse(r => r.url().includes('/api/trabalhos?raizes=1&limite=50&cursor='));
   }
   assert.equal(await raizAntiga.count(), 1);
   assert.deepEqual(await page.evaluate(() => [
     document.querySelector('#lista-trabalhos').scrollTop, document.querySelector('.conteudo').scrollTop,
   ]), posicao);
 });
 assert.deepEqual(erros,[]);console.log(`${total}/${total} cenários de estabilização Playwright aprovados.`);
} finally {bloqueado=false;liberar?.();liberarResumo?.();await browser?.close();await app.encerrar();}
