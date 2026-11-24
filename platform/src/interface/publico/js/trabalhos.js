/**
 * Tabela de Importações — apresentação e ações do histórico de trabalhos.
 *
 * Por que um módulo próprio: a tela de Importações acumulava, em
 * `aplicacao.js`, a marcação da linha, o cancelar/repetir, o carregamento
 * paginado, o formulário e a limpeza por categoria. Nada disso era reutilizado
 * fora dali, mas tudo dependia de detalhes internos do outro. Aqui ficam:
 *
 *   - a leitura da fila (`GET /api/trabalhos`), com pesquisa/filtro/ordenação
 *     aplicados no cliente sobre a página já carregada;
 *   - o desenho da tabela e das linhas de detalhe (filhos de playlist/lote);
 *   - as ações: cancelar, repetir, remover do histórico (individual e em lote);
 *   - a seleção por checkbox, que é estado de tela e não de dados.
 *
 * O que NÃO fica aqui: importar (formulário), acompanhar resumo (painel — ver
 * `resumos.js`) e limpar histórico por categoria (segue em `aplicacao.js`,
 * com o painel de confirmação). A regra de negócio continua no motor; este
 * arquivo só reflete o que a API devolve.
 *
 * Contrato de DOM: a `<tr>` de cada trabalho expõe `data-id`, e o conteúdo
 * mantém os seletores históricos (`.trabalho-titulo`, `.trabalho-meta`,
 * `[data-acao]`) porque os testes de fumaça e E2E leem por eles.
 */

const ESTADOS = {
  'na-fila': 'Na fila',
  executando: 'Executando',
  concluido: 'Concluído',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
};

/*
 * FASES — cópia FIEL da tabela de `aplicacao.js` (fonte: o motor).
 *
 * A primeira versão deste módulo inventou chaves (`buscando-metadados`,
 * `transcrevendo`) que o banco nunca produz: o motor grava `metadados`,
 * `legenda`, `gravacao`, `descobrindo`, `aguardando-itens`, `finalizado`.
 * O efeito era a sub-linha cair no fallback e mostrar `metadados` cru.
 */
const FASES = {
  aguardando: 'Aguardando',
  metadados: 'Buscando metadados',
  legenda: 'Buscando legenda',
  gravacao: 'Salvando',
  descobrindo: 'Lendo playlist',
  'aguardando-itens': 'Processando itens',
  finalizado: 'Finalizado',
  gerando: 'Gerando resumo',
  concluido: 'Finalizado',
};

const TIPOS = {
  'importar-video': 'Vídeo',
  'importar-playlist': 'Playlist',
  'importar-lote': 'Lote',
  'gerar-resumo': 'Resumo',
};

/** Rótulos de estado aplicáveis ao selo visual (data-estado). */
const SELO = {
  concluido: 'pronto',
  'na-fila': 'na-fila',
  executando: 'processando',
  falhou: 'erro',
  cancelado: 'cancelado',
};

const TERMINAIS = ['concluido', 'falhou', 'cancelado'];

const ICONES = {
  cancelar: { glifo: '⏹', rotulo: 'Cancelar importação' },
  repetir: { glifo: '↻', rotulo: 'Repetir importação' },
  remover: { glifo: '✕', rotulo: 'Remover do histórico' },
};

