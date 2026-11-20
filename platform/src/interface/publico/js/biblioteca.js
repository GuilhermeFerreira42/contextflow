/** Estado de apresentação da Biblioteca; conteúdo e ações continuam no motor. */
export function criarBiblioteca({ api, aoEnfileirar }) {
  const $ = seletor => document.querySelector(seletor);
  const viewport = $('#biblioteca-viewport');
  const corpo = $('#corpo-biblioteca');
  const tabela = viewport.querySelector('table');
  const altura = 48;
  const margem = 12;
  const pagina = 500;
  const selecionados = new Set();
  let itens = [], total = 0, cursor = null, geracao = 0, carregando = false;
  let controle = null, quadro = null, ultimaSelecao = null, ocupado = false, confirmarIds = [];
  let ordenacao = 'criado_em', direcao = 'desc';
  let selecaoEmAcao = new Set();
  let parametrosAtuais = null, falhaPagina = false, posicaoSalva = 0;
  const chaves = new Map();
  let linhasAtuais = new Map();
  const espacoSuperior = espaco(0), espacoInferior = espaco(0);
  try {
    const salvo = JSON.parse(sessionStorage.getItem('contextflow.biblioteca.ordem') ?? 'null');
    if (['criado_em','titulo','canal','duracao','estado'].includes(salvo?.campo) && ['asc','desc'].includes(salvo?.direcao)) {
      ordenacao = salvo.campo; direcao = salvo.direcao;
    }
  } catch { /* Preferência inválida usa padrão seguro. */ }

  function consulta() {
    const p = new URLSearchParams({limite:String(pagina),ordenacao,ordenacaoDirecao:direcao});
    for (const [parametro,id] of [['busca','busca'],['estado','filtro-estado'],['canalId','filtro-canal'],['colecaoId','filtro-colecao'],['playlistId','filtro-playlist']]) {
      const valor = $('#'+id).value.trim(); if (valor) p.set(parametro,valor);
    }
    if ($('#filtro-resumo').checked) p.set('temResumo','1');
    return p;
  }
  function intervalo() {
    const cabecalho = tabela.tHead?.offsetHeight ?? 34;
    const posicao = viewport.offsetParent === null ? posicaoSalva : viewport.scrollTop;
    const inicio = Math.max(0,Math.floor((posicao-cabecalho)/altura)-margem);
    const fim = Math.min(total,Math.ceil((posicao+(viewport.clientHeight || 500)-cabecalho)/altura)+margem);
    return {inicio:Math.min(inicio,total),fim:Math.max(inicio,fim)};
  }
  function linhasVisiveis() {
    const area = viewport.getBoundingClientRect();
    const topo = area.top + (tabela.tHead?.offsetHeight ?? 34);
    return [...corpo.querySelectorAll('tr[data-id]')].filter(linha => {
      const r = linha.getBoundingClientRect(); return r.bottom > topo && r.top < area.bottom;
    });
  }
  function atualizarSelecao(visiveisCalculados) {
    const n = selecionados.size;
    $('#contador-selecao').textContent = `${n} selecionados · ${total} resultados`;
    $('#aviso-selecao').hidden = !n;
    for (const id of ['limpar-selecao','reimportar-selecao','remover-selecao']) $('#'+id).disabled = !n || ocupado;
    $('#adicionar-colecao').disabled = !n || ocupado || !$('#colecao-destino').value;
    $('#desvincular-colecao').disabled = !n || ocupado || !$('#filtro-colecao').value;
    $('#selecionar-visiveis').disabled = ocupado || !itens.length;
    const visiveis = visiveisCalculados ?? linhasVisiveis();
    const marcados = visiveis.filter(l=>selecionados.has(l.dataset.id)).length;
    $('#selecao-visivel').checked = !!visiveis.length && marcados === visiveis.length;
    $('#selecao-visivel').indeterminate = marcados > 0 && marcados < visiveis.length;
    for (const linha of corpo.querySelectorAll('tr[data-id]')) {
      const marcado = selecionados.has(linha.dataset.id);
      linha.classList.toggle('selecionada',marcado);
      linha.querySelector('input').checked = marcado;
    }
  }
  function selecionar(video, indice, evento) {
    if (ocupado) { evento.preventDefault(); return; }
    const marcar = evento.currentTarget.checked;
    const anterior = itens.findIndex(v=>v.id===ultimaSelecao);
    const alvos = evento.shiftKey && anterior >= 0 ? itens.slice(Math.min(anterior,indice),Math.max(anterior,indice)+1) : [video];
    for (const alvo of alvos) { if (marcar) selecionados.add(alvo.id); else selecionados.delete(alvo.id); }
    ultimaSelecao = video.id; atualizarSelecao();
  }
  function textoTd(texto, classe) {
    const td = document.createElement('td'); td.textContent = texto;
    if (classe) td.className = classe; return td;
  }
  function duracao(segundos) {
    if (!Number.isFinite(segundos)) return '—';
    const h=Math.floor(segundos/3600), m=Math.floor(segundos%3600/60), s=Math.floor(segundos%60);
    return h ? `${h}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}` : `${m}:${String(s).padStart(2,'0')}`;
  }
  function linha(video, indice) {
    const tr=document.createElement('tr'); tr.dataset.id=video.id; tr.setAttribute('aria-rowindex',String(indice+2));
    const td=document.createElement('td'), caixa=document.createElement('input'); caixa.type='checkbox';
    caixa.setAttribute('aria-label',`Selecionar ${video.titulo}`); caixa.checked=selecionados.has(video.id);
    caixa.addEventListener('click',evento=>selecionar(video,indice,evento)); td.append(caixa);
    const titulo=document.createElement('td'), celula=document.createElement('div'); celula.className='celula-video';
    if (video.miniaturaUrl) {
      const img=document.createElement('img'); img.className='miniatura'; img.src=video.miniaturaUrl;
      img.alt=''; img.loading='lazy'; img.width=64; img.height=36; celula.append(img);
    }
    const nome=document.createElement('span'); nome.className='titulo-video'; nome.textContent=video.titulo; nome.title=video.titulo;
    celula.append(nome); titulo.append(celula);
    const data = new Date(video.criadoEm);
    const estado=document.createElement('td'), etiqueta=document.createElement('span'); etiqueta.className='etiqueta';
    etiqueta.dataset.estado=video.estado; etiqueta.textContent={novo:'Novo',importando:'Importando',pronto:'Pronto',parcial:'Parcial',erro:'Erro'}[video.estado]??video.estado;
    estado.append(etiqueta);
    tr.append(td,titulo,textoTd(video.canalNome??'—'),textoTd(duracao(video.duracaoSegundos)),
      textoTd(Number.isNaN(data.getTime())?'—':data.toLocaleDateString('pt-BR')),estado,textoTd(video.temResumo?'Pronto':'—'));
    if (selecionados.has(video.id)) tr.classList.add('selecionada');
    return tr;
  }
  function espaco(px) {
    const tr=document.createElement('tr'); tr.dataset.espacador=''; tr.setAttribute('aria-hidden','true');
    const td=document.createElement('td'); td.colSpan=7; td.style.height=`${px}px`; tr.append(td); return tr;
  }
  function renderizar() {
    quadro=null; const {inicio,fim}=intervalo(); const exibidos=itens.slice(inicio,fim);
    // Reutilizar linhas que continuam na janela evita reconstruir imagens/células a cada quadro.
    const cabecalho = tabela.tHead?.offsetHeight ?? 34;
    const primeiroVisivel = Math.floor(viewport.scrollTop/altura);
    const ultimoVisivel = Math.ceil((viewport.scrollTop+viewport.clientHeight-cabecalho)/altura);
    const proximas = new Map(), nodes = [], visiveis = [];
    if (inicio>0) { espacoSuperior.firstElementChild.style.height=`${inicio*altura}px`; nodes.push(espacoSuperior); }
    exibidos.forEach((v,i)=>{
      const indice=inicio+i, anterior=linhasAtuais.get(v.id);
      const elemento=anterior?.video===v && anterior.indice===indice ? anterior.elemento : linha(v,indice);
      proximas.set(v.id,{video:v,indice,elemento}); nodes.push(elemento);
      if(indice>=primeiroVisivel&&indice<ultimoVisivel)visiveis.push(elemento);
    });
    const restante=total-inicio-exibidos.length;
    if(restante>0) { espacoInferior.firstElementChild.style.height=`${restante*altura}px`; nodes.push(espacoInferior); }
    const manter=new Set(nodes);
    for(const filho of [...corpo.children])if(!manter.has(filho))filho.remove();
    nodes.forEach((node,i)=>{if(corpo.children[i]!==node)corpo.insertBefore(node,corpo.children[i]??null);});
    linhasAtuais=proximas;
    tabela.setAttribute('aria-rowcount',String(total+1));
    viewport.dataset.total=String(total); viewport.dataset.carregados=String(itens.length); viewport.dataset.renderizadas=String(exibidos.length);
    atualizarSelecao(visiveis);
    if (fim>itens.length && cursor && !carregando && !falhaPagina) void carregarMais(fim);
  }
  function agendar() { if (quadro===null) quadro=requestAnimationFrame(renderizar); }
  async function carregarMais(alvo) {
    if (carregando || !cursor || falhaPagina) return;
    carregando=true; const atual=geracao;
    try {
      while (cursor && itens.length<alvo && atual===geracao) {
        const p=new URLSearchParams(parametrosAtuais); p.set('cursor',cursor);
        const resposta=await api(`/api/biblioteca?${p}`,{signal:controle.signal});
        if (atual!==geracao) return;
        itens.push(...resposta.itens); cursor=resposta.proximoCursor; total=resposta.total;
      }
      $('#carregamento-biblioteca').textContent=cursor ? `${itens.length} de ${total} vídeos carregados` : `${total} vídeos carregados`;
    } catch (erro) { if (erro.name!=='AbortError' && atual===geracao) { falhaPagina=true; $('#resultado-biblioteca').textContent=erro.message; } }
    finally { if(atual===geracao){carregando=false; agendar();} }
  }
  async function carregar({reset=false}={}) {
    const posicao=reset?0:(viewport.offsetParent === null ? posicaoSalva : viewport.scrollTop);
    const alvo=reset?pagina:Math.max(pagina,intervalo().fim);
    const atual=++geracao; controle?.abort(); controle=new AbortController(); carregando=true; falhaPagina=false; parametrosAtuais=consulta();
    if (reset) { viewport.scrollTop=0; posicaoSalva=0; ultimaSelecao=null; }
    viewport.setAttribute('aria-busy','true'); $('#carregamento-biblioteca').textContent='Carregando vídeos…';
    try {
      const resposta=await api(`/api/biblioteca?${parametrosAtuais}`,{signal:controle.signal});
      if (atual!==geracao) return;
      itens=resposta.itens; total=resposta.total; cursor=resposta.proximoCursor;
      const semItens=total===0;
      $('#vazio-biblioteca').hidden=!semItens; tabela.hidden=semItens;
      $('#vazio-biblioteca .vazio-titulo').textContent='Nenhum vídeo encontrado';
      $('#vazio-biblioteca .vazio-texto').textContent='Importe um vídeo ou ajuste os filtros da biblioteca.';
      $('#contador').textContent=`${total} ${total===1?'vídeo':'vídeos'}`;
      for (const th of tabela.querySelectorAll('th[data-ordenacao]')) {
        const ativo=th.dataset.ordenacao===ordenacao;
        th.setAttribute('aria-sort',ativo?(direcao==='asc'?'ascending':'descending'):'none');
        th.querySelector('.seta-ordenacao').textContent=ativo?(direcao==='asc'?'↑':'↓'):'';
      }
      renderizar(); viewport.scrollTop=posicao; posicaoSalva=posicao; carregando=false;
      if (cursor && alvo>itens.length) await carregarMais(alvo);
      agendar();
      $('#carregamento-biblioteca').textContent=`${itens.length} de ${total} vídeos carregados`;
    } catch (erro) {
      if (erro.name==='AbortError' || atual!==geracao) return;
      $('#resultado-biblioteca').textContent=erro.message; $('#carregamento-biblioteca').textContent='Falha ao carregar. Ajuste os filtros para tentar novamente.';
    } finally { if(atual===geracao){carregando=false;viewport.setAttribute('aria-busy','false');} }
  }
  function preencher(id, lista, rotulo) {
    const select=$('#'+id), valor=select.value;
    const inicial=document.createElement('option'); inicial.value=''; inicial.textContent=rotulo;
    select.replaceChildren(inicial,...lista.map(item=>{
      const option=document.createElement('option'); option.value=item.id;
      option.textContent=`${item.nome??item.titulo} (${item.contagem})`; return option;
    }));
    if([...select.options].some(o=>o.value===valor)) select.value=valor;
  }
  async function carregarOpcoes() {
    try {
      const [canais,playlists,colecoes]=await Promise.all([api('/api/biblioteca/canais'),api('/api/biblioteca/playlists'),api('/api/colecoes')]);
      preencher('filtro-canal',canais.itens,'Todos'); preencher('filtro-playlist',playlists.itens,'Todas');
      preencher('filtro-colecao',colecoes.itens,'Todas'); preencher('colecao-destino',colecoes.itens,'Escolha uma coleção');
      atualizarSelecao();
    } catch(erro) { $('#resultado-biblioteca').textContent=erro.message; }
  }
  function chave(acao, ids, colecaoId) {
    const corpo=JSON.stringify({acao,ids:[...ids].sort(),colecaoId});
    if(!chaves.has(corpo))chaves.set(corpo,crypto.randomUUID());
    return {corpo,valor:chaves.get(corpo)};
  }
  async function executar(acao, ids=[...selecionados], colecaoId) {
    if(ocupado || !ids.length)return;
    ocupado=true; selecaoEmAcao=new Set(ids); atualizarSelecao();
    const requisicao=chave(acao,ids,colecaoId);
    try {
      let resultado;
      if(acao==='desvincular') {
        resultado={processados:0,falhas:[]};
        for(const id of ids) {
          try { await api(`/api/colecoes/${encodeURIComponent(colecaoId)}/videos/${encodeURIComponent(id)}`,{method:'DELETE'});resultado.processados++; }
          catch(erro){resultado.falhas.push({id,mensagem:erro.message});}
        }
      } else resultado=await api('/api/biblioteca/lote',{method:'POST',body:JSON.stringify({acao,ids,colecaoId,chaveRequisicao:requisicao.valor})});
      const falhos=new Set(resultado.falhas.map(f=>f.id));
      for(const id of selecaoEmAcao)if(!falhos.has(id))selecionados.delete(id);
      $('#resultado-biblioteca').textContent=`${resultado.processados} IDs processados`+(resultado.trabalhoId?' — importação adicionada à fila.':'.')+
        (resultado.falhas.length?' '+resultado.falhas.map(f=>f.mensagem).join(' '):'');
      if(resultado.trabalhoId)aoEnfileirar?.(resultado.trabalhoId);
      chaves.delete(requisicao.corpo); await Promise.all([carregar(),carregarOpcoes()]);
    } catch(erro) { $('#resultado-biblioteca').textContent=erro.message; }
    finally {ocupado=false;selecaoEmAcao.clear();atualizarSelecao();}
  }
  function selecionarVisiveis() {
    const linhas=linhasVisiveis(), todos=linhas.every(l=>selecionados.has(l.dataset.id));
    for(const l of linhas){if(todos)selecionados.delete(l.dataset.id);else selecionados.add(l.dataset.id);}
    atualizarSelecao();
  }
  function ligar() {
    viewport.addEventListener('scroll',()=>{ if(viewport.offsetParent!==null)posicaoSalva=viewport.scrollTop; agendar(); },{passive:true});
    new ResizeObserver(agendar).observe(viewport);
    if('IntersectionObserver' in window)new IntersectionObserver(entradas=>{
      if(entradas.some(e=>e.isIntersecting))void carregarMais(itens.length+pagina);
    },{root:viewport,rootMargin:'500px'}).observe($('#sentinela-biblioteca'));
    let debounce;
    $('#busca').addEventListener('input',()=>{clearTimeout(debounce);debounce=setTimeout(()=>void carregar({reset:true}),180);});
    for(const id of ['filtro-estado','filtro-canal','filtro-playlist','filtro-colecao','filtro-resumo'])$('#'+id).addEventListener('change',()=>void carregar({reset:true}));
    $('#limpar-filtros').addEventListener('click',()=>{
      $('#busca').value=''; for(const id of ['filtro-estado','filtro-canal','filtro-playlist','filtro-colecao'])$('#'+id).value='';
      $('#filtro-resumo').checked=false; void carregar({reset:true});
    });
    for(const th of tabela.querySelectorAll('th[data-ordenacao]'))th.querySelector('button').addEventListener('click',()=>{
      const campo=th.dataset.ordenacao; direcao=campo===ordenacao&&direcao==='asc'?'desc':'asc'; ordenacao=campo;
      try{sessionStorage.setItem('contextflow.biblioteca.ordem',JSON.stringify({campo:ordenacao,direcao}));}catch{}
      void carregar({reset:true});
    });
    $('#selecionar-visiveis').addEventListener('click',selecionarVisiveis); $('#selecao-visivel').addEventListener('click',selecionarVisiveis);
    $('#limpar-selecao').addEventListener('click',()=>{selecionados.clear();atualizarSelecao();});
    $('#colecao-destino').addEventListener('change',()=>atualizarSelecao());
    $('#reimportar-selecao').addEventListener('click',()=>void executar('reimportar'));
    $('#adicionar-colecao').addEventListener('click',()=>void executar('colecao',[...selecionados],$('#colecao-destino').value));
    $('#desvincular-colecao').addEventListener('click',()=>void executar('desvincular',[...selecionados],$('#filtro-colecao').value));
    $('#remover-selecao').addEventListener('click',()=>{
      confirmarIds=[...selecionados]; $('#descricao-remocao').textContent=`Remover ${confirmarIds.length} vídeos selecionados, inclusive os que estão fora do filtro?`;
      $('#confirmar-remocao').showModal();
    });
    $('#cancelar-remocao').addEventListener('click',()=>$('#confirmar-remocao').close());
    $('#confirmar-remocao-botao').addEventListener('click',()=>{const ids=confirmarIds.slice();$('#confirmar-remocao').close();void executar('remover',ids);});
    $('#nova-colecao').addEventListener('click',()=>{$('#erro-colecao').textContent='';$('#criar-colecao').showModal();$('#nome-colecao').focus();});
    $('#cancelar-colecao').addEventListener('click',()=>$('#criar-colecao').close());
    $('#formulario-colecao').addEventListener('submit',async evento=>{
      evento.preventDefault(); const botao=evento.target.querySelector('[type=submit]'); botao.disabled=true;
      try {
        const colecao=await api('/api/colecoes',{method:'POST',body:JSON.stringify({titulo:$('#nome-colecao').value})});
        await carregarOpcoes(); $('#colecao-destino').value=colecao.id; $('#nome-colecao').value=''; $('#criar-colecao').close();atualizarSelecao();
      }catch(erro){$('#erro-colecao').textContent=erro.message;}finally{botao.disabled=false;}
    });
  }
  return {ligar,carregar,carregarOpcoes};
}
