/**
 * Árvore lateral de organização (estilo Explorer).
 *
 * Grupos: Canais, Playlists, Data de importação, Minhas coleções.
 * Sem drag-and-drop (futuro explícito). Selecionar um nó usa as MESMAS rotas de
 * filtro que o painel de filtros — não há mecanismo paralelo.
 */
export function criarArvore({ api, aoFiltrar, aoLimpar }) {
  const $ = seletor => document.querySelector(seletor);
  const alvo = $('#arvore-grupos');

  let aberto = { canais: true, playlists: false, datas: false, colecoes: false };
  let selecionado = null; // { grupo, valor, chave }
  let dados = { canais: [], playlists: [], datas: [], colecoes: [] };
  let carregado = false;

  function salvarEstado() {
    try {
      localStorage.setItem('contextflow.arvore.aberto', JSON.stringify(aberto));
    } catch { /* idem */ }
  }

  function lerEstado() {
    try {
      const salvo = JSON.parse(localStorage.getItem('contextflow.arvore.aberto') ?? 'null');
      if (salvo && typeof salvo === 'object') aberto = { ...aberto, ...salvo };
    } catch { /* idem */ }
  }

  function criarGrupo(chave, rotulo, itens, aoSelecionarNo) {
    const grupo = document.createElement('div');
    grupo.className = 'grupo-arvore';

    const cabecalho = document.createElement('button');
    cabecalho.type = 'button';
    cabecalho.className = 'grupo-cabecalho';
    cabecalho.setAttribute('aria-expanded', String(!!aberto[chave]));

    const seta = document.createElement('span');
    seta.className = 'seta-grupo';
    seta.textContent = '▶';
    seta.setAttribute('aria-hidden', 'true');

    const nome = document.createElement('span');
    nome.className = 'rotulo-grupo';
    nome.textContent = rotulo;

    const contagem = document.createElement('span');
    contagem.className = 'contagem-grupo';
    contagem.textContent = String(itens.length);

    cabecalho.append(seta, nome, contagem);
    grupo.append(cabecalho);

    const filhos = document.createElement('div');
    filhos.className = 'grupo-filhos';
    filhos.hidden = !aberto[chave];

    if (!itens.length) {
      const vazio = document.createElement('span');
      vazio.className = 'no-arvore';
      vazio.style.cursor = 'default';
      vazio.textContent = 'nada ainda';
      filhos.append(vazio);
    }

    for (const item of itens) {
      const no = document.createElement('button');
      no.type = 'button';
      no.className = 'no-arvore';
      no.dataset.grupo = chave;
      no.dataset.valor = item.id;
      const rotuloNo = document.createElement('span');
      rotuloNo.className = 'rotulo-no';
      rotuloNo.textContent = item.nome ?? item.titulo ?? 'sem nome';
      rotuloNo.title = rotuloNo.textContent;
      const qtd = document.createElement('span');
      qtd.className = 'contagem-grupo';
      qtd.textContent = String(item.contagem ?? '');
      no.append(rotuloNo, qtd);
      if (selecionado && selecionado.grupo === chave && selecionado.chave === item.id) {
        no.classList.add('ativo');
        no.setAttribute('aria-selected', 'true');
      }
      no.addEventListener('click', () => {
        selecionado = { grupo: chave, valor: item.id, chave: item.id };
        aoSelecionarNo(chave, item);
        pintarSelecao();
      });
      filhos.append(no);
    }

    cabecalho.addEventListener('click', () => {
      aberto[chave] = !aberto[chave];
      filhos.hidden = !aberto[chave];
      cabecalho.setAttribute('aria-expanded', String(!!aberto[chave]));
      salvarEstado();
    });

    grupo.append(filhos);
    return grupo;
  }

  function pintarSelecao() {
    for (const no of alvo.querySelectorAll('.no-arvore')) {
      const ativo = selecionado && no.dataset.grupo === selecionado.grupo && no.dataset.valor === selecionado.valor;
      no.classList.toggle('ativo', !!ativo);
      no.setAttribute('aria-selected', String(!!ativo));
    }
  }

  function pintar() {
    const grupos = [];

    grupos.push(criarGrupo('canais', 'Canais', dados.canais, (chave, item) => aoFiltrar('canalId', item.id)));

    grupos.push(criarGrupo('playlists', 'Playlists', dados.playlists, (chave, item) => aoFiltrar('playlistId', item.id)));

    grupos.push(criarGrupo('datas', 'Data de importação', dados.datas, (chave, item) => {
      // `id` é AAAA-MM; a API espera um intervalo semiaberto em ISO.
      const [ano, mes] = item.id.split('-').map(Number);
      const inicio = new Date(Date.UTC(ano ?? 1970, (mes ?? 1) - 1, 1)).toISOString();
      const fim = new Date(Date.UTC(ano ?? 1970, mes ?? 1, 1)).toISOString();
      aoFiltrar('dataImportacao', { inicio, fim });
    }));

    grupos.push(criarGrupo('colecoes', 'Minhas coleções', dados.colecoes, (chave, item) => aoFiltrar('colecaoId', item.id)));

    alvo.replaceChildren(...grupos);
    pintarSelecao();
  }

  async function carregar() {
    try {
      const [canais, playlists, colecoes, meses] = await Promise.all([
        api('/api/biblioteca/canais'),
        api('/api/biblioteca/playlists'),
        api('/api/colecoes'),
        // Agrupado no banco: derivar de uma página daria contagem errada.
        api('/api/biblioteca/meses'),
      ]);
      dados = {
        canais: canais.itens ?? [],
        playlists: playlists.itens ?? [],
        datas: meses.itens ?? [],
        colecoes: colecoes.itens ?? [],
      };
      carregado = true;
      pintar();
    } catch (erro) {
      const aviso = document.createElement('p');
      aviso.className = 'no-arvore';
      aviso.textContent = 'Não foi possível carregar a organização.';
      aviso.title = erro.message;
      alvo.replaceChildren(aviso);
    }
  }

  function ligar() {
    lerEstado();
    $('#recolher-arvore').addEventListener('click', () => {
      const algumAberto = Object.values(aberto).some(Boolean);
      for (const chave of Object.keys(aberto)) aberto[chave] = !algumAberto;
      salvarEstado();
      pintar();
    });
    void carregar();
  }

  return {
    ligar,
    carregar,
    limparSelecao() {
      selecionado = null;
      pintarSelecao();
    },
  };
}