const formatarData = (iso) => {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  // `pt-BR` com dois dígitos: 21/11 23:04. O ano só aparece se diferir do atual.
  const opcoes = { day: '2-digit', month: '2-digit' };
  if (d.getFullYear() !== new Date().getFullYear()) opcoes.year = 'numeric';
  return `${d.toLocaleDateString('pt-BR', opcoes)} ${d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;
};

/**
 * Progresso exibível. O pedido é explícito: porcentagem só quando confiável.
 *
 * Regras:
 *  - número finito entre 0 e 1 → barra + `%`;
 *  - trabalho terminal sem progresso numérico → barra cheia, sem `%` (o estado
 *    já diz "Concluído"; inventar 100% seria mentira em caso de falha);
 *  - em andamento sem número → barra hachurada com texto "processando".
 *
 * `null` e `undefined` são ausência; `0` é um valor legítimo, por isso a
 * checagem é por tipo e não por falsidade (armadilha clássica: `Number(null)`).
 */
function leituraProgresso(trabalho) {
  const p = trabalho.progresso;
  const confiavel = typeof p === 'number' && Number.isFinite(p) && p >= 0 && p <= 1;
  const percentual = confiavel ? Math.round(p * 100) : null;
  if (confiavel) {
    return {
      percentual,
      determinada: true,
      resultado: trabalho.estado === 'concluido' ? 'ok'
        : trabalho.estado === 'falhou' ? 'falhou'
          : trabalho.estado === 'cancelado' ? 'cancelado' : 'andamento',
    };
  }
  if (trabalho.estado === 'concluido') return { percentual: null, determinada: false, cheia: true, resultado: 'ok' };
  return { percentual: null, determinada: false, resultado: null };
}

/** Nome exibido: título real quando existe, senão o tipo + a URL de origem. */
function nomeTrabalho(trabalho) {
  const titulo = trabalho.titulo ?? trabalho.resultado?.video?.titulo;
  if (titulo) return { texto: titulo, provisorio: false };
  const origem = trabalho.resultado?.video?.url ?? trabalho.parametros?.url;
  if (origem) {
    try {
      const url = new URL(origem);
      const id = url.searchParams.get('v');
      return { texto: id ? `Vídeo ${id}` : url.pathname.split('/').filter(Boolean).at(-1) ?? origem, provisorio: true };
    } catch {
      return { texto: origem, provisorio: true };
    }
  }
  return { texto: TIPOS[trabalho.tipo] ?? 'Trabalho', provisorio: true };
}

/**
 * Cria o controlador da tabela.
 *
 * `dependencias.api` é injetado para manter o módulo testável sem `fetch`, e
 * `aoConcluir` é o gancho que a Biblioteca usa para se atualizar sozinha
 * quando um trabalho termina (item 4 do pedido: sem sair da tela).
 */
export function criarTrabalhos({ api, $, aoConcluir, aoMudarAtivos, idsAcompanhados, aoRemoverAcompanhado } = {}) {
  const estado = {
    itens: [],
    porId: new Map(),
    selecionados: new Set(),
    detalhes: new Map(),
    filtroTipo: 'todos',
    filtroEstado: 'todos',
    pesquisa: '',
    ordem: 'recentes',
    cursor: null,
    carregando: false,
    carregandoMais: false,
    raiz: null,
  };

  const consulta = (el) => el?.querySelector?.(el.selector);

  /* --------------------------------------------------------------- dados */

  async function carregar({ mais = false } = {}) {
    if (estado.carregandoMais || estado.carregando) return;
    if (mais) estado.carregandoMais = true; else estado.carregando = true;
    try {
      const cursor = mais ? estado.cursor : null;
      const [pagina, ativosPagina] = await Promise.all([
        api(`/api/trabalhos?raizes=1&limite=50${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`),
        api('/api/trabalhos?raizes=1&ativos=1&limite=100'),
      ]);
      estado.cursor = pagina.proximoCursor ?? null;
      if (mais) estado.itens.push(...pagina.itens);
      else estado.itens = pagina.itens;

      estado.porId = new Map(estado.itens.map((t) => [t.id, t]));
      const acompanhados = new Map(estado.porId);
      for (const t of ativosPagina.itens) if (!acompanhados.has(t.id)) acompanhados.set(t.id, t);
      const anteriores = estado.porIdAnterior ?? new Map();
      const seguidos = new Set(idsAcompanhados?.() ?? []);
      const consultar = new Set([
        ...seguidos,
        ...[...anteriores.values()].filter(t => ['na-fila', 'executando'].includes(t.estado)).map(t => t.id),
      ]);
      await Promise.all([...consultar].filter(id => !acompanhados.has(id)).map(async id => {
        try {
          acompanhados.set(id, await api(`/api/trabalhos/${encodeURIComponent(id)}`));
        } catch (erro) {
          if (erro.codigo === 'nao_encontrado') aoRemoverAcompanhado?.(id);
          else if (anteriores.has(id)) acompanhados.set(id, anteriores.get(id));
        }
      }));

      // Reconciliar conclusões: um trabalho que saiu de ativo para terminal
      // precisa avisar quem depende dele (Biblioteca, árvore, painel de resumo).
      const concluidosAgora = [];
      for (const t of acompanhados.values()) {
        const anterior = anteriores.get(t.id);
        if ((anterior ? ['na-fila', 'executando'].includes(anterior.estado) : seguidos.has(t.id)) && TERMINAIS.includes(t.estado)) {
          concluidosAgora.push(t);
        }
      }
      estado.porIdAnterior = acompanhados;
      // Seleção não pode apontar para linha que sumiu (removida em outra aba).
      for (const id of [...estado.selecionados]) if (!estado.porId.has(id)) estado.selecionados.delete(id);

      desenhar();
      for (const t of concluidosAgora) await aoConcluir?.(t);
      const todos = [...acompanhados.values()];
      const ativos = todos.filter((t) => ['na-fila', 'executando'].includes(t.estado));
      aoMudarAtivos?.(ativos, todos);
    } catch (erro) {
      const aviso = $('#erro-trabalhos');
      if (aviso) aviso.textContent = erro.message;
    } finally {
      estado.carregando = false;
      estado.carregandoMais = false;
    }
  }

  /* ------------------------------------------------------------ filtros */

  const aplicaFiltros = () => {
    const q = estado.pesquisa.trim().toLowerCase();
    return estado.itens.filter((t) => {
      if (estado.filtroTipo !== 'todos' && t.tipo !== estado.filtroTipo) return false;
      if (estado.filtroEstado !== 'todos' && t.estado !== estado.filtroEstado) return false;
      if (!q) return true;
      const nome = nomeTrabalho(t).texto.toLowerCase();
      const url = String(t.resultado?.video?.url ?? t.parametros?.url ?? '').toLowerCase();
      const erro = String(t.erro ?? '').toLowerCase();
      return nome.includes(q) || url.includes(q) || erro.includes(q);
    });
  };

  const ordenados = (lista) => {
    const copia = [...lista];
    if (estado.ordem === 'antigos') return copia.reverse();
    if (estado.ordem === 'nome') return copia.sort((a, b) => nomeTrabalho(a).texto.localeCompare(nomeTrabalho(b).texto, 'pt-BR'));
    return copia; // `recentes`: a API já entrega do mais novo para o mais antigo
  };

  /* ----------------------------------------------------------- desenho */

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

  function selo(trabalho) {
    const s = el('span', { classe: 'selo', dataset: { estado: SELO[trabalho.estado] ?? 'pendente' } });
    s.textContent = ESTADOS[trabalho.estado] ?? trabalho.estado;
    return s;
  }

  function celulaProgresso(trabalho) {
    const info = leituraProgresso(trabalho);
    const td = el('td', { dataset: { coluna: 'progresso' } });
    const caixa = el('div', { classe: 'celula-progresso' });
    const trilho = el('div', {
      classe: 'trilho-progresso',
      role: 'progressbar',
      'aria-valuemin': '0',
      'aria-valuemax': '100',
      'aria-label': `Progresso: ${nomeTrabalho(trabalho).texto}`,
    });
    if (info.percentual !== null) {
      trilho.setAttribute('aria-valuenow', String(info.percentual));
      trilho.dataset.resultado = info.resultado;
    } else if (info.cheia) {
      trilho.setAttribute('aria-valuenow', '100');
      trilho.dataset.resultado = 'ok';
    } else if (trabalho.estado === 'falhou' || trabalho.estado === 'cancelado') {
      trilho.dataset.resultado = trabalho.estado;
      trilho.setAttribute('aria-valuetext', ESTADOS[trabalho.estado]);
    } else {
      trilho.dataset.indeterminado = 'true';
      trilho.setAttribute('aria-valuetext', 'Em processamento, sem percentual');
    }
    const preenchimento = el('span');
    preenchimento.style.width = `${info.percentual ?? (info.cheia ? 100 : 0)}%`;
    trilho.append(preenchimento);
    caixa.append(trilho);

    if (info.percentual !== null) {
      caixa.append(el('span', { classe: 'percentual', texto: `${info.percentual}%` }));
    } else if (['na-fila', 'executando'].includes(trabalho.estado)) {
      caixa.append(el('span', { classe: 'progresso-indefinido', texto: 'processando' }));
    } else if (trabalho.estado === 'falhou') {
      caixa.append(el('span', { classe: 'progresso-indefinido', texto: 'interrompido' }));
    }
    td.append(caixa);
    return td;
  }

  function botaoAcao(acao, trabalho, aoClicar) {
    const { glifo, rotulo } = ICONES[acao];
    const nome = nomeTrabalho(trabalho).texto;
    return el('button', {
      type: 'button',
      classe: 'botao-icone',
      'data-acao': acao,
      title: `${rotulo}: ${nome}`,
      'aria-label': `${rotulo}: ${nome}`,
      // Rótulo textual para leitores de tela e para teste, sem ocupar espaço.
      'aria-describedby': undefined,
      onclick: aoClicar,
    }, glifo);
  }

  function linha(trabalho) {
    const nome = nomeTrabalho(trabalho);
    // `classe: 'trabalho'` NÃO é decoração: é o seletor que os E2E e o CSS
    // existentes usam para achar a linha (`.trabalho[data-id="..."]`). Manter
    // a classe na `<tr>` evita reescrever testes de comportamento.
    const tr = el('tr', { classe: 'trabalho', dataset: { id: trabalho.id, estado: trabalho.estado } });

    // --- seleção
    const caixa = el('input', {
      type: 'checkbox',
      checked: estado.selecionados.has(trabalho.id),
      'aria-label': `Selecionar ${nome.texto}`,
      onchange: (ev) => {
        if (ev.target.checked) estado.selecionados.add(trabalho.id);
        else estado.selecionados.delete(trabalho.id);
        atualizarSelecao();
      },
    });
    tr.append(el('td', { dataset: { coluna: 'selecao' } }, caixa));

    // --- nome + linha de apoio
    // A sub-linha começa pelo ESTADO em texto. Duplica o selo de propósito:
    // é o que garante que a informação exista sem depender de cor/posição, e
    // mantém o contrato `.trabalho-meta` lido pelos testes existentes.
    const sub = [ESTADOS[trabalho.estado] ?? trabalho.estado];
    // A fase vai SEMPRE (não só em execução): a tabela é a tela de detalhe da
    // fila, e "Concluído · Finalizado · tentativa 2" é informação útil. O
    // texto é o rótulo legível E a fase crua quando diferem — testes e
    // leitores de tela procuram por "Buscando metadados".
    if (trabalho.fase) sub.push(FASES[trabalho.fase] ?? trabalho.fase);
    if (trabalho.tentativas > 1) sub.push(`tentativa ${trabalho.tentativas}`);
    if (trabalho.cancelamentoSolicitado && trabalho.estado === 'executando') sub.push('encerrando…');
    if (['importar-playlist', 'importar-lote'].includes(trabalho.tipo) && trabalho.contadores) {
      const c = trabalho.contadores;
      // A contagem precisa dizer o que o usuário quer saber: itens concluídos,
      // quantos SEM LEGENDA (não é falha) e quantos falharam.
      const partes = [`${c.concluidos}/${c.total} itens`];
      if (c.semLegenda) partes.push(`${c.semLegenda} sem legenda`);
      if (c.falhos) partes.push(`${c.falhos} falha(s)`);
      sub.push(partes.join(' · '));
    }
    if (trabalho.erro) sub.push(trabalho.erro);

    const nomeEl = el('span', {
      classe: `nome-trabalho trabalho-titulo${nome.provisorio ? ' mono' : ''}`,
      title: nome.texto,
      texto: nome.texto,
    });
    const subEl = el('span', {
      classe: 'nome-trabalho-sub trabalho-meta',
      title: sub.join(' · '),
      texto: sub.join(' · '),
    });
    tr.append(el('td', { dataset: { coluna: 'nome' } }, el('div', { classe: 'celula-nome' }, nomeEl, subEl)));

    // --- tipo, data, progresso, estado
    tr.append(el('td', { dataset: { coluna: 'tipo' }, texto: TIPOS[trabalho.tipo] ?? trabalho.tipo }));
    tr.append(el('td', {
      dataset: { coluna: 'data' },
      classe: 'trabalho-data',
      texto: formatarData(trabalho.criadoEm ?? trabalho.atualizadoEm),
      title: formatarData(trabalho.criadoEm ?? trabalho.atualizadoEm),
    }));
    tr.append(celulaProgresso(trabalho));
    tr.append(el('td', { dataset: { coluna: 'estado' } }, selo(trabalho)));

    // --- ações
    const acoes = el('div', { classe: 'celula-acoes trabalho-acoes' });
    const temFilhos = ['importar-playlist', 'importar-lote'].includes(trabalho.tipo);
    if (temFilhos) {
      const aberto = estado.detalhes.has(trabalho.id);
      acoes.append(el('button', {
        type: 'button', classe: 'botao-icone botao-itens-trabalho',
        'data-acao': 'itens', 'aria-expanded': String(aberto),
        'aria-controls': `itens-trabalho-${trabalho.id}`,
        onclick: ev => alternarDetalhe(trabalho, ev.currentTarget),
      }, el('span', { 'aria-hidden': 'true', classe: 'seta-itens-trabalho', texto: '▸' }), 'Itens'));
    }
    if (['na-fila', 'executando'].includes(trabalho.estado)) {
      acoes.append(botaoAcao('cancelar', trabalho, (ev) => cancelar(trabalho, ev.currentTarget)));
    } else if (trabalho.estado === 'falhou' || trabalho.estado === 'cancelado') {
      acoes.append(botaoAcao('repetir', trabalho, (ev) => repetir(trabalho, ev.currentTarget)));
    }
    if (TERMINAIS.includes(trabalho.estado)) {
      acoes.append(botaoAcao('remover', trabalho, (ev) => remover(trabalho, ev.currentTarget)));
    }
    tr.append(el('td', { dataset: { coluna: 'acoes' } }, acoes));
    return tr;
  }

  function criarDetalhe(id) {
    const lista = el('div', { classe: 'lista-filhos', dataset: { pai: id }, tabindex: '0', role: 'region', 'aria-label': 'Lista de itens' });
    const aviso = el('p', { classe: 'painel-nota', role: 'status', texto: 'Carregando itens…' });
    const mais = el('button', { type: 'button', classe: 'botao-secundario', hidden: true, texto: 'Mais itens' });
    const recolher = el('button', { type: 'button', classe: 'botao-secundario', texto: 'Recolher itens' });
    const painel = el('section', {
      id: `itens-trabalho-${id}`, classe: 'painel-itens-trabalho', 'aria-label': 'Itens da importação',
    }, aviso, lista, el('div', { classe: 'acoes-itens-trabalho' }, mais, recolher));
    const linha = el('tr', { classe: 'linha-detalhe' }, el('td', { colspan: '7' }, painel));
    const detalhe = { linha, aviso, lista, mais, paginas: 0, cursor: null, carregando: false, maisPendente: false, instantaneo: null };
    mais.addEventListener('click', () => {
      const trabalho = estado.porId.get(id);
      if (trabalho) void carregarFilhos(trabalho, detalhe, true);
    });
    recolher.addEventListener('click', () => {
      const botao = linha.previousElementSibling?.querySelector('[data-acao="itens"]');
      const trabalho = estado.porId.get(id);
      if (!botao || !trabalho) return;
      alternarDetalhe(trabalho, botao);
      botao.focus({ preventScroll: true });
    });
    return detalhe;
  }

  function itemFilho(filho) {
    const nome = nomeTrabalho(filho).texto;
    const meta = [FASES[filho.fase] ?? filho.fase, filho.erro].filter(Boolean).join(' · ');
    return el('div', { classe: 'item-filho', dataset: { id: filho.id } },
      el('div', {},
        el('strong', { classe: 'trabalho-titulo', texto: nome }),
        el('p', { classe: 'trabalho-meta', texto: meta })),
      selo(filho));
  }

  async function carregarFilhos(trabalho, detalhe, acrescentar = false) {
    if (detalhe.carregando) {
      if (acrescentar) detalhe.maisPendente = true;
      return;
    }
    if (acrescentar && !detalhe.cursor) return;
    detalhe.carregando = true;
    // Mantém as páginas visíveis durante o polling e evita perder o cursor.
    const limitePaginas = acrescentar ? 1 : Math.max(1, detalhe.paginas);
    let cursor = acrescentar ? detalhe.cursor : null;
    let paginas = 0;
    const filhos = [];
    try {
      do {
        const pagina = await api(`/api/trabalhos/${trabalho.id}/itens?limite=50${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
        filhos.push(...pagina.itens);
        cursor = pagina.proximoCursor;
        paginas++;
      } while (cursor && paginas < limitePaginas);
      if (estado.detalhes.get(trabalho.id) !== detalhe) return;
      if (acrescentar) {
        detalhe.lista.append(...filhos.map(itemFilho));
        detalhe.paginas += paginas;
      } else {
        const rolagem = detalhe.lista.scrollTop;
        detalhe.lista.replaceChildren(...filhos.map(itemFilho));
        detalhe.lista.scrollTop = rolagem;
        detalhe.paginas = paginas;
        detalhe.instantaneo = trabalho;
      }
      detalhe.cursor = cursor;
      detalhe.mais.hidden = !cursor;
      detalhe.aviso.textContent = detalhe.lista.childElementCount ? '' : 'Nenhum item disponível.';
      detalhe.aviso.hidden = !detalhe.aviso.textContent;
    } catch (erro) {
      detalhe.aviso.textContent = erro.message;
      detalhe.aviso.hidden = false;
    } finally {
      detalhe.carregando = false;
      if (detalhe.maisPendente && estado.detalhes.get(trabalho.id) === detalhe) {
        detalhe.maisPendente = false;
        void carregarFilhos(trabalho, detalhe, true);
      }
    }
  }

  function alternarDetalhe(trabalho, botao) {
    const existente = estado.detalhes.get(trabalho.id);
    if (existente) {
      existente.linha.remove();
      estado.detalhes.delete(trabalho.id);
      botao.setAttribute('aria-expanded', 'false');
      return;
    }
    const detalhe = criarDetalhe(trabalho.id);
    estado.detalhes.set(trabalho.id, detalhe);
    botao.closest('tr').after(detalhe.linha);
    botao.setAttribute('aria-expanded', 'true');
    void carregarFilhos(trabalho, detalhe);
  }

  /* ------------------------------------------------------------ ações */

  async function cancelar(trabalho, botao) {
    botao.disabled = true;
    try {
      await api(`/api/trabalhos/${trabalho.id}/cancelar`, {
        method: 'POST',
        body: JSON.stringify({ chaveRequisicao: crypto.randomUUID() }),
      });
      await carregar();
    } catch (erro) {
      avisar(erro.message);
      botao.disabled = false;
    }
  }

  async function repetir(trabalho, botao) {
    botao.disabled = true;
    try {
      const novo = await api(`/api/trabalhos/${trabalho.id}/repetir`, {
        method: 'POST',
        body: JSON.stringify({ chaveRequisicao: crypto.randomUUID() }),
      });
      await carregar();
      return novo;
    } catch (erro) {
      avisar(erro.message);
      botao.disabled = false;
    }
  }

  async function remover(trabalho, botao) {
    const nome = nomeTrabalho(trabalho).texto;
    // Confirmação obrigatória: é destrutiva para o histórico, ainda que não
    // toque no vídeo. Truncado em 70 caracteres para não estourar o diálogo.
    const curto = nome.length > 70 ? `${nome.slice(0, 67)}…` : nome;
    if (!window.confirm(`Remover “${curto}” do histórico?\n\nO vídeo, a transcrição e o resumo não são apagados.`)) return;
    botao.disabled = true;
    try {
      await api(`/api/trabalhos/${trabalho.id}`, { method: 'DELETE' });
      estado.selecionados.delete(trabalho.id);
      await carregar();
    } catch (erro) {
      avisar(erro.message);
      botao.disabled = false;
    }
  }

  /** Ações em lote sobre os ids marcados. */
  async function agirEmLote(acao) {
    const ids = [...estado.selecionados];
    if (!ids.length) return { feitos: 0 };
    if (acao === 'remover') {
      if (!window.confirm(`Remover ${ids.length} item(ns) do histórico?\n\nOs vídeos continuam na biblioteca.`)) return { feitos: 0 };
    }
    let feitos = 0;
    const falhas = [];
    for (const id of ids) {
      try {
        if (acao === 'cancelar') {
          await api(`/api/trabalhos/${id}/cancelar`, { method: 'POST', body: JSON.stringify({ chaveRequisicao: crypto.randomUUID() }) });
        } else if (acao === 'repetir') {
          await api(`/api/trabalhos/${id}/repetir`, { method: 'POST', body: JSON.stringify({ chaveRequisicao: crypto.randomUUID() }) });
        } else if (acao === 'remover') {
          await api(`/api/trabalhos/${id}`, { method: 'DELETE' });
          estado.selecionados.delete(id);
        }
        feitos += 1;
      } catch (erro) {
        falhas.push(erro.message);
      }
    }
    // Sequencial de propósito: são poucas unidades e a fila do motor é única;
    // disparar N requisições em paralelo só embaralha a ordem de execução.
    await carregar();
    atualizarSelecao();
    return { feitos, falhas };
  }

  function avisar(mensagem) {
    const alvo = $('#erro-trabalhos');
    if (!alvo) return;
    alvo.textContent = mensagem;
    alvo.dataset.tipo = 'erro';
  }

  /* --------------------------------------------------------- seleção */

  function atualizarSelecao() {
    const visiveis = ordenados(aplicaFiltros());
    const contagem = $('#contagem-selecao');
    if (contagem) {
      contagem.textContent = estado.selecionados.size
        ? `${estado.selecionados.size} selecionado(s)`
        : `${visiveis.length} de ${estado.itens.length}`;
    }
    const todos = $('#selecionar-todos');
    if (todos) {
      todos.checked = visiveis.length > 0 && visiveis.every((t) => estado.selecionados.has(t.id));
      todos.indeterminate = !todos.checked && visiveis.some((t) => estado.selecionados.has(t.id));
      todos.disabled = visiveis.length === 0;
    }
    const barra = $('#acoes-lote');
    if (barra) barra.hidden = estado.selecionados.size === 0;
    // Habilita só as ações aplicáveis ao conjunto marcado.
    const marcados = estado.itens.filter((t) => estado.selecionados.has(t.id));
    const ativos = marcados.filter((t) => ['na-fila', 'executando'].includes(t.estado));
    const repetiveis = marcados.filter((t) => ['falhou', 'cancelado'].includes(t.estado));
    const removiveis = marcados.filter((t) => TERMINAIS.includes(t.estado));
    const setar = (seletor, habilitado) => {
      const b = $(seletor);
      if (b) b.disabled = !habilitado;
    };
    setar('[data-lote="cancelar"]', ativos.length > 0);
    setar('[data-lote="repetir"]', repetiveis.length > 0);
    setar('[data-lote="remover"]', removiveis.length > 0);
  }

  /* ------------------------------------------------------------ render */

  function desenhar() {
    // O alvo é o <tbody> criado em `montar`; `#lista-trabalhos` é só o
    // contêiner. Escrever no contêiner apagaria o cabeçalho da tabela.
    const corpo = $('#lista-trabalhos tbody');
    if (!corpo) return;
    const visiveis = ordenados(aplicaFiltros());
    const foco = document.activeElement;
    const temFoco = corpo.contains(foco);
    const idFoco = temFoco && foco.dataset.acao === 'itens' ? foco.closest('tr').dataset.id : null;
    corpo.replaceChildren();

    if (!estado.itens.length) {
      corpo.append(el('tr', {}, el('td', { colspan: '7', classe: 'linha-vazia-trabalhos' },
        el('p', { texto: 'Nenhuma importação no histórico.' }),
        el('p', { classe: 'painel-nota', texto: 'Use o formulário acima para adicionar vídeos ou playlists.' }))));
    } else if (!visiveis.length) {
      corpo.append(el('tr', {}, el('td', { colspan: '7', classe: 'linha-vazia-trabalhos' },
        el('p', { texto: 'Nenhum trabalho corresponde aos filtros.' }))));
    } else {
      for (const t of visiveis) {
        corpo.append(linha(t));
        const detalhe = estado.detalhes.get(t.id);
        if (!detalhe) continue;
        corpo.append(detalhe.linha);
        const anterior = detalhe.instantaneo;
        if (anterior !== t && (!anterior || !TERMINAIS.includes(t.estado)
          || t.estado !== anterior.estado || t.atualizadoEm !== anterior.atualizadoEm)) {
          void carregarFilhos(t, detalhe);
        }
      }
    }
    if (idFoco) corpo.querySelector(`tr[data-id="${CSS.escape(idFoco)}"] [data-acao="itens"]`)?.focus({ preventScroll: true });
    else if (temFoco && corpo.contains(foco)) foco.focus({ preventScroll: true });

    const mais = $('#mais-trabalhos');
    if (mais) mais.hidden = !estado.cursor;

    const ativos = estado.itens.filter((t) => ['na-fila', 'executando'].includes(t.estado));
    const atividade = $('#atividade-importacoes');
    if (atividade) {
      atividade.textContent = ativos.length
        ? `${ativos.length} importação(ões) ativa(s)`
        : 'Fila atualizada';
      atividade.dataset.ativos = String(ativos.length);
    }
    atualizarSelecao();
  }

  /* --------------------------------------------------------- montagem */

  /**
   * Liga os controles estáticos da tela. A tabela em si é criada aqui — o HTML
   * guarda só o contêiner, para não haver duas fontes de verdade sobre colunas.
   */
  function montar(caixa) {
    estado.raiz = caixa;
    caixa.replaceChildren(
      el('table', { classe: 'tabela-trabalhos' },
        el('colgroup', {},
          el('col', { style: 'width:34px' }),
          el('col', {}),
          el('col', { style: 'width:92px' }),
          el('col', { style: 'width:96px' }),
          el('col', { style: 'width:120px' }),
          el('col', { style: 'width:96px' })),
        el('thead', {},
          el('tr', {},
            el('th', { dataset: { coluna: 'selecao' } },
              el('input', {
                type: 'checkbox', id: 'selecionar-todos', 'aria-label': 'Selecionar todos os trabalhos visíveis',
                onchange: (ev) => {
                  const visiveis = ordenados(aplicaFiltros());
                  if (ev.target.checked) visiveis.forEach((t) => estado.selecionados.add(t.id));
                  else visiveis.forEach((t) => estado.selecionados.delete(t.id));
                  desenhar();
                },
              })),
            el('th', { dataset: { coluna: 'nome' }, texto: 'Nome' }),
            el('th', { dataset: { coluna: 'tipo' }, texto: 'Tipo' }),
            el('th', { dataset: { coluna: 'data' }, texto: 'Data' }),
            el('th', { dataset: { coluna: 'progresso' }, texto: 'Progresso' }),
            el('th', { dataset: { coluna: 'estado' }, texto: 'Estado' }),
            el('th', { dataset: { coluna: 'acoes' }, texto: 'Ações' }))),
        el('tbody')),
    );
  }

  function ligarControles() {
    const pesquisa = $('#pesquisa-trabalhos');
    if (pesquisa) {
      let t = null;
      pesquisa.addEventListener('input', () => {
        clearTimeout(t);
        // 180 ms: suficiente para não redesenhar a cada tecla, curto o
        // bastante para a tabela parecer instantânea.
        t = setTimeout(() => { estado.pesquisa = pesquisa.value; desenhar(); }, 180);
      });
    }
    $('#filtro-tipo-trabalhos')?.addEventListener('change', (ev) => {
      estado.filtroTipo = ev.currentTarget.value;
      desenhar();
    });
    $('#filtro-estado-trabalhos')?.addEventListener('change', (ev) => {
      estado.filtroEstado = ev.currentTarget.value;
      desenhar();
    });
    $('#ordem-trabalhos')?.addEventListener('change', (ev) => {
      estado.ordem = ev.currentTarget.value;
      desenhar();
    });
    $('#mais-trabalhos')?.addEventListener('click', () => void carregar({ mais: true }));
    for (const botao of document.querySelectorAll('[data-lote]')) {
      botao.addEventListener('click', async () => {
        const { feitos, falhas } = await agirEmLote(botao.dataset.lote);
        const alvo = $('#resultado-lote');
        if (alvo) {
          alvo.textContent = falhas.length
            ? `${feitos} concluído(s), ${falhas.length} falha(s): ${falhas[0]}`
            : `${feitos} item(ns) processado(s).`;
          alvo.dataset.tipo = falhas.length ? 'erro' : 'ok';
        }
      });
    }
    $('#limpar-selecao-trabalhos')?.addEventListener('click', () => {
      estado.selecionados.clear();
      desenhar();
    });
  }

  return {
    montar,
    ligarControles,
    carregar,
    desenhar,
    agirEmLote,
    /** Exposto para o painel de resumo marcar a linha correspondente. */
    destacar(id) {
      const tr = $('#lista-trabalhos')?.querySelector(`tbody tr.trabalho[data-id="${id}"]`);
      if (tr) tr.dataset.destaque = 'true';
    },
    get itens() { return estado.itens; },
    /** Há trabalho em andamento? O polling da aplicação usa isto. */
    possuiAtivo() { return [...(estado.porIdAnterior?.values() ?? [])].some(t => ['na-fila', 'executando'].includes(t.estado)); },
  };
}
