/**
 * Árvore lateral de organização (estilo Explorer) — F6-B, itens 6 e 8.
 *
 * Grupos: Todos os vídeos, Canais, Playlists, Data de importação, Minhas
 * coleções. Selecionar um nó usa as MESMAS rotas de filtro da Biblioteca —
 * não há mecanismo paralelo nem estado de filtro próprio aqui.
 *
 * Três decisões que valem explicação:
 *
 * 1. **Vídeos sob demanda.** Um canal pode ter milhares de vídeos; desenhar
 *    tudo ao abrir a barra lateral travaria a interface. Cada nó carrega a
 *    PRIMEIRA página ao ser expandido e cresce em blocos de 50 — carregamento
 *    progressivo, sem virtualização (a lista é curta por natureza).
 * 2. **Nada persistido para navegação.** A lista de vídeos de um grupo é
 *    derivada de `/api/biblioteca` a cada abertura; não há tabela, cache em
 *    `localStorage` nem registro paralelo.
 * 3. **Coleções têm menu próprio.** Criar/renomear/excluir/esvaziar são ações
 *    da organização; cada uma chama a rota correspondente e a árvore recarrega
 *    o grupo. Excluir coleção NUNCA apaga vídeo, e a confirmação diz isso.
 */
export function criarArvore({ api, aoFiltrar, aoLimpar, aoAbrirVideo }) {
  const $ = (seletor) => document.querySelector(seletor);
  const alvo = $('#arvore-grupos');

  let aberto = { todos: true, canais: true, playlists: false, datas: false, colecoes: false };
  let selecionado = null; // { grupo, valor }
  let dados = { canais: [], playlists: [], datas: [], colecoes: [] };
  let totalVideos = 0;

  /*
   * Estado dos vídeos por grupo: `{ [grupo:valor]: { itens, total, cursor,
   * carregando, aberto } }`. Vive só em memória e é descartado no reload —
   * é navegação, não dado.
   */
  const videos = new Map();

  const LIMITE = 50;

  function salvarEstado() {
    try {
      localStorage.setItem('contextflow.arvore.aberto', JSON.stringify(aberto));
    } catch { /* armazenamento indisponível não impede a árvore */ }
  }

  function lerEstado() {
    try {
      const salvo = JSON.parse(localStorage.getItem('contextflow.arvore.aberto') ?? 'null');
      if (salvo && typeof salvo === 'object') aberto = { ...aberto, ...salvo };
    } catch { /* idem */ }
  }

  const el = (tag, props = {}, ...filhos) => {
    const n = document.createElement(tag);
    for (const [k, v] of Object.entries(props)) {
      if (k === 'classe') n.className = v;
      else if (k === 'texto') n.textContent = v;
      else if (k === 'dataset') Object.assign(n.dataset, v);
      else if (k.startsWith('on')) n.addEventListener(k.slice(2), v);
      else if (v !== undefined && v !== null && v !== false) n.setAttribute(k, v === true ? '' : String(v));
    }
    n.append(...filhos.filter(Boolean));
    return n;
  };

  /* ----------------------------------------------------- vídeos por grupo */

  /** Parâmetros de filtro da API para um nó. Fonte única: a Biblioteca. */
  function filtroDoGrupo(grupo, item) {
    if (grupo === 'canais') return { canalId: item.id };
    if (grupo === 'playlists') return { playlistId: item.id };
    if (grupo === 'colecoes') return { colecaoId: item.id };
    if (grupo === 'datas') {
      const [ano, mes] = item.id.split('-').map(Number);
      const inicio = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, 1)).toISOString();
      const fim = new Date(Date.UTC(ano ?? 1970, mes ?? 1, 1)).toISOString();
      return { inicio, fim };
    }
    return {};
  }

  function chaveDe(grupo, item) {
    return `${grupo}:${item.id}`;
  }

  async function carregarVideos(grupo, item, mais = false) {
    const chave = chaveDe(grupo, item);
    const atual = videos.get(chave) ?? { itens: [], total: 0, cursor: null, carregando: false, aberto: false };
    if (atual.carregando) return;
    atual.carregando = true;
    videos.set(chave, atual);
    try {
      const filtro = filtroDoGrupo(grupo, item);
      const params = new URLSearchParams({ limite: String(LIMITE) });
      if (filtro.canalId) params.set('canalId', filtro.canalId);
      if (filtro.playlistId) params.set('playlistId', filtro.playlistId);
      if (filtro.colecaoId) params.set('colecaoId', filtro.colecaoId);
      // Nomes REAIS da API (conferidos em repositorio-sqlite.ts): o recorte
      // de data é `importadoDe`/`importadoAte`. Inventar `criadoDe` devolvia
      // a biblioteca inteira para qualquer mês escolhido.
      if (filtro.inicio) params.set('importadoDe', filtro.inicio);
      if (filtro.fim) params.set('importadoAte', filtro.fim);
      if (mais && atual.cursor) params.set('cursor', atual.cursor);
      const pagina = await api(`/api/biblioteca?${params}`);
      atual.itens = mais ? [...atual.itens, ...pagina.itens] : pagina.itens;
      atual.total = pagina.total;
      atual.cursor = pagina.proximoCursor ?? null;
    } catch (erro) {
      atual.erro = erro.message;
    } finally {
      atual.carregando = false;
      atual.aberto = true;
      pintar();
    }
  }

  /** Lista de vídeos de um nó, com "carregar mais" e marcação de estado. */
  function listaDeVideos(grupo, item) {
    const chave = chaveDe(grupo, item);
    const estado = videos.get(chave);
    const caixa = el('div', { classe: 'arvore-videos', dataset: { grupo } });
    if (!estado) {
      caixa.append(el('span', { classe: 'no-arvore no-vazio', texto: 'Carregando vídeos…' }));
      return caixa;
    }
    if (estado.erro) {
      caixa.append(el('span', { classe: 'no-arvore no-vazio', texto: estado.erro }));
      return caixa;
    }
    if (!estado.itens.length) {
      caixa.append(el('span', { classe: 'no-arvore no-vazio', texto: 'nenhum vídeo' }));
      return caixa;
    }
    for (const video of estado.itens) {
      const no = el('button', {
        type: 'button',
        classe: 'no-arvore no-video',
        dataset: { video: video.id, grupo },
        title: video.titulo,
        'aria-label': `Vídeo: ${video.titulo}. Localizar na Biblioteca`,
        onclick: () => {
          // "Localizar" = aplicar a busca da Biblioteca pelo título e rolar
          // até a linha. Não cria registro nem troca de tela.
          aoAbrirVideo?.(video);
        },
      });
      const rotulo = el('span', { classe: 'rotulo-no', texto: video.titulo ?? '(sem título)' });
      const marca = el('span', { classe: 'marca-video', 'aria-hidden': 'true' });
      if (video.temResumo) marca.textContent = '▤';
      if (video.estado && video.estado !== 'pronto') {
        marca.textContent = video.estado === 'parcial' ? '◐' : '○';
        marca.dataset.estado = video.estado;
      }
      no.append(rotulo, marca);
      caixa.append(no);
    }
    if (estado.itens.length < estado.total) {
      caixa.append(el('button', {
        type: 'button',
        classe: 'no-arvore no-mais',
        texto: `Ver mais (${estado.itens.length} de ${estado.total})`,
        onclick: () => void carregarVideos(grupo, item, true),
      }));
    }
    return caixa;
  }

  /* ---------------------------------------------------------------- grupos */

  function criarGrupo(chave, rotulo, itens, aoSelecionar, opcoes = {}) {
    const grupo = el('div', { classe: 'grupo-arvore', dataset: { grupo: chave } });

    const cabecalho = el('button', {
      type: 'button',
      classe: 'grupo-cabecalho',
      'aria-expanded': String(Boolean(aberto[chave])),
    });
    cabecalho.append(
      el('span', { classe: 'seta-grupo', 'aria-hidden': 'true', texto: '▶' }),
      el('span', { classe: 'rotulo-grupo', texto: rotulo }),
      el('span', { classe: 'contagem-grupo', texto: String(opcoes.contagem ?? itens.length) }),
    );
    if (opcoes.aoCriar) {
      const criar = el('button', {
        type: 'button', classe: 'botao-mini botao-criar-grupo',
        'aria-label': `Criar ${rotulo.toLowerCase()}`, title: `Criar ${rotulo.toLowerCase()}`,
        texto: '+',
        onclick: (ev) => { ev.stopPropagation(); opcoes.aoCriar(); },
      });
      cabecalho.append(criar);
    }
    grupo.append(cabecalho);

    const filhos = el('div', { classe: 'grupo-filhos' });
    filhos.hidden = !aberto[chave];

    // Uma única mensagem de vazio: `opcoes.vazio` quando o grupo tem texto
    // próprio ("nenhuma coleção"), senão o genérico.
    if (!itens.length) {
      filhos.append(el('span', { classe: 'no-arvore no-vazio', texto: opcoes.vazio ?? 'nada ainda' }));
    }

    for (const item of itens) {
      const linha = el('div', { classe: 'no-linha' });
      const no = el('button', { type: 'button', classe: 'no-arvore', dataset: { grupo: chave, valor: item.id } });
      no.append(
        el('span', { classe: 'rotulo-no', texto: item.nome ?? item.titulo ?? 'sem nome', title: item.nome ?? item.titulo }),
        el('span', { classe: 'contagem-grupo', texto: String(item.contagem ?? '') }),
      );
      if (selecionado && selecionado.grupo === chave && selecionado.valor === item.id) {
        no.classList.add('ativo');
        no.setAttribute('aria-selected', 'true');
      }
      no.addEventListener('click', () => {
        selecionado = { grupo: chave, valor: item.id };
        aoSelecionar(item);
        // Selecionar também expande a lista de vídeos do nó: o clique serve
        // para filtrar E para localizar, e o usuário não precisa de dois gestos.
        if (!videos.get(chaveDe(chave, item))?.aberto) void carregarVideos(chave, item);
        pintar();
      });

      // Expandir/recolher os vídeos do nó sem filtrar.
      const alternar = el('button', {
        type: 'button', classe: 'botao-expandir-no',
        'aria-label': `Mostrar vídeos de ${item.nome ?? item.titulo ?? 'nó'}`,
        'aria-expanded': String(Boolean(videos.get(chaveDe(chave, item))?.aberto)),
        texto: '▶',
        onclick: (ev) => {
          ev.stopPropagation();
          const estadoAtual = videos.get(chaveDe(chave, item));
          if (estadoAtual?.aberto) {
            estadoAtual.aberto = false;
            pintar();
          } else {
            void carregarVideos(chave, item);
          }
        },
      });
      linha.append(alternar, no);
      if (opcoes.acoesDeItem) linha.append(opcoes.acoesDeItem(chave, item));
      filhos.append(linha);

      if (videos.get(chaveDe(chave, item))?.aberto) {
        filhos.append(listaDeVideos(chave, item));
      }
    }

    cabecalho.addEventListener('click', () => {
      aberto[chave] = !aberto[chave];
      filhos.hidden = !aberto[chave];
      cabecalho.setAttribute('aria-expanded', String(Boolean(aberto[chave])));
      salvarEstado();
    });

    grupo.append(filhos);
    return grupo;
  }

  function pintarSelecao() {
    for (const no of alvo.querySelectorAll('.no-arvore')) {
      const ativo = selecionado && no.dataset.grupo === selecionado.grupo && no.dataset.valor === selecionado.valor;
      no.classList.toggle('ativo', Boolean(ativo));
      no.setAttribute('aria-selected', String(Boolean(ativo)));
    }
  }

  /* ------------------------------------------------- "Todos os vídeos" --- */

  /**
   * Seção "Todos os vídeos": navega pela biblioteca inteira, com expandir,
   * recolher, localizar e selecionar.
   *
   * A lista NÃO repete a Biblioteca (não é uma segunda tabela): mostra os
   * primeiros vídeos da ordem atual e "localizar" leva à linha na Biblioteca.
   * Assim a lateral continua sendo navegação, não uma duplicata dos dados.
   */
  let todos = { itens: [], total: 0, cursor: null, carregando: false, aberto: false, busca: '' };

  async function carregarTodos(mais = false) {
    if (todos.carregando) return;
    todos.carregando = true;
    try {
      const params = new URLSearchParams({ limite: String(LIMITE) });
      if (todos.busca.trim()) params.set('busca', todos.busca.trim());
      if (mais && todos.cursor) params.set('cursor', todos.cursor);
      const pagina = await api(`/api/biblioteca?${params}`);
      todos.itens = mais ? [...todos.itens, ...pagina.itens] : pagina.itens;
      todos.total = pagina.total;
      todos.cursor = pagina.proximoCursor ?? null;
      todos.aberto = true;
    } catch (erro) {
      todos.erro = erro.message;
    } finally {
      todos.carregando = false;
      pintar();
    }
  }

  function grupoTodos() {
    /*
     * "Todos os vídeos" NÃO usa `.grupo-arvore`.
     *
     * Motivo: é navegação (localizar/selecionar), não um eixo de organização.
     * Manter a classe o faria contar como um quarto grupo em consumidores que
     * contam `#arvore-grupos .grupo-arvore` — inclusive o cenário F5-UI do
     * proprietário ("canais, playlists, datas e coleções"). A seção tem
     * classe própria e o cabeçalho reaproveita o estilo.
     */
    const grupo = el('div', { classe: 'secao-todos', dataset: { grupo: 'todos' } });
    const cabecalho = el('button', {
      type: 'button', classe: 'grupo-cabecalho',
      'aria-expanded': String(Boolean(aberto.todos)),
    });
    cabecalho.append(
      el('span', { classe: 'seta-grupo', 'aria-hidden': 'true', texto: '▶' }),
      el('span', { classe: 'rotulo-grupo', texto: 'Todos os vídeos' }),
      el('span', { classe: 'contagem-grupo', texto: String(todos.total || totalVideos) }),
    );
    grupo.append(cabecalho);

    const filhos = el('div', { classe: 'grupo-filhos' });
    filhos.hidden = !aberto.todos;

    if (aberto.todos) {
      // Busca dentro da própria seção: "localizar" sem sair da lateral.
      // `type="text"` + `role="searchbox"`: mesmo motivo do campo de
      // Importações — `input[type="search"]` precisa continuar único na
      // página, porque o teste de Visualização do proprietário o usa como
      // seletor da busca principal da Biblioteca.
      const campo = el('input', {
        type: 'text', role: 'searchbox', classe: 'arvore-busca',
        placeholder: 'Localizar vídeo…',
        'aria-label': 'Localizar vídeo na lista',
        value: todos.busca,
      });
      let debounce;
      campo.addEventListener('input', () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => {
          todos.busca = campo.value;
          todos.cursor = null;
          void carregarTodos();
        }, 200);
      });
      campo.addEventListener('click', (ev) => ev.stopPropagation());
      filhos.append(campo);

      const acoes = el('div', { classe: 'arvore-acoes-todos' });
      acoes.append(
        el('button', {
          type: 'button', classe: 'botao-acao-todos', texto: 'Selecionar',
          title: 'Selecionar na Biblioteca os vídeos listados aqui',
          'aria-label': 'Selecionar na Biblioteca os vídeos listados aqui',
          onclick: () => aoAbrirVideo?.(null, { selecionarListados: todos.itens.map((v) => v.id) }),
        }),
        el('button', {
          type: 'button', classe: 'botao-acao-todos', texto: 'Ver todos',
          title: 'Limpar filtros e voltar à Biblioteca completa',
          onclick: () => aoLimpar?.(),
        }),
      );
      filhos.append(acoes);

      if (todos.erro) {
        filhos.append(el('span', { classe: 'no-arvore no-vazio', texto: todos.erro }));
      } else if (!todos.itens.length && todos.aberto) {
        filhos.append(el('span', { classe: 'no-arvore no-vazio', texto: todos.busca ? 'nenhum vídeo encontrado' : 'biblioteca vazia' }));
      } else if (!todos.aberto) {
        filhos.append(el('button', {
          type: 'button', classe: 'no-arvore no-mais', texto: 'Carregar vídeos',
          onclick: () => void carregarTodos(),
        }));
      } else {
        for (const video of todos.itens) {
          const no = el('button', {
            type: 'button', classe: 'no-arvore no-video', dataset: { video: video.id },
            title: video.titulo, 'aria-label': `Vídeo: ${video.titulo}. Localizar na Biblioteca`,
            onclick: () => aoAbrirVideo?.(video),
          });
          no.append(
            el('span', { classe: 'rotulo-no', texto: video.titulo ?? '(sem título)' }),
            el('span', { classe: 'marca-video', 'aria-hidden': 'true', texto: video.temResumo ? '▤' : '' }),
          );
          filhos.append(no);
        }
        if (todos.itens.length < todos.total) {
          filhos.append(el('button', {
            type: 'button', classe: 'no-arvore no-mais',
            texto: `Ver mais (${todos.itens.length} de ${todos.total})`,
            onclick: () => void carregarTodos(true),
          }));
        }
      }
    }

    cabecalho.addEventListener('click', () => {
      aberto.todos = !aberto.todos;
      salvarEstado();
      // Abrir a seção é o gatilho do primeiro carregamento (progressivo).
      if (aberto.todos && !todos.aberto) void carregarTodos();
      else pintar();
    });
    grupo.append(filhos);
    return grupo;
  }

  /* ------------------------------------------------------------- coleções */

  /**
   * Menu de uma coleção.
   *
   * Usa `window.confirm`/`window.prompt` de propósito nesta fase: são nativos,
   * acessíveis por teclado, não adicionam dependência nem CSS, e deixam o
   * texto de confirmação explícito sobre o que NÃO acontece com os vídeos.
   */
  function acoesDeColecao(item) {
    const acoes = el('span', { classe: 'acoes-no' });
    const abrirMenu = async (acao) => {
      if (acao === 'renomear') {
        const novo = window.prompt('Novo nome da coleção:', item.titulo ?? '');
        if (novo === null) return;
        try {
          await api(`/api/colecoes/${encodeURIComponent(item.id)}`, {
            method: 'PATCH',
            body: JSON.stringify({ titulo: novo }),
          });
          await carregar();
          avisar(`Coleção renomeada para “${novo.trim()}”.`);
        } catch (erro) {
          avisar(`Não foi possível renomear: ${erro.message}`, 'erro');
        }
        return;
      }
      if (acao === 'esvaziar') {
        if (!window.confirm(`Esvaziar “${item.titulo}”?\n\nOs ${item.contagem ?? 0} vídeos saem da coleção e continuam na biblioteca.`)) return;
        try {
          const r = await api(`/api/colecoes/${encodeURIComponent(item.id)}/videos`, { method: 'DELETE' });
          await carregar();
          avisar(`${r.removidos} vídeo(s) removido(s) da coleção. Eles continuam na biblioteca.`);
        } catch (erro) {
          avisar(`Não foi possível esvaziar: ${erro.message}`, 'erro');
        }
        return;
      }
      if (acao === 'excluir') {
        if (!window.confirm(
          `Excluir a coleção “${item.titulo}”?\n\n`
          + 'Só a coleção é apagada: os vídeos, suas transcrições e resumos continuam na biblioteca.\n'
          + 'Para apagar um vídeo, use “Remover da biblioteca”.',
        )) return;
        try {
          const r = await api(`/api/colecoes/${encodeURIComponent(item.id)}`, { method: 'DELETE' });
          if (selecionado?.grupo === 'colecoes' && selecionado.valor === item.id) {
            selecionado = null;
            aoLimpar?.();
          }
          await carregar();
          avisar(`Coleção excluída. ${r.desvinculados} vínculo(s) removido(s); vídeos preservados.`);
        } catch (erro) {
          avisar(`Não foi possível excluir: ${erro.message}`, 'erro');
        }
      }
    };

    const menu = el('details', { classe: 'menu-no' },
      el('summary', { classe: 'botao-mini', 'aria-label': `Ações da coleção ${item.titulo}`, title: 'Ações da coleção', texto: '⋯' }));
    const lista = el('div', { classe: 'menu-no-lista', role: 'menu' });
    for (const [acao, rotulo] of [['renomear', 'Renomear…'], ['esvaziar', 'Esvaziar coleção…'], ['excluir', 'Excluir coleção…']]) {
      lista.append(el('button', {
        type: 'button', role: 'menuitem', classe: acao === 'excluir' ? 'menu-item perigo' : 'menu-item',
        texto: rotulo,
        onclick: (ev) => {
          ev.stopPropagation();
          menu.open = false;
          void abrirMenu(acao);
        },
      }));
    }
    menu.append(lista);
    menu.addEventListener('click', (ev) => ev.stopPropagation());
    acoes.append(menu);
    return acoes;
  }

  function avisar(mensagem, tipo) {
    const alvoAviso = $('#arvore-aviso');
    if (!alvoAviso) return;
    alvoAviso.textContent = mensagem;
    alvoAviso.dataset.tipo = tipo ?? 'ok';
    alvoAviso.hidden = false;
    clearTimeout(avisar.timer);
    avisar.timer = setTimeout(() => { alvoAviso.hidden = true; }, 6000);
  }

  async function criarColecao() {
    const titulo = window.prompt('Nome da nova coleção:', '');
    if (titulo === null) return;
    if (!titulo.trim()) { avisar('O nome não pode ficar vazio.', 'erro'); return; }
    try {
      await api('/api/colecoes', { method: 'POST', body: JSON.stringify({ titulo }) });
      aberto.colecoes = true;
      salvarEstado();
      await carregar();
      avisar(`Coleção “${titulo.trim()}” criada.`);
    } catch (erro) {
      avisar(`Não foi possível criar: ${erro.message}`, 'erro');
    }
  }

  /* --------------------------------------------------------------- pintar */

  function pintar() {
    // A seção "Todos os vídeos" vai primeiro: é o caminho mais usado.
    const grupos = [grupoTodos()];

    grupos.push(criarGrupo('canais', 'Canais', dados.canais, (item) => aoFiltrar('canalId', item.id)));
    grupos.push(criarGrupo('playlists', 'Playlists', dados.playlists, (item) => aoFiltrar('playlistId', item.id)));
    grupos.push(criarGrupo('datas', 'Data de importação', dados.datas, (item) => {
      const { inicio, fim } = filtroDoGrupo('datas', item);
      aoFiltrar('dataImportacao', { inicio, fim });
    }));
    grupos.push(criarGrupo('colecoes', 'Minhas coleções', dados.colecoes, (item) => aoFiltrar('colecaoId', item.id), {
      aoCriar: () => void criarColecao(),
      acoesDeItem: (_chave, item) => acoesDeColecao(item),
      vazio: 'nenhuma coleção',
    }));

    alvo.replaceChildren(...grupos);
    pintarSelecao();
  }

  async function carregar() {
    try {
      const [canais, playlists, colecoes, meses, biblioteca] = await Promise.all([
        api('/api/biblioteca/canais'),
        api('/api/biblioteca/playlists'),
        api('/api/colecoes'),
        api('/api/biblioteca/meses'),
        // Só o TOTAL: a lista completa de vídeos é carregada sob demanda.
        api('/api/biblioteca?limite=1'),
      ]);
      dados = {
        canais: canais.itens ?? [],
        playlists: playlists.itens ?? [],
        datas: meses.itens ?? [],
        colecoes: colecoes.itens ?? [],
      };
      totalVideos = biblioteca.total ?? 0;
      pintar();
    } catch (erro) {
      alvo.replaceChildren(el('p', { classe: 'no-arvore', texto: 'Não foi possível carregar a organização.', title: erro.message }));
    }
  }

  function ligar() {
    lerEstado();
    $('#recolher-arvore')?.addEventListener('click', () => {
      const algumAberto = Object.values(aberto).some(Boolean);
      for (const chave of Object.keys(aberto)) aberto[chave] = !algumAberto;
      salvarEstado();
      pintar();
    });
    // O estado de "aberto" da seção Todos carrega junto com a página: se o
    // usuário deixou aberto, os vídeos aparecem sem novo clique.
    if (aberto.todos) void carregarTodos();
    void carregar();
  }

  return {
    ligar,
    carregar,
    /** Chamado depois de importar/excluir vídeo: só as contagens mudam. */
    atualizarContagens() { void carregar(); },
    limparSelecao() {
      selecionado = null;
      pintarSelecao();
    },
    get estado() { return { selecionado, totalVideos, grupos: { ...dados } }; },
  };
}
