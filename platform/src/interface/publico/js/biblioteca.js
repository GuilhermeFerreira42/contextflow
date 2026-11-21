/**
 * Biblioteca: tabela virtualizada com linhas ampliadas.
 *
 * Princípio: a leitura acontece na linha. O painel sobreposto é complementar
 * e só abre por ação explícita (a SPEC proíbe abrir ao selecionar).
 *
 * Virtualização: altura FIXA por modo (ampliado / compacto). A conta continua
 * sendo aritmética simples — o que muda é o número. Texto longo usa limite de
 * linhas e expansão, nunca altura livre, para não quebrar a janela de linhas.
 */
export function criarBiblioteca({ api, aoEnfileirar, aoAbrirPainel }) {
  const $ = seletor => document.querySelector(seletor);

  const viewport = $('#biblioteca-viewport');
  const corpo = $('#corpo-biblioteca');
  const tabela = viewport.querySelector('table');

  /**
   * Altura da linha vem do CSS (--altura-linha-*), não de uma cópia em JS.
   * Uma constante duplicada já divergiu do CSS nesta fase e o virtualizador
   * passou a calcular a janela errada, fazendo a lista parecer pular. Ler a
   * variável elimina a segunda fonte de verdade.
   */
  const ALTURAS_PADRAO = { ampliado: 136, compacto: 64 };
  function alturaDoCss() {
    const valor = getComputedStyle(document.querySelector('.aplicativo'))
      .getPropertyValue('--altura-linha').trim();
    const numero = Number.parseFloat(valor);
    return Number.isFinite(numero) && numero > 0 ? numero : null;
  }
  const MARGEM_ACIMA = 2; // linhas extras acima da janela
  const MARGEM_ABAIXO = 18; // linhas extras abaixo (suaviza a paginação)
  const PAGINA = 500;

  const colunasPadrao = { canal: true, duracao: true, adicionado: true, estado: true, resumo: true, 'resumo-estado': true };
  const ordemColunas = Object.keys(colunasPadrao);

  const selecionados = new Set();
  let itens = [];
  let total = 0;
  let cursor = null;
  let geracao = 0;
  let carregando = false;
  let controle = null;
  let quadro = null;
  let posicaoPendente = null;
  let ultimaSelecao = null;
  let ocupado = false;
  let confirmarIds = [];
  let ordenacao = 'criado_em';
  let direcao = 'desc';
  let selecaoEmAcao = new Set();
  let parametrosAtuais = null;
  let falhaPagina = false;
  let posicaoSalva = 0;
  let modo = 'ampliado';
  let colunas = { ...colunasPadrao };
  let expandidos = new Set();
  let previas = new Map(); // resumo curto por vídeo, buscado em lote
  let intervaloData = null; // recorte da árvore "Data de importação"
  const chaves = new Map();
  let linhasAtuais = new Map();
  const TOTAL_COLUNAS = 8; // checkbox + vídeo + 6 colunas configuráveis
  const espacoSuperior = espaco(0);
  const espacoInferior = espaco(0);

  // ------------------------------------------------------------ preferências

  function lerPreferencias() {
    try {
      const salvo = JSON.parse(sessionStorage.getItem('contextflow.biblioteca.ordem') ?? 'null');
      if (['criado_em', 'titulo', 'canal', 'duracao', 'estado'].includes(salvo?.campo) && ['asc', 'desc'].includes(salvo?.direcao)) {
        ordenacao = salvo.campo;
        direcao = salvo.direcao;
      }
    } catch { /* Preferência inválida usa o padrão. */ }

    try {
      const visual = JSON.parse(localStorage.getItem('contextflow.biblioteca.visual') ?? 'null');
      if (visual?.modo === 'ampliado' || visual?.modo === 'compacto') modo = visual.modo;
      if (visual?.colunas && typeof visual.colunas === 'object') {
        for (const nome of ordemColunas) {
          if (typeof visual.colunas[nome] === 'boolean') colunas[nome] = visual.colunas[nome];
        }
      }
    } catch { /* idem */ }

    try {
      const recolhida = localStorage.getItem('contextflow.biblioteca.barra') === 'recolhida';
      if (recolhida) document.querySelector('.aplicativo').dataset.barra = 'recolhida';
    } catch { /* idem */ }
  }

  function salvarVisual() {
    try {
      localStorage.setItem('contextflow.biblioteca.visual', JSON.stringify({ modo, colunas }));
    } catch { /* armazenamento indisponível não impede o uso */ }
  }

  function alturaLinha() {
    return alturaDoCss() ?? ALTURAS_PADRAO[modo] ?? ALTURAS_PADRAO.ampliado;
  }

  // -------------------------------------------------------------- consultas

  function consulta() {
    const p = new URLSearchParams({ limite: String(PAGINA), ordenacao, ordenacaoDirecao: direcao });
    for (const [parametro, id] of [
      ['busca', 'busca'],
      ['estado', 'filtro-estado'],
      ['canalId', 'filtro-canal'],
      ['colecaoId', 'filtro-colecao'],
      ['playlistId', 'filtro-playlist'],
    ]) {
      const valor = $('#' + id).value.trim();
      if (valor) p.set(parametro, valor);
    }
    if ($('#filtro-resumo').checked) p.set('temResumo', '1');
    if (intervaloData) {
      p.set('importadoDe', intervaloData.inicio);
      p.set('importadoAte', intervaloData.fim);
    }
    return p;
  }

  /**
   * Janela de linhas a desenhar. `posicao` vem de quem chamou porque o render
   * roda em requestAnimationFrame: ler `viewport.scrollTop` lá dentro devolveria
   * uma posição que pode ter mudado desde o evento que pediu o quadro.
   */
  function intervalo(posicaoInformada) {
    const altura = alturaLinha();
    const cabecalho = tabela.tHead?.offsetHeight ?? 38;
    const posicao = posicaoInformada ?? (viewport.offsetParent === null ? posicaoSalva : viewport.scrollTop);
    const inicio = Math.max(0, Math.floor((posicao - cabecalho) / altura) - MARGEM_ACIMA);
    const fimBruto = Math.ceil((posicao + (viewport.clientHeight || 600) - cabecalho) / altura) + MARGEM_ABAIXO;
    // Limite é `itens.length`, NÃO `total`: a lista paginada é a fonte do que
    // existe para desenhar. Usar `total` fazia a janela pedir índices ainda não
    // carregados, `exibidos` saía vazio e a lista parecia pular de posição.
    return { inicio: Math.min(inicio, itens.length), fim: Math.min(itens.length, Math.max(inicio, fimBruto)) };
  }

  function linhasVisiveis() {
    const area = viewport.getBoundingClientRect();
    const topo = area.top + (tabela.tHead?.offsetHeight ?? 38);
    return [...corpo.querySelectorAll('tr[data-id]')].filter(linha => {
      const r = linha.getBoundingClientRect();
      return r.bottom > topo && r.top < area.bottom;
    });
  }

  // -------------------------------------------------------------- seleção

  function atualizarSelecao(visiveisCalculados) {
    const n = selecionados.size;
    $('#contador-selecao').textContent = `${n} selecionados · ${total} resultados`;
    $('#aviso-selecao').hidden = !n;
    for (const id of ['limpar-selecao', 'reimportar-selecao', 'remover-selecao']) $('#' + id).disabled = !n || ocupado;
    $('#adicionar-colecao').disabled = !n || ocupado || !$('#colecao-destino').value;
    $('#desvincular-colecao').disabled = !n || ocupado || !$('#filtro-colecao').value;
    $('#selecionar-visiveis').disabled = ocupado || !itens.length;
    const visiveis = visiveisCalculados ?? linhasVisiveis();
    const marcados = visiveis.filter(l => selecionados.has(l.dataset.id)).length;
    $('#selecao-visivel').checked = !!visiveis.length && marcados === visiveis.length;
    $('#selecao-visivel').indeterminate = marcados > 0 && marcados < visiveis.length;
    for (const linha of corpo.querySelectorAll('tr[data-id]')) {
      const marcado = selecionados.has(linha.dataset.id);
      linha.classList.toggle('selecionada', marcado);
      const caixa = linha.querySelector('input');
      if (caixa) caixa.checked = marcado;
    }
  }

  function selecionar(video, indice, evento) {
    if (ocupado) {
      evento.preventDefault();
      return;
    }
    const marcar = evento.currentTarget.checked;
    const anterior = itens.findIndex(v => v.id === ultimaSelecao);
    const alvos = evento.shiftKey && anterior >= 0
      ? itens.slice(Math.min(anterior, indice), Math.max(anterior, indice) + 1)
      : [video];
    for (const alvo of alvos) {
      if (marcar) selecionados.add(alvo.id);
      else selecionados.delete(alvo.id);
    }
    ultimaSelecao = video.id;
    atualizarSelecao();
  }

  // ------------------------------------------------------------- formatação

  function duracao(segundos) {
    if (!Number.isFinite(segundos)) return '—';
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = Math.floor(segundos % 60);
    return h
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;
  }

  function dataCurta(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR');
  }

  const ROTULOS_ESTADO = { novo: 'Novo', importando: 'Importando', pronto: 'Pronto', parcial: 'Parcial', erro: 'Erro' };

  function selo(estado, rotulo) {
    const el = document.createElement('span');
    el.className = 'selo';
    el.dataset.estado = estado;
    el.textContent = rotulo ?? ROTULOS_ESTADO[estado] ?? estado;
    return el;
  }

  // ------------------------------------------------------------- linha

  /** Miniatura com botão de abrir painel — nunca abre por clique na linha. */
  function miniatura(video) {
    const caixa = document.createElement('div');
    caixa.className = 'miniatura';

    if (video.miniaturaUrl) {
      const img = document.createElement('img');
      img.src = video.miniaturaUrl;
      img.alt = '';
      img.loading = 'lazy';
      img.decoding = 'async';
      caixa.append(img);
    } else {
      const vazio = document.createElement('span');
      vazio.className = 'sem-miniatura';
      vazio.textContent = 'sem miniatura';
      caixa.append(vazio);
    }

    if (Number.isFinite(video.duracaoSegundos)) {
      const seloDuracao = document.createElement('span');
      seloDuracao.className = 'duracao-selo';
      seloDuracao.textContent = duracao(video.duracaoSegundos);
      caixa.append(seloDuracao);
    }

    const abrir = document.createElement('button');
    abrir.type = 'button';
    abrir.className = 'abrir-painel';
    abrir.setAttribute('aria-label', `Ler detalhes de ${video.titulo}`);
    abrir.addEventListener('click', () => aoAbrirPainel?.(video.id));
    caixa.append(abrir);

    return caixa;
  }

  /** Resumo na linha: texto completo com limite de linhas e expansão. */
  function resumoNaLinha(video) {
    const bloco = document.createElement('div');
    bloco.className = 'celula-video-texto-resumo';

    const texto = previas.get(video.id);
    if (!texto) {
      const vazio = document.createElement('span');
      vazio.className = 'resumo-vazio';
      vazio.textContent = video.temResumo ? 'resumo ainda não carregado' : 'Sem resumo';
      bloco.append(vazio);
      return bloco;
    }

    const paragrafo = document.createElement('p');
    paragrafo.className = 'resumo-linha';
    if (expandidos.has(video.id)) paragrafo.classList.add('expandido');
    paragrafo.textContent = texto;
    bloco.append(paragrafo);

    // Só oferece "ver mais" quando o texto realmente passa do limite.
    if (texto.length > 180) {
      const botao = document.createElement('button');
      botao.type = 'button';
      botao.className = 'ver-mais';
      const aberto = expandidos.has(video.id);
      botao.textContent = aberto ? 'ver menos' : 'ver mais';
      botao.addEventListener('click', () => {
        if (aberto) expandidos.delete(video.id);
        else expandidos.add(video.id);
        agendar();
      });
      bloco.append(botao);
    }

    return bloco;
  }

  function linha(video, indice) {
    const tr = document.createElement('tr');
    tr.dataset.id = video.id;
    tr.setAttribute('aria-rowindex', String(indice + 2));

    // 1. seleção
    const tdSelecao = document.createElement('td');
    tdSelecao.className = 'col-selecao';
    const caixa = document.createElement('input');
    caixa.type = 'checkbox';
    caixa.setAttribute('aria-label', `Selecionar ${video.titulo}`);
    caixa.checked = selecionados.has(video.id);
    caixa.addEventListener('click', evento => selecionar(video, indice, evento));
    tdSelecao.append(caixa);

    // 2. vídeo: miniatura + título + resumo (leitura principal)
    const tdVideo = document.createElement('td');
    tdVideo.dataset.coluna = 'titulo';
    const celula = document.createElement('div');
    celula.className = 'celula-video';

    const blocoTexto = document.createElement('div');
    blocoTexto.className = 'celula-video-texto';

    const nome = document.createElement('a');
    nome.className = 'titulo-video';
    nome.textContent = video.titulo;
    nome.title = video.titulo;
    nome.href = video.url || '#';
    nome.target = '_blank';
    nome.rel = 'noopener noreferrer';
    // Impede que o clique no título use o link como "abrir painel".
    nome.addEventListener('click', evento => evento.stopPropagation());
    blocoTexto.append(nome);

    // A sub-linha não repete o que já tem coluna própria (canal, duração,
    // data adicionado). Mostra o que só existe aqui: o vínculo com coleções.
    const sub = document.createElement('div');
    sub.className = 'video-sub';
    const data = dataCurta(video.criadoEm);
    const partes = [];
    const nColecoes = (video.colecaoIds ?? []).length;
    if (nColecoes) partes.push(`${nColecoes} ${nColecoes === 1 ? 'coleção' : 'coleções'}`);
    if (video.youtubeId) partes.push(video.youtubeId);
    if (!partes.length && data !== '—') partes.push(`adicionado ${data}`);
    sub.textContent = partes.join(' · ');
    if (sub.textContent) blocoTexto.append(sub);

    celula.append(miniatura(video), blocoTexto);
    tdVideo.append(celula);

    tr.append(tdSelecao, tdVideo);

    // 3. canal
    const tdCanal = textoTd(video.canalNome ?? '—');
    tdCanal.dataset.coluna = 'canal';
    tdCanal.classList.add('celula-canal');

    // 4. duração
    const tdDuracao = textoTd(duracao(video.duracaoSegundos));
    tdDuracao.dataset.coluna = 'duracao';
    tdDuracao.classList.add('celula-duracao');

    // 5. adicionado
    const tdAdicionado = textoTd(data);
    tdAdicionado.dataset.coluna = 'adicionado';
    tdAdicionado.classList.add('celula-data');

    // 6. estado do vídeo
    const tdEstado = document.createElement('td');
    tdEstado.dataset.coluna = 'estado';
    tdEstado.append(selo(video.estado));

    // 7. resumo (recorte; a leitura real está na coluna vídeo e no painel)
    const tdResumo = document.createElement('td');
    tdResumo.dataset.coluna = 'resumo';
    tdResumo.className = 'celula-resumo';
    tdResumo.append(resumoNaLinha(video));

    // 8. estado do resumo — ÚLTIMA coluna (contrato do E2E: td:last-child === 'Pronto')
    const tdResumoEstado = document.createElement('td');
    tdResumoEstado.dataset.coluna = 'resumo-estado';
    // A coluna se chama "Transcrição": mostra o estado do vídeo, não do resumo
    // (o resumo já tem o próprio selo na coluna Resumo).
    tdResumoEstado.append(
      video.temResumo ? selo('pronto', 'Pronto') : selo('sem', 'Sem resumo'),
    );

    tr.append(tdCanal, tdDuracao, tdAdicionado, tdEstado, tdResumo, tdResumoEstado);

    if (selecionados.has(video.id)) tr.classList.add('selecionada');
    return tr;
  }

  function textoTd(texto, classe) {
    const td = document.createElement('td');
    td.textContent = texto;
    if (classe) td.className = classe;
    return td;
  }

  function espaco(px) {
    const tr = document.createElement('tr');
    tr.dataset.espacador = '';
    tr.setAttribute('aria-hidden', 'true');
    const td = document.createElement('td');
    td.colSpan = TOTAL_COLUNAS;
    td.style.height = `${px}px`;
    td.style.padding = '0';
    td.style.border = '0';
    tr.append(td);
    return tr;
  }

  // ------------------------------------------------------------- renderização

  function renderizar() {
    quadro = null;
    const altura = alturaLinha();
    const posicao = posicaoPendente ?? viewport.scrollTop;
    posicaoPendente = null;
    const { inicio, fim } = intervalo(posicao);
    const exibidos = itens.slice(inicio, fim);

    const cabecalho = tabela.tHead?.offsetHeight ?? 38;
    const primeiroVisivel = Math.floor(posicao / altura);
    const ultimoVisivel = Math.ceil((posicao + viewport.clientHeight - cabecalho) / altura);

    const proximas = new Map();
    const nodes = [];
    const visiveis = [];


    if (inicio > 0) {
      espacoSuperior.firstElementChild.style.height = `${inicio * altura}px`;
      nodes.push(espacoSuperior);
    }

    exibidos.forEach((video, i) => {
      const indice = inicio + i;
      const anterior = linhasAtuais.get(video.id);
      const elemento = anterior?.video === video && anterior.indice === indice && anterior.altura === altura
        ? anterior.elemento
        : linha(video, indice);
      proximas.set(video.id, { video, indice, elemento, altura });
      nodes.push(elemento);
      if (indice >= primeiroVisivel && indice < ultimoVisivel) visiveis.push(elemento);
    });

    const restante = total - inicio - exibidos.length;
    if (restante > 0) {
      espacoInferior.firstElementChild.style.height = `${restante * altura}px`;
      nodes.push(espacoInferior);
    }

    const manter = new Set(nodes);
    for (const filho of [...corpo.children]) if (!manter.has(filho)) filho.remove();
    nodes.forEach((node, i) => {
      if (corpo.children[i] !== node) corpo.insertBefore(node, corpo.children[i] ?? null);
    });

    /*
     * Por que NÃO "corrigimos" o scroll aqui: o espaçador superior é desenhado
     * a partir de `inicio`, que já é derivado da posição de scroll do evento.
     * Enquanto a diferença `inicio*altura - posicao` não passar de `altura`,
     * o primeiro item continua visível e nada salta. Reposicionar o scroll
     * dentro do render criaria um laço: cada quadro reagendaria o anterior e a
     * lista nunca alcançaria a posição pedida pelo usuário (foi medido: um
     * salto para o índice 3.000 parava no 2.156).
     */

    linhasAtuais = proximas;
    tabela.setAttribute('aria-rowcount', String(total + 1));
    viewport.dataset.total = String(total);
    viewport.dataset.carregados = String(itens.length);
    viewport.dataset.renderizadas = String(exibidos.length);
    viewport.dataset.modo = modo;
    atualizarSelecao(visiveis);

    if (fim >= itens.length && itens.length < total && cursor && !carregando && !falhaPagina) {
      void carregarMais(fim + PAGINA);
    }
  }

  function agendar() {
    if (quadro === null) {
      // Congela a posição no instante do agendamento; o quadro seguinte pode
      // rodar depois de vários eventos de scroll e desenharia a janela errada.
      posicaoPendente = viewport.offsetParent === null ? posicaoSalva : viewport.scrollTop;
      quadro = requestAnimationFrame(renderizar);
    }
  }

  // ------------------------------------------------------------- carregamento

  async function carregarMais(alvo) {
    if (carregando || !cursor || falhaPagina) return;
    carregando = true;
    const atual = geracao;
    try {
      while (cursor && itens.length < alvo && atual === geracao) {
        const p = new URLSearchParams(parametrosAtuais);
        p.set('cursor', cursor);
        const resposta = await api(`/api/biblioteca?${p}`, { signal: controle.signal });
        if (atual !== geracao) return;
        itens.push(...resposta.itens);
        cursor = resposta.proximoCursor;
        total = resposta.total;
      }
      $('#carregamento-biblioteca').textContent = cursor
        ? `${itens.length} de ${total} vídeos carregados`
        : `${total} vídeos carregados`;
      await calcularPrevias();
    } catch (erro) {
      if (erro.name !== 'AbortError' && atual === geracao) {
        falhaPagina = true;
        $('#resultado-biblioteca').textContent = erro.message;
      }
    } finally {
      if (atual === geracao) {
        carregando = false;
        agendar();
      }
    }
  }

  /**
   * Resumos são leitura própria (rota /resumo), mas buscar um por linha em
   * 500 linhas seria 500 requisições. O contrato de lista não devolve texto de
   * resumo, então a prévia é montada por consulta em lote quando o backend já
   * tem resumo: `temResumo` diz quais vale a pena buscar, e buscamos só os que
   * entraram na janela visível. Sem resumo não há requisição.
   */
  async function calcularPrevias() {
    const faltando = itens.filter(v => v.temResumo && !previas.has(v.id)).slice(0, 60);
    if (!faltando.length) return;
    await Promise.all(faltando.map(async video => {
      try {
        const resumo = await api(`/api/biblioteca/${encodeURIComponent(video.id)}/resumo`);
        if (resumo?.texto) previas.set(video.id, resumo.texto);
        else previas.set(video.id, '');
      } catch { previas.set(video.id, ''); }
    }));
    agendar();
  }

  async function carregar({ reset = false } = {}) {
    const posicao = reset ? 0 : (viewport.offsetParent === null ? posicaoSalva : viewport.scrollTop);
    const alvo = reset ? PAGINA : Math.max(PAGINA, intervalo().fim);
    const atual = ++geracao;
    controle?.abort();
    controle = new AbortController();
    carregando = true;
    falhaPagina = false;
    parametrosAtuais = consulta();
    if (reset) {
      viewport.scrollTop = 0;
      posicaoSalva = 0;
      ultimaSelecao = null;
      previas = new Map();
      expandidos = new Set();
    }
    viewport.setAttribute('aria-busy', 'true');
    $('#carregamento-biblioteca').textContent = 'Carregando vídeos…';
    try {
      const resposta = await api(`/api/biblioteca?${parametrosAtuais}`, { signal: controle.signal });
      if (atual !== geracao) return;
      itens = resposta.itens;
      total = resposta.total;
      cursor = resposta.proximoCursor;
      const semItens = total === 0;
      $('#vazio-biblioteca').hidden = !semItens;
      tabela.hidden = semItens;
      $('#vazio-biblioteca .vazio-titulo').textContent = $('#busca').value.trim() || temFiltroAtivo()
        ? 'Nenhum vídeo encontrado'
        : 'Biblioteca vazia';
      $('#vazio-biblioteca .vazio-texto').textContent = $('#busca').value.trim() || temFiltroAtivo()
        ? 'Nenhum vídeo corresponde aos filtros atuais. Ajuste ou limpe os filtros.'
        : 'Importe um vídeo pela janela "Adicionar link" ou pela tela de Importações.';
      $('#contador').textContent = `${total} ${total === 1 ? 'vídeo' : 'vídeos'}`;
      for (const th of tabela.querySelectorAll('th[data-ordenacao]')) {
        const ativo = th.dataset.ordenacao === ordenacao;
        th.setAttribute('aria-sort', ativo ? (direcao === 'asc' ? 'ascending' : 'descending') : 'none');
        th.classList.toggle('ordenado', ativo);
        th.dataset.ordenacaoDirecao = ativo ? direcao : '';
        th.querySelector('.seta-ordenacao').textContent = ativo ? (direcao === 'asc' ? '↑' : '↓') : '';
      }
      renderizar();
      viewport.scrollTop = posicao;
      posicaoSalva = posicao;
      carregando = false;
      if (cursor && alvo > itens.length) await carregarMais(alvo);
      await calcularPrevias();
      agendar();
      $('#carregamento-biblioteca').textContent = `${itens.length} de ${total} vídeos carregados`;
      atualizarResumoFiltros();
    } catch (erro) {
      if (erro.name === 'AbortError' || atual !== geracao) return;
      $('#resultado-biblioteca').textContent = erro.message;
      $('#carregamento-biblioteca').textContent = 'Falha ao carregar. Ajuste os filtros para tentar novamente.';
    } finally {
      if (atual === geracao) {
        carregando = false;
        viewport.setAttribute('aria-busy', 'false');
      }
    }
  }

  function temFiltroAtivo() {
    return ['filtro-estado', 'filtro-canal', 'filtro-playlist', 'filtro-colecao'].some(id => $('#' + id).value)
      || $('#filtro-resumo').checked
      || intervaloData !== null;
  }

  /** Contador no botão "Filtros" — deixa visível que há filtro aplicado. */
  function atualizarResumoFiltros() {
    let n = 0;
    if ($('#filtro-estado').value) n++;
    if ($('#filtro-canal').value) n++;
    if ($('#filtro-playlist').value) n++;
    if ($('#filtro-colecao').value) n++;
    if ($('#filtro-resumo').checked) n++;
    if (intervaloData) n++;
    const selo = $('#filtros-ativos');
    selo.hidden = n === 0;
    selo.textContent = String(n);
    $('#abrir-filtros').classList.toggle('botao-filtros', true);
  }

  // -------------------------------------------------------------- opções

  function preencher(id, lista, rotulo) {
    const select = $('#' + id);
    const valor = select.value;
    const inicial = document.createElement('option');
    inicial.value = '';
    inicial.textContent = rotulo;
    select.replaceChildren(inicial, ...lista.map(item => {
      const option = document.createElement('option');
      option.value = item.id;
      option.textContent = `${item.nome ?? item.titulo} (${item.contagem})`;
      return option;
    }));
    if ([...select.options].some(o => o.value === valor)) select.value = valor;
  }

  async function carregarOpcoes() {
    try {
      const [canais, playlists, colecoes] = await Promise.all([
        api('/api/biblioteca/canais'),
        api('/api/biblioteca/playlists'),
        api('/api/colecoes'),
      ]);
      preencher('filtro-canal', canais.itens, 'Todos');
      preencher('filtro-playlist', playlists.itens, 'Todas');
      preencher('filtro-colecao', colecoes.itens, 'Todas');
      preencher('colecao-destino', colecoes.itens, 'Escolha uma coleção');
      atualizarSelecao();
      return { canais: canais.itens, playlists: playlists.itens, colecoes: colecoes.itens };
    } catch (erro) {
      $('#resultado-biblioteca').textContent = erro.message;
      return { canais: [], playlists: [], colecoes: [] };
    }
  }

  // -------------------------------------------------------- ações em lote

  function chave(acao, ids, colecaoId) {
    const corpo = JSON.stringify({ acao, ids: [...ids].sort(), colecaoId });
    if (!chaves.has(corpo)) chaves.set(corpo, crypto.randomUUID());
    return { corpo, valor: chaves.get(corpo) };
  }

  async function executar(acao, ids = [...selecionados], colecaoId) {
    if (ocupado || !ids.length) return;
    ocupado = true;
    selecaoEmAcao = new Set(ids);
    atualizarSelecao();
    const requisicao = chave(acao, ids, colecaoId);
    try {
      let resultado;
      if (acao === 'desvincular') {
        resultado = { processados: 0, falhas: [] };
        for (const id of ids) {
          try {
            await api(`/api/colecoes/${encodeURIComponent(colecaoId)}/videos/${encodeURIComponent(id)}`, { method: 'DELETE' });
            resultado.processados++;
          } catch (erro) {
            resultado.falhas.push({ id, mensagem: erro.message });
          }
        }
      } else {
        resultado = await api('/api/biblioteca/lote', { method: 'POST', body: JSON.stringify({ acao, ids, colecaoId, chaveRequisicao: requisicao.valor }) });
      }
      const falhos = new Set(resultado.falhas.map(f => f.id));
      for (const id of selecaoEmAcao) if (!falhos.has(id)) selecionados.delete(id);
      $('#resultado-biblioteca').textContent = `${resultado.processados} IDs processados`
        + (resultado.trabalhoId ? ' — importação adicionada à fila.' : '.')
        + (resultado.falhas.length ? ' ' + resultado.falhas.map(f => f.mensagem).join(' ') : '');
      if (resultado.trabalhoId) aoEnfileirar?.(resultado.trabalhoId);
      chaves.delete(requisicao.corpo);
      await Promise.all([carregar(), carregarOpcoes()]);
    } catch (erro) {
      $('#resultado-biblioteca').textContent = erro.message;
    } finally {
      ocupado = false;
      selecaoEmAcao.clear();
      atualizarSelecao();
    }
  }

  function selecionarVisiveis() {
    const linhas = linhasVisiveis();
    const todos = linhas.every(l => selecionados.has(l.dataset.id));
    for (const l of linhas) {
      if (todos) selecionados.delete(l.dataset.id);
      else selecionados.add(l.dataset.id);
    }
    atualizarSelecao();
  }

  // ------------------------------------------------- visual: colunas e modo

  function montarColunas() {
    const lista = $('#colunas-lista');
    const ROTULOS = {
      canal: 'Canal',
      duracao: 'Duração',
      adicionado: 'Adicionado em',
      estado: 'Estado do vídeo',
      resumo: 'Resumo (recorte)',
      'resumo-estado': 'Estado do resumo',
    };
    lista.replaceChildren(...ordemColunas.map(nome => {
      const rotulo = document.createElement('label');
      rotulo.className = 'coluna-opcao';
      const caixa = document.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = colunas[nome];
      caixa.addEventListener('change', () => {
        colunas[nome] = caixa.checked;
        // A coluna "vídeo" nunca some: é onde a leitura acontece.
        aplicarColunas();
        salvarVisual();
      });
      const texto = document.createElement('span');
      texto.textContent = ROTULOS[nome] ?? nome;
      rotulo.append(caixa, texto);
      return rotulo;
    }));
    aplicarColunas();
  }

  function aplicarColunas() {
    const app = document.querySelector('.aplicativo');
    // O CSS usa data-coluna-<nome>="oculta" para esconder a coluna.
    for (const nome of ordemColunas) {
      app.setAttribute(`data-coluna-${nome}`, colunas[nome] ? 'visivel' : 'oculta');
    }
    linhasAtuais = new Map();
    if (itens.length) renderizar();
  }

  function aplicarModo(novoModo) {
    modo = novoModo === 'compacto' ? 'compacto' : 'ampliado';
    const app = document.querySelector('.aplicativo');
    app.dataset.modo = modo;
    for (const botao of document.querySelectorAll('[data-modo]')) {
      botao.classList.toggle('ativo', botao.dataset.modo === modo);
      botao.setAttribute('aria-pressed', String(botao.dataset.modo === modo));
    }
    // Altura mudou: as linhas antigas não servem mais, mas o índice corrente
    // continua válido (o scroll é a fonte de verdade da posição).
    linhasAtuais = new Map();
    salvarVisual();
    renderizar();
  }

  // ------------------------------------------------------------- eventos

  function ligar() {
    lerPreferencias();
    montarColunas();
    aplicarModo(modo);

    viewport.addEventListener('scroll', () => {
      if (viewport.offsetParent !== null) posicaoSalva = viewport.scrollTop;
      agendar();
    }, { passive: true });

    new ResizeObserver(agendar).observe(viewport);

    if ('IntersectionObserver' in window) {
      new IntersectionObserver(entradas => {
        if (entradas.some(e => e.isIntersecting)) void carregarMais(itens.length + PAGINA);
      }, { root: viewport, rootMargin: '600px' }).observe($('#sentinela-biblioteca'));
    }

    let debounce;
    $('#busca').addEventListener('input', () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => void carregar({ reset: true }), 180);
    });

    for (const id of ['filtro-estado', 'filtro-canal', 'filtro-playlist', 'filtro-colecao', 'filtro-resumo']) {
      $('#' + id).addEventListener('change', () => void carregar({ reset: true }));
    }

    $('#limpar-filtros').addEventListener('click', () => {
      $('#busca').value = '';
      for (const id of ['filtro-estado', 'filtro-canal', 'filtro-playlist', 'filtro-colecao']) $('#' + id).value = '';
      $('#filtro-resumo').checked = false;
      void carregar({ reset: true });
    });

    // Painel de filtros (antes era sempre visível)
    $('#abrir-filtros').addEventListener('click', () => {
      const painel = $('#painel-filtros');
      const abrir = painel.hidden;
      painel.hidden = !abrir;
      $('#abrir-filtros').setAttribute('aria-expanded', String(abrir));
    });

    // Painel de colunas
    $('#abrir-colunas').addEventListener('click', () => {
      const painel = $('#painel-colunas');
      const abrir = painel.hidden;
      painel.hidden = !abrir;
      $('#abrir-colunas').setAttribute('aria-expanded', String(abrir));
    });

    for (const botao of document.querySelectorAll('[data-modo]')) {
      botao.addEventListener('click', () => aplicarModo(botao.dataset.modo));
    }

    for (const th of tabela.querySelectorAll('th[data-ordenacao]')) {
      th.querySelector('button').addEventListener('click', () => {
        const campo = th.dataset.ordenacao;
        direcao = campo === ordenacao && direcao === 'asc' ? 'desc' : 'asc';
        ordenacao = campo;
        try {
          sessionStorage.setItem('contextflow.biblioteca.ordem', JSON.stringify({ campo: ordenacao, direcao }));
        } catch { /* idem */ }
        void carregar({ reset: true });
      });
    }

    $('#selecionar-visiveis').addEventListener('click', selecionarVisiveis);
    $('#selecao-visivel').addEventListener('click', selecionarVisiveis);
    $('#limpar-selecao').addEventListener('click', () => {
      selecionados.clear();
      atualizarSelecao();
    });
    $('#colecao-destino').addEventListener('change', () => atualizarSelecao());
    $('#reimportar-selecao').addEventListener('click', () => void executar('reimportar'));
    $('#adicionar-colecao').addEventListener('click', () => void executar('colecao', [...selecionados], $('#colecao-destino').value));
    $('#desvincular-colecao').addEventListener('click', () => void executar('desvincular', [...selecionados], $('#filtro-colecao').value));

    $('#remover-selecao').addEventListener('click', () => {
      confirmarIds = [...selecionados];
      $('#descricao-remocao').textContent = `Remover ${confirmarIds.length} vídeos selecionados, inclusive os que estão fora do filtro?`;
      $('#confirmar-remocao').showModal();
    });
    $('#cancelar-remocao').addEventListener('click', () => $('#confirmar-remocao').close());
    $('#confirmar-remocao-botao').addEventListener('click', () => {
      const ids = confirmarIds.slice();
      $('#confirmar-remocao').close();
      void executar('remover', ids);
    });

    $('#nova-colecao').addEventListener('click', () => {
      $('#erro-colecao').textContent = '';
      $('#criar-colecao').showModal();
      $('#nome-colecao').focus();
    });
    $('#cancelar-colecao').addEventListener('click', () => $('#criar-colecao').close());
    $('#formulario-colecao').addEventListener('submit', async evento => {
      evento.preventDefault();
      const botao = evento.target.querySelector('[type=submit]');
      botao.disabled = true;
      try {
        const colecao = await api('/api/colecoes', { method: 'POST', body: JSON.stringify({ titulo: $('#nome-colecao').value }) });
        await carregarOpcoes();
        $('#colecao-destino').value = colecao.id;
        $('#nome-colecao').value = '';
        $('#criar-colecao').close();
        atualizarSelecao();
      } catch (erro) {
        $('#erro-colecao').textContent = erro.message;
      } finally {
        botao.disabled = false;
      }
    });

    // Recolher a barra lateral inteira
    $('#recolher-barra').addEventListener('click', () => {
      const app = document.querySelector('.aplicativo');
      const recolhida = app.dataset.barra !== 'recolhida';
      app.dataset.barra = recolhida ? 'recolhida' : 'expandida';
      $('#recolher-barra').setAttribute('aria-label', recolhida ? 'Expandir barra lateral' : 'Recolher barra lateral');
      try {
        localStorage.setItem('contextflow.biblioteca.barra', recolhida ? 'recolhida' : 'expandida');
      } catch { /* idem */ }
      agendar();
    });
  }

  return {
    ligar,
    carregar,
    carregarOpcoes,
    recarregarOpcoes: carregarOpcoes,
    /** Usado pela árvore para selecionar filtros e recarregar. */
    aplicarFiltro(parametro, valor) {
      const mapa = { estado: 'filtro-estado', canalId: 'filtro-canal', playlistId: 'filtro-playlist', colecaoId: 'filtro-colecao' };
      const id = mapa[parametro];
      if (!id) return;
      $('#' + id).value = valor ?? '';
      void carregar({ reset: true });
    },
    /** Recorte por data vindo da árvore; usa filtros aditivos da API. */
    aplicarIntervaloData(inicio, fim) {
      intervaloData = inicio && fim ? { inicio, fim } : null;
      void carregar({ reset: true });
    },
    limparFiltros() {
      $('#busca').value = '';
      for (const id of ['filtro-estado', 'filtro-canal', 'filtro-playlist', 'filtro-colecao']) $('#' + id).value = '';
      $('#filtro-resumo').checked = false;
      intervaloData = null;
      void carregar({ reset: true });
    },
    get estado() {
      return { total, itens, selecionados: [...selecionados], modo };
    },
  };
}
