import assert from 'node:assert/strict';
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';

export async function exercitarBiblioteca({ app, base, avaliar, esperar, S, registrar, raiz }) {
  // Pequena espera para transições de CSS (largura da barra, altura da linha).
  const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
  const inserir=app.banco.db.prepare(`INSERT INTO videos(id,youtube_id,titulo,canal_id,canal_nome,duracao_segundos,url,estado,criado_em,atualizado_em)
    VALUES(?,?,?,?,?,?,?,?,'2026-11-01T00:00:00.000Z','2026-11-01T00:00:00.000Z')`);
  app.banco.executarTransacao(()=>{
    for(let i=0;i<5000;i++){
      const sufixo=String(i).padStart(5,'0'), youtubeId='m'+String(i).padStart(10,'0');
      inserir.run('massa-'+sufixo,youtubeId,'Massa '+sufixo,'volume-'+i%4,'Canal de volume '+i%4,i%400,
        'https://www.youtube.com/watch?v='+youtubeId,i%2?'parcial':'pronto');
      if(i<5)app.banco.db.prepare(`INSERT INTO resumos VALUES(?,'teste','modelo','p1','r1','Resumo de teste','pronto',NULL,'2026','2026')`).run('massa-'+sufixo);
      // Um resumo longo de verdade: o corte por clamp e o "ver resumo completo"
      // não podem ser testados com uma frase curta.
      if(i===4)app.banco.db.prepare(`INSERT INTO resumos VALUES(?,'teste','modelo','p2','r1',?,'pronto',NULL,'2026','2026')`).run('massa-'+sufixo,
        'Este resumo longo existe para exercitar o corte visual do clamp na coluna de resumo. '.repeat(12));
    }
  });
  await S('Page.navigate',{url:base});
  assert.ok(await esperar(`document.querySelector('#biblioteca-viewport')?.dataset.total==='5004'`));
  await avaliar(`document.querySelector('th[data-ordenacao="titulo"] button').click()`);
  assert.ok(await esperar(`document.querySelector('#corpo-biblioteca tr[data-id] .titulo-video')?.textContent==='Massa 00000'`));
  const domInicial=await avaliar(`document.querySelectorAll('#corpo-biblioteca tr').length`);
  registrar('F5: 5.000 vídeos com quantidade limitada de linhas no DOM',domInicial<150,`total=5004 · tr=${domInicial}`);

  // F5-UI: a linha deixou de ter altura fixa de 48 px. O teste pergunta a
  // altura REAL da linha e rola para `altura * índice` — que é exatamente a
  // posição do item dentro do conteúdo virtualizado. Não soma o espaçador: ele
  // é justamente o pedaço já percorrido, não um deslocamento adicional.
  const alturaLinha=await avaliar(`document.querySelector('#corpo-biblioteca tr[data-id]').getBoundingClientRect().height`);
  await avaliar(`document.querySelector('#biblioteca-viewport').scrollTop=${alturaLinha}*3000`);
  const alcançou=await esperar(`document.querySelector('#corpo-biblioteca tr[data-id="massa-03000"] .titulo-video')?.textContent==='Massa 03000'`,20000);
  const geometria=await avaliar(`(()=>{const v=document.querySelector('#biblioteca-viewport').getBoundingClientRect(),r=document.querySelector('tr[data-id="massa-03000"]')?.getBoundingClientRect();return !!r&&r.top<v.bottom&&r.bottom>v.top;})()`);
  registrar('F5: rolagem chega ao vídeo 3.000 sem perder identidade',alcançou&&geometria,`altura=${alturaLinha}px`);

  await avaliar(`window.__linhaMantida=document.querySelector('tr[data-id="massa-03005"]');document.querySelector('#biblioteca-viewport').scrollTop+=48`);
  await avaliar(`new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)))`);
  registrar('F5: reciclagem preserva o mesmo elemento das linhas que permanecem visíveis',await avaliar(`window.__linhaMantida===document.querySelector('tr[data-id="massa-03005"]')`));
  await S('HeapProfiler.collectGarbage');
  const heapAntes=(await S('Runtime.getHeapUsage')).usedSize;

  const metricas=await avaliar(`new Promise(resolve=>{
    const v=document.querySelector('#biblioteca-viewport'),intervalos=[];let anterior=null,n=0,maximo=0;
    function quadro(agora){if(anterior!==null)intervalos.push(agora-anterior);anterior=agora;
      maximo=Math.max(maximo,document.querySelectorAll('#corpo-biblioteca tr').length);v.scrollTop+=48;
      if(++n<120)requestAnimationFrame(quadro);else{intervalos.sort((a,b)=>a-b);resolve({quadros:n,medianaMs:intervalos[59],p95Ms:intervalos[113],maximoTr:maximo});}}
    requestAnimationFrame(quadro);
  })`);
  registrar('F5: rolagem medida em 120 quadros com DOM limitado',metricas.maximoTr<150,JSON.stringify(metricas));
  await S('HeapProfiler.collectGarbage');
  metricas.heapAntesBytes=heapAntes; metricas.heapDepoisBytes=(await S('Runtime.getHeapUsage')).usedSize;
  registrar('F5: memória da janela permanece limitada após reciclar 120 quadros',metricas.heapDepoisBytes-metricas.heapAntesBytes<8*1024*1024,JSON.stringify({antes:heapAntes,depois:metricas.heapDepoisBytes}));
  writeFileSync(join(raiz,'testes','.tmp','metricas-biblioteca.json'),JSON.stringify(metricas,null,2));

  await avaliar(`document.querySelector('#biblioteca-viewport').scrollTop=0`);
  assert.ok(await esperar(`!!document.querySelector('tr[data-id="massa-00000"]')`));
  await avaliar(`document.querySelector('tr[data-id="massa-00000"] input').click()`);
  registrar('F5: seleção individual habilita ações com contador real',await avaliar(`document.querySelector('#contador-selecao').textContent.startsWith('1 selecionados')&&!document.querySelector('#remover-selecao').disabled`));
  await avaliar(`document.querySelector('tr[data-id="massa-00002"] input').dispatchEvent(new MouseEvent('click',{bubbles:true,shiftKey:true}))`);
  registrar('F5: shift seleciona o intervalo de três identidades',await avaliar(`document.querySelector('#contador-selecao').textContent.startsWith('3 selecionados')`));

  await avaliar(`document.querySelector('#filtro-estado').value='parcial';document.querySelector('#filtro-estado').dispatchEvent(new Event('change'));
    document.querySelector('#filtro-canal').value='volume-1';document.querySelector('#filtro-canal').dispatchEvent(new Event('change'));
    document.querySelector('#busca').value='Massa';document.querySelector('#busca').dispatchEvent(new Event('input'));`);
  const filtrou=await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='1250'`);
  registrar('F5: busca, estado e canal combinam filtros e mantêm seleção por ID',filtrou&&await avaliar(`document.querySelector('#contador-selecao').textContent.startsWith('3 selecionados')&&[...document.querySelectorAll('#corpo-biblioteca tr[data-id]')].every(r=>r.textContent.includes('Parcial')&&r.textContent.includes('Canal de volume 1'))`));

  await avaliar(`document.querySelector('#nova-colecao').click();document.querySelector('#nome-colecao').value='Estudos E2E';document.querySelector('#formulario-colecao').requestSubmit()`);
  assert.ok(await esperar(`!document.querySelector('#criar-colecao').open&&document.querySelector('#colecao-destino').value!==''`));
  const colecaoId=await avaliar(`document.querySelector('#colecao-destino').value`);
  await avaliar(`document.querySelector('#colecao-destino').dispatchEvent(new Event('change'))`);
  registrar('F5: criar coleção mostra contagem inicial zero',app.banco.db.prepare('SELECT COUNT(*) n FROM colecao_videos WHERE colecao_id=?').get(colecaoId).n===0);
  await avaliar(`document.querySelector('#adicionar-colecao').click()`);
  assert.ok(await esperar(`document.querySelector('#resultado-biblioteca').textContent.includes('3 IDs processados')`));
  const vinculados=app.banco.db.prepare('SELECT video_id FROM colecao_videos WHERE colecao_id=? ORDER BY video_id').all(colecaoId).map(v=>v.video_id);
  registrar('F5: ação após filtrar atinge somente os três IDs selecionados',JSON.stringify(vinculados)===JSON.stringify(['massa-00000','massa-00001','massa-00002']));

  await avaliar(`document.querySelector('#limpar-filtros').click()`);
  assert.ok(await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='5004'`));
  await avaliar(`document.querySelector('#filtro-colecao').value=${JSON.stringify(colecaoId)};document.querySelector('#filtro-colecao').dispatchEvent(new Event('change'))`);
  assert.ok(await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='3'`));
  await avaliar(`document.querySelector('tr[data-id="massa-00000"] input').click();document.querySelector('#desvincular-colecao').click()`);
  registrar('F5: remover vínculo conserva vídeo na Biblioteca',await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='2'`) && (await fetch(base+'/api/biblioteca/massa-00000')).status===200);

  await avaliar(`document.querySelector('#selecionar-visiveis').click()`);
  const visiveis=await avaliar(`document.querySelector('#contador-selecao').textContent`);
  registrar('F5: selecionar tudo visível usa somente as duas linhas filtradas',visiveis.startsWith('2 selecionados'));
  await avaliar(`document.querySelector('#reimportar-selecao').click()`);
  assert.ok(await esperar(`document.querySelector('#resultado-biblioteca').textContent.includes('2 IDs processados')`));
  let concluiu=false;
  for(let i=0;i<150;i++){
    const jobs=await app.trabalhos.listar();
    const lote=jobs.find(j=>j.tipo==='importar-lote');
    if(lote?.estado==='concluido'){concluiu=true;break;}
    await new Promise(r=>setTimeout(r,50));
  }
  const segmentos=app.banco.db.prepare(`SELECT COUNT(*) n FROM segmentos s JOIN transcricoes t ON s.transcricao_id=t.id
    WHERE t.video_id IN ('massa-00001','massa-00002')`).get().n;
  registrar('F5: reimportar seleção cria conteúdo pela fila e preserva coleções',concluiu&&segmentos===6&&app.banco.db.prepare('SELECT COUNT(*) n FROM colecao_videos WHERE colecao_id=?').get(colecaoId).n===2);
  assert.ok(await esperar(`!!document.querySelector('tr[data-id="massa-00001"]')&&document.querySelector('#limpar-selecao').disabled`));
  await avaliar(`document.querySelector('tr[data-id="massa-00001"] input').click();document.querySelector('#remover-selecao').click()`);
  registrar('F5: remover pede confirmação antes de alterar conteúdo',await avaliar(`document.querySelector('#confirmar-remocao').open`) && (await fetch(base+'/api/biblioteca/massa-00001')).status===200);
  await avaliar(`document.querySelector('#cancelar-remocao').click()`);
  registrar('F5: cancelar confirmação mantém vídeo e segmentos',(await fetch(base+'/api/biblioteca/massa-00001')).status===200);
  await avaliar(`document.querySelector('#remover-selecao').click();document.querySelector('#confirmar-remocao-botao').click()`);
  const removeu=await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='1'`);
  registrar('F5: remoção confirmada apaga vídeo, resumos e segmentos em cascade',removeu&&(await fetch(base+'/api/biblioteca/massa-00001')).status===404&&
    app.banco.db.prepare("SELECT COUNT(*) n FROM transcricoes WHERE video_id='massa-00001'").get().n===0&&app.banco.db.prepare("SELECT COUNT(*) n FROM resumos WHERE video_id='massa-00001'").get().n===0);

  await avaliar(`document.querySelector('#filtro-resumo').checked=true;document.querySelector('#filtro-resumo').dispatchEvent(new Event('change'))`);
  registrar('F5: filtro de resumo usa badge persistido sem perdê-lo na reimportação',await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='1'`) && await avaliar(`document.querySelector('#corpo-biblioteca tr[data-id] td:last-child').textContent==='Pronto'`));
  await avaliar(`document.querySelector('#limpar-filtros').click()`);
  assert.ok(await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='5003'`));
  // limpa o estado de filtro deixado pelo cenário de resumo acima
  await avaliar(`document.querySelector('#filtro-resumo').checked=false;document.querySelector('#filtro-resumo').dispatchEvent(new Event('change'))`);
  await avaliar(`document.querySelector('#filtro-playlist').value='PLteste';document.querySelector('#filtro-playlist').dispatchEvent(new Event('change'))`);
  registrar('F5: classificação por playlist usa os itens importados na F4',await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='2'`));
  await avaliar(`document.querySelector('#limpar-filtros').click()`);
  assert.ok(await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='5003'`));
  await avaliar(`document.querySelector('th[data-ordenacao="titulo"] button').click()`);
  const desc=await esperar(`document.querySelector('th[data-ordenacao="titulo"]').getAttribute('aria-sort')==='descending'`);
  await avaliar(`document.querySelector('#corpo-biblioteca tr[data-id] input').click()`);
  await S('Page.navigate',{url:base});
  const persistiu=await esperar(`document.querySelector('th[data-ordenacao="titulo"]').getAttribute('aria-sort')==='descending'&&document.querySelector('#contador-selecao').textContent.startsWith('0 selecionados')`);
  registrar('F5: ordenação persiste na sessão e seleção é efêmera ao recarregar',desc&&persistiu);
  // ------------------------------------------------ F5-UI: novos recursos --

  // Colunas configuráveis (distintas de filtros e de ordenação)
  await avaliar(`document.querySelector('#abrir-colunas').click()`);
  const painelColunas=await esperar(`!document.querySelector('#painel-colunas').hidden`);
  const canalVisivelAntes=await avaliar(`document.querySelector('#corpo-biblioteca td[data-coluna="canal"]').offsetParent!==null`);
  await avaliar(`[...document.querySelectorAll('#colunas-lista input')].find(i=>i.parentElement.textContent.includes('Canal')).click()`);
  const canalOculto=await esperar(`document.querySelector('#corpo-biblioteca td[data-coluna="canal"]').offsetParent===null`);
  registrar('F5-UI: coluna pode ser ocultada pelo painel de colunas',painelColunas&&canalVisivelAntes&&canalOculto);
  const persistiuColuna=await avaliar(`JSON.parse(localStorage.getItem('contextflow.biblioteca.visual')).colunas.canal===false`);
  registrar('F5-UI: escolha de colunas persiste entre navegações',persistiuColuna);
  await avaliar(`[...document.querySelectorAll('#colunas-lista input')].find(i=>i.parentElement.textContent.includes('Canal')).click()`);
  await esperar(`document.querySelector('#corpo-biblioteca td[data-coluna="canal"]').offsetParent!==null`);
  await avaliar(`document.querySelector('#abrir-colunas').click()`);

  // Modo compacto altera a altura real da linha
  const alturaAmpliada=await avaliar(`document.querySelector('#corpo-biblioteca tr[data-id]').getBoundingClientRect().height`);
  await avaliar(`document.querySelector('[data-modo="compacto"]').click()`);
  await dormir(400);
  const alturaCompacta=await avaliar(`document.querySelector('#corpo-biblioteca tr[data-id]').getBoundingClientRect().height`);
  registrar('F5-UI: modo compacto reduz a altura da linha',alturaAmpliada>alturaCompacta,`${Math.round(alturaAmpliada)}px -> ${Math.round(alturaCompacta)}px`);
  await avaliar(`document.querySelector('[data-modo="ampliado"]').click()`);
  await dormir(300);

  // Botão "Adicionar link" (janela sobreposta) — validação local sem ir ao motor
  await avaliar(`document.querySelector('#abrir-adicionar-link').click()`);
  const dialogoAberto=await esperar(`!document.querySelector('#dialogo-adicionar').hidden`);
  await avaliar(`document.querySelector('#adicionar-url').value='https://exemplo.com/x';document.querySelector('#confirmar-adicionar').click()`);
  const rejeitou=await esperar(`document.querySelector('#adicionar-resultado').dataset.tipo==='erro'`);
  registrar('F5-UI: adicionar link rejeita URL que não é do YouTube',dialogoAberto&&rejeitou);
  await avaliar(`document.querySelector('#fechar-adicionar').click()`);
  await esperar(`document.querySelector('#dialogo-adicionar').hidden`);

  // Árvore lateral usa rotas existentes para filtrar
  const grupos=await avaliar(`document.querySelectorAll('#arvore-grupos .grupo-arvore').length`);
  registrar('F5-UI: árvore lista canais, playlists, datas e coleções',grupos===4,`grupos=${grupos}`);
  await avaliar(`document.querySelector('#arvore-grupos .grupo-cabecalho').click()`);
  await dormir(300);
  const nos=await avaliar(`document.querySelectorAll('#arvore-grupos .no-arvore[data-grupo="canais"]').length`);
  await avaliar(`document.querySelector('#arvore-grupos .no-arvore[data-grupo="canais"]').click()`);
  const filtrouPorCanal=await esperar(`document.querySelector('#filtro-canal').value!=='' && Number(document.querySelector('#biblioteca-viewport').dataset.total)<5003`);
  registrar('F5-UI: selecionar nó da árvore filtra a biblioteca',nos>0&&filtrouPorCanal,`nós=${nos}`);
  await avaliar(`document.querySelector('#limpar-filtros').click()`);
  await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='5003'`);

  // Recolher a barra lateral
  const larguraAntes=await avaliar(`document.querySelector('.barra-lateral').getBoundingClientRect().width`);
  await avaliar(`document.querySelector('#recolher-barra').click()`);
  await dormir(400);
  const larguraDepois=await avaliar(`document.querySelector('.barra-lateral').getBoundingClientRect().width`);
  registrar('F5-UI: barra lateral recolhe liberando espaço',larguraAntes>larguraDepois,`${Math.round(larguraAntes)}px -> ${Math.round(larguraDepois)}px`);
  await avaliar(`document.querySelector('#recolher-barra').click()`);

  // O resumo longo não estica a linha: abre o painel. A altura fixa é o que
  // sustenta a virtualização — se a linha crescer, a lista volta a pular.
  // Garante que estamos na Biblioteca com dados antes de medir: os cenários
  // anteriores mexeram em barra, colunas e filtros.
  await avaliar(`document.querySelector('[data-aba="biblioteca"]').click()`);
  await esperar(`document.querySelector('#biblioteca-viewport').dataset.total!=='0'`);
  // Filtra por "com resumo": só cinco vídeos, e o único com resumo longo é o
  // que tem botão. Sem isso o teste dependeria de qual faixa a janela desenhou.
  await avaliar(`document.querySelector('#filtro-resumo').checked=true;document.querySelector('#filtro-resumo').dispatchEvent(new Event('change'))`);
  await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='5'`);
  await dormir(900);
  const temVerResumo=await avaliar(`!![...document.querySelectorAll('.ver-mais')].find(b=>!b.hidden)`);
  // A medição de altura é feita na LINHA que tem o botão, não na primeira.
  const alturaAntesDeAbrir=await avaliar(`(()=>{const b=[...document.querySelectorAll('.ver-mais')].find(x=>!x.hidden);
    return b?Math.round(b.closest('tr').getBoundingClientRect().height):-1;})()`);
  await avaliar(`[...document.querySelectorAll('.ver-mais')].find(b=>!b.hidden)?.click()`);
  const painelPeloResumo=await esperar(`!document.querySelector('#painel-leitura').hidden && document.querySelector('#painel-resumo')?.textContent?.length>50`,8000);
  const alturaDepoisDeAbrir=await avaliar(`(()=>{const b=[...document.querySelectorAll('.ver-mais')].find(x=>!x.hidden);
    return b?Math.round(b.closest('tr').getBoundingClientRect().height):-1;})()`);
  registrar('F5-UI: "ver resumo completo" abre o painel sem esticar a linha',
    temVerResumo&&painelPeloResumo&&alturaAntesDeAbrir===alturaDepoisDeAbrir,
    `${alturaAntesDeAbrir}px -> ${alturaDepoisDeAbrir}px · botão=${temVerResumo} · painel=${painelPeloResumo} · len=${await avaliar(`document.querySelector('#painel-resumo')?.textContent?.length`)} · aberto=${await avaliar(`!document.querySelector('#painel-leitura').hidden`)}`);
  await avaliar(`document.querySelector('#fechar-painel').click()`);
  await dormir(300);
  await avaliar(`document.querySelector('#limpar-filtros').click()`);
  await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='5003'`);

  const captura=await S('Page.captureScreenshot',{format:'png'});
  writeFileSync(join(raiz,'testes','.tmp','interface-biblioteca-f5.png'),Buffer.from(captura.data,'base64'));
}
