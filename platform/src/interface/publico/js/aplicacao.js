import { criarBiblioteca } from './biblioteca.js';
import { criarPainel } from './painel-leitura.js';
import { criarArvore } from './arvore-organizacao.js';
import { criarAdicionarLink } from './adicionar-link.js';

/**
 * Interface do ContextFlow — camada de apresentação.
 *
 * Regra: a interface NUNCA é dona dos dados. Ela pede ao motor e reconcilia o que
 * voltou. Nada aqui simula um recurso ausente: quando o motor informa que um módulo
 * está pendente, a tela diz isso em vez de fingir funcionamento.
 *
 * F5-UI: a antiga tela "Leitura" foi absorvida pela Biblioteca — a leitura
 * acontece na linha (principal) e no painel sobreposto (complementar).
 */

const estado = {
  tela: 'biblioteca',
  ultimoStatus: null,
  ultimoTrabalho: null,
  pendentes: new Set(),
  trabalhos: new Map(),
  limiteTrabalhos: 50,
};

const $ = (seletor) => document.querySelector(seletor);
const $$ = (seletor) => [...document.querySelectorAll(seletor)];

/** Chamada única ao motor: trata o envelope {ok,dados} / {ok,erro}. */
async function api(caminho, opcoes = {}) {
  const resposta = await fetch(caminho, {
    headers: { 'content-type': 'application/json' },
    ...opcoes,
  });
  let corpo;
  try {
    corpo = await resposta.json();
  } catch {
    throw new Error(`Resposta inválida do motor (HTTP ${resposta.status})`);
  }
  if (!corpo || corpo.ok !== true) {
    const erro = corpo?.erro ?? { codigo: 'desconhecido', mensagem: `HTTP ${resposta.status}` };
    const falha = new Error(erro.mensagem);
    falha.codigo = erro.codigo;
    throw falha;
  }
  return corpo.dados;
}

/* ------------------------------------------------------------- status ---- */

function pintarStatus(motor) {
  const ponto = $('.ponto');
  const texto = $('.status-texto');
  const versao = $('#versao');

  if (motor) {
    ponto.dataset.estado = 'ok';
    texto.textContent = 'Motor conectado';
    versao.textContent = `v${motor.versao} · ${motor.plataforma}`;
    $('#atividade-global').textContent = motor.importacoesAtivas
      ? `${motor.importacoesAtivas} importações em andamento`
      : '';
  } else {
    ponto.dataset.estado = 'erro';
    texto.textContent = 'Motor indisponível';
  }
}

async function verificarMotor() {
  try {
    const saude = await api('/api/saude');
    estado.ultimoStatus = saude;
    pintarStatus(saude);
    return saude;
  } catch {
    pintarStatus(null);
    return null;
  }
}

/* ----------------------------------------------------------- navegação ---- */

const TELAS = ['biblioteca', 'importacoes', 'configuracoes'];

function mostrarTela(nome) {
  // #leitura era uma tela própria; link antigo não pode quebrar.
  if (nome === 'leitura') nome = 'biblioteca';
  if (!TELAS.includes(nome)) nome = 'biblioteca';

  estado.tela = nome;
  // A tela é refletida no container: é o que permite ao CSS esconder a árvore
  // de organização (que só filtra a Biblioteca) e ajustar o resto por tela.
  document.querySelector('.aplicativo').dataset.tela = nome;
  $$('.nav-item').forEach((botao) => {
    const ativo = botao.dataset.aba === nome;
    botao.classList.toggle('ativo', ativo);
    botao.setAttribute('aria-current', ativo ? 'page' : 'false');
  });
  $$('.tela').forEach((tela) => {
    tela.hidden = tela.dataset.telaNome !== nome;
  });
  // A tela é refletida na URL para deep-link e para o teste E2E não depender de ordem.
  history.replaceState(null, '', `#${nome}`);

  // Cada tela busca o que precisa ao ser aberta: a Biblioteca reflete a última
  // importação sem exigir recarregar a página.
  if (nome === 'biblioteca') void carregarBiblioteca();
  if (nome === 'importacoes') {
    void carregarDiagnostico();
    void carregarTrabalhos();
  }
}

function telaDaUrl() {
  const nome = location.hash.replace('#', '');
  return TELAS.includes(nome) ? nome : 'biblioteca';
}

/* ---------------------------------------------------------- biblioteca ---- */

let painelUI; // declarado depois de bibliotecaUI ficar disponível para os callbacks
const bibliotecaUI = criarBiblioteca({
  api,
  aoEnfileirar: (id) => estado.pendentes.add(id),
  aoAbrirPainel: (videoId) => painelUI?.abrir(videoId),
});

async function carregarBiblioteca() {
  await Promise.all([bibliotecaUI.carregar(), bibliotecaUI.carregarOpcoes()]);
}

const painelUIReal = criarPainel({ api });
painelUI = painelUIReal;

const arvoreUI = criarArvore({
  api,
  aoFiltrar: (parametro, valor) => {
    if (parametro === 'dataImportacao') {
      // A árvore de datas usa o filtro de intervalo da API (aditivo na F5-UI).
      // `null` desfaz o recorte — é o que o clique no nó já ativo faz.
      bibliotecaUI.aplicarIntervaloData(valor?.inicio, valor?.fim);
      return;
    }
    bibliotecaUI.aplicarFiltro(parametro, valor);
  },
  aoLimpar: () => bibliotecaUI.limparFiltros(),
});

const adicionarLinkUI = criarAdicionarLink({
  api,
  aoEnfileirar: (id) => {
    estado.pendentes.add(id);
    void carregarTrabalhos();
  },
});

/* --------------------------------------------------------- importações ---- */

function formatarTempo(ms) {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

async function carregarDiagnostico() {
  const caixa = $('#diagnostico-ingestao');
  const texto = $('#diagnostico-texto');
  if (!caixa || !texto) return;

  try {
    const diagnostico = await api('/api/ingestao/diagnostico');
    caixa.dataset.estado = diagnostico.ytdlp.disponivel ? 'ok' : 'erro';
    texto.textContent = diagnostico.mensagem;
  } catch (erro) {
    caixa.dataset.estado = 'erro';
    texto.textContent = erro.message;
  }
}

async function importarVideo(evento) {
  evento.preventDefault();
  const campo = $('#url-video');
  const saida = $('#resultado-validacao');
  const botao = $('#botao-importar');
  const url = campo.value.trim();

  saida.dataset.tipo = '';
  if (!url) {
    saida.dataset.tipo = 'erro';
    saida.textContent = 'Informe uma URL do YouTube.';
    return;
  }

  botao.disabled = true;
  try {
    const trabalho = await api('/api/trabalhos', {
      method: 'POST',
      body: JSON.stringify({
        tipo: $('#tipo-importacao').value,
        escopo: { url, chaveRequisicao: crypto.randomUUID() },
      }),
    });
    acompanharTrabalho(trabalho);
    campo.value = '';
    await carregarTrabalhos();
  } catch (erro) {
    saida.dataset.tipo = 'erro';
    saida.textContent = erro.message;
  } finally {
    botao.disabled = false;
  }
}

function acompanharTrabalho(trabalho) {
  estado.ultimoTrabalho = trabalho.id;
  estado.pendentes.add(trabalho.id);
  $('#resultado-validacao').dataset.tipo = 'pendente';
  $('#resultado-validacao').textContent = 'Adicionado à fila. Você pode continuar usando a biblioteca.';
}

function mostrarResultadoTrabalho(trabalho) {
  const saida = $('#resultado-validacao');
  const resultado = trabalho.resultado;
  if (trabalho.estado === 'falhou' || trabalho.estado === 'cancelado') {
    saida.dataset.tipo = 'erro';
    saida.textContent = trabalho.erro ?? 'Importação cancelada.';
    return;
  }
  if (resultado?.video) {
    const { video, transcricao } = resultado;
    if (transcricao.estado === 'pronta') {
      saida.dataset.tipo = 'ok';
      saida.textContent = `${resultado.criado ? 'Importado' : 'Já está na biblioteca'} — ${video.titulo}`
        + ` · ${transcricao.quantidadeSegmentos} trechos · legenda ${transcricao.origem === 'manual' ? 'manual' : 'automática'} (${transcricao.idioma}).`;
    } else {
      saida.dataset.tipo = 'aviso';
      saida.textContent = `${video.titulo} — ${transcricao.motivo}`;
    }
  } else {
    saida.dataset.tipo = 'ok';
    saida.textContent = `Importação concluída: ${trabalho.contadores.concluidos} itens.`;
  }
}

const ESTADOS_TRABALHO = {
  'na-fila': 'Na fila',
  executando: 'Executando',
  concluido: 'Concluído',
  falhou: 'Falhou',
  cancelado: 'Cancelado',
};
const FASES = {
  aguardando: 'Aguardando',
  metadados: 'Buscando metadados',
  legenda: 'Buscando legenda',
  gravacao: 'Salvando',
  descobrindo: 'Lendo playlist',
  'aguardando-itens': 'Processando itens',
  finalizado: 'Finalizado',
};

function linhaTrabalho(trabalho) {
  const linha = document.createElement('article');
  linha.className = 'trabalho';
  linha.dataset.id = trabalho.id;

  const titulo = document.createElement('strong');
  titulo.className = 'trabalho-titulo';
  titulo.textContent = trabalho.titulo ?? trabalho.resultado?.video?.titulo
    ?? ({ 'importar-video': 'Vídeo', 'importar-playlist': 'Playlist', 'importar-lote': 'Lote' }[trabalho.tipo]);

  const resumo = document.createElement('p');
  resumo.className = 'trabalho-meta';
  resumo.textContent = `${ESTADOS_TRABALHO[trabalho.estado]} · ${FASES[trabalho.fase] ?? trabalho.fase} · tentativa ${trabalho.tentativas}`;
  if (trabalho.cancelamentoSolicitado && trabalho.estado === 'executando') resumo.textContent += ' · encerrando…';

  // Estado como selo, para a fila ser lida de relance.
  const estadoSelo = document.createElement('span');
  estadoSelo.className = 'selo';
  estadoSelo.dataset.estado = trabalho.estado === 'concluido' ? 'pronto'
    : trabalho.estado === 'na-fila' ? 'na-fila'
      : trabalho.estado === 'executando' ? 'processando'
        : trabalho.estado === 'falhou' ? 'erro' : 'pendente';
  estadoSelo.textContent = ESTADOS_TRABALHO[trabalho.estado];

  const cabecalho = document.createElement('div');
  cabecalho.append(titulo, resumo);

  const acoes = document.createElement('div');
  acoes.className = 'trabalho-acoes';
  acoes.append(estadoSelo);

  const acao = ['na-fila', 'executando'].includes(trabalho.estado)
    ? 'cancelar'
    : ['falhou', 'cancelado'].includes(trabalho.estado) ? 'repetir' : null;

  linha.append(cabecalho, acoes);

  if (trabalho.tipo !== 'importar-video') {
    const c = trabalho.contadores;
    const contagem = document.createElement('p');
    contagem.className = 'trabalho-meta';
    contagem.style.gridColumn = '1 / -1';
    contagem.textContent = `${c.total} itens · ${c.concluidos} concluídos (${c.semLegenda} sem legenda) · ${c.falhos} falhos · ${c.cancelados} cancelados`;
    linha.append(contagem);
  }

  if (trabalho.progresso !== null && trabalho.progresso !== undefined) {
    const barra = document.createElement('div');
    barra.className = 'trabalho-barra';
    const preenchimento = document.createElement('span');
    preenchimento.style.width = `${Math.round(trabalho.progresso * 100)}%`;
    barra.append(preenchimento);
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-valuenow', String(Math.round(trabalho.progresso * 100)));
    barra.setAttribute('aria-valuemin', '0');
    barra.setAttribute('aria-valuemax', '100');
    barra.setAttribute('aria-label', 'Progresso da importação');
    linha.append(barra);
  }

  if (trabalho.erro) {
    const erro = document.createElement('p');
    erro.className = 'erro-trabalho';
    erro.style.gridColumn = '1 / -1';
    erro.textContent = trabalho.erro;
    linha.append(erro);
  }

  if (trabalho.resultado?.transcricao?.estado === 'indisponivel') {
    const motivo = document.createElement('p');
    motivo.className = 'trabalho-meta';
    motivo.style.gridColumn = '1 / -1';
    motivo.textContent = trabalho.resultado.transcricao.motivo;
    linha.append(motivo);
  }

  if (acao) {
    const botao = document.createElement('button');
    botao.type = 'button';
    botao.className = 'botao-secundario';
    botao.dataset.acao = acao;
    botao.textContent = acao === 'cancelar' ? 'Cancelar' : 'Repetir';
    botao.disabled = trabalho.cancelamentoSolicitado && trabalho.estado === 'executando';
    botao.addEventListener('click', async () => {
      botao.disabled = true;
      try {
        const atualizado = await api(`/api/trabalhos/${trabalho.id}/${acao}`, {
          method: 'POST',
          body: JSON.stringify({ chaveRequisicao: crypto.randomUUID() }),
        });
        if (acao === 'repetir') acompanharTrabalho(atualizado);
        await carregarTrabalhos();
      } catch (erro) {
        $('#erro-trabalhos').textContent = erro.message;
      } finally {
        botao.disabled = false;
      }
    });
    acoes.append(botao);
  }

  if (trabalho.tipo !== 'importar-video') {
    const itens = document.createElement('details');
    itens.dataset.pai = trabalho.id;
    itens.style.gridColumn = '1 / -1';
    const sumario = document.createElement('summary');
    sumario.textContent = 'Ver itens';
    itens.append(sumario);
    const lista = document.createElement('div');
    itens.append(lista);
    let cursor = null;

    const botaoMais = document.createElement('button');
    botaoMais.type = 'button';
    botaoMais.textContent = 'Mais itens';
    botaoMais.className = 'botao-secundario';
    botaoMais.hidden = true;

    const carregarItens = async (mais = false) => {
      try {
        const pagina = await api(`/api/trabalhos/${trabalho.id}/itens?limite=50${mais && cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
        if (!mais) lista.replaceChildren();
        lista.append(...pagina.itens.map(linhaTrabalho));
        cursor = pagina.proximoCursor;
        botaoMais.hidden = !cursor;
      } catch (erro) {
        lista.textContent = erro.message;
      }
    };

    botaoMais.addEventListener('click', () => carregarItens(true));
    itens.append(botaoMais);
    itens.addEventListener('toggle', () => {
      if (itens.open) void carregarItens();
    });
    linha.append(itens);
  }

  return linha;
}

let carregandoTrabalhos = false;
async function carregarTrabalhos() {
  if (carregandoTrabalhos) return;
  carregandoTrabalhos = true;
  try {
    let cursor = null;
    const itens = [];
    do {
      const pagina = await api(`/api/trabalhos?raizes=1&limite=50${cursor ? '&cursor=' + encodeURIComponent(cursor) : ''}`);
      itens.push(...pagina.itens);
      cursor = pagina.proximoCursor;
    } while (cursor && itens.length < estado.limiteTrabalhos);

    $('#mais-trabalhos').hidden = !cursor;
    const lista = $('#lista-trabalhos');
    if (itens.length && !lista.querySelector('.trabalho')) lista.replaceChildren();

    for (const trabalho of itens) {
      const atual = lista.querySelector(`.trabalho[data-id="${trabalho.id}"]`);
      const anterior = estado.trabalhos.get(trabalho.id);
      if (!atual || JSON.stringify(anterior) !== JSON.stringify(trabalho)) {
        const novo = linhaTrabalho(trabalho);
        const aberto = atual?.querySelector('details[open]');
        if (aberto) novo.querySelector('details').open = true;
        if (atual) atual.replaceWith(novo);
        else lista.append(novo);
      }
      estado.trabalhos.set(trabalho.id, trabalho);
    }

    // Ordenação vinda do servidor, sem recriar botões que não mudaram.
    itens.forEach((t, i) => {
      const linha = lista.querySelector(`.trabalho[data-id="${t.id}"]`);
      if (lista.children[i] !== linha) lista.insertBefore(linha, lista.children[i] ?? null);
    });
    if (!itens.length) {
      // Estado vazio é convite para agir, não um aviso. Antes era uma frase
      // solta no canto de uma área em branco.
      const vazio = document.createElement('div');
      vazio.className = 'estado-vazio';
      const titulo = document.createElement('strong');
      titulo.textContent = 'Nenhuma importação na fila';
      const texto = document.createElement('span');
      texto.textContent = 'Cole uma URL acima para importar um vídeo ou uma playlist. O progresso aparece aqui.';
      vazio.append(titulo, texto);
      lista.replaceChildren(vazio);
    }

    for (const id of [...estado.pendentes]) {
      const t = itens.find(t => t.id === id) ?? await api(`/api/trabalhos/${id}`);
      if (['concluido', 'falhou', 'cancelado'].includes(t.estado)) {
        estado.pendentes.delete(id);
        if (id === estado.ultimoTrabalho) mostrarResultadoTrabalho(t);
        // A Biblioteca reflete a importação sem recarregar a página.
        await carregarBiblioteca();
        void arvoreUI.carregar();
      }
    }

    const ativos = itens.filter(t => ['na-fila', 'executando'].includes(t.estado)).length;
    $('#atividade-importacoes').textContent = ativos ? `${ativos} importações ativas nesta página` : 'Fila atualizada';
    $('#erro-trabalhos').textContent = '';
  } catch (erro) {
    $('#erro-trabalhos').textContent = erro.message;
  } finally {
    carregandoTrabalhos = false;
  }
}

/* -------------------------------------------------------- configurações ---- */

const ROTULOS_CONFIG = {
  tema: 'Tema',
  pastaDados: 'Pasta de dados',
  provedorResumo: 'Provedor de resumo',
  modeloResumo: 'Modelo',
  promptResumo: 'Prompt',
};

async function carregarConfiguracoes() {
  const lista = $('#lista-config');
  try {
    const prefs = await api('/api/configuracoes');
    const linhas = [];
    for (const [chave, valor] of Object.entries(prefs)) {
      const dt = document.createElement('dt');
      dt.textContent = ROTULOS_CONFIG[chave] ?? chave;
      const dd = document.createElement('dd');
      const indefinido = valor === null || valor === '';
      dd.textContent = indefinido ? 'Não definido' : String(valor);
      // Valor ausente e valor presente não podem ter o mesmo peso visual:
      // "Não definido" em texto normal parece um dado configurado.
      if (indefinido) dd.classList.add('config-ausente');
      linhas.push(dt, dd);
    }
    lista.replaceChildren(...linhas);
  } catch (erro) {
    const dd = document.createElement('dd');
    dd.textContent = erro.message;
    lista.replaceChildren(dd);
  }
}

/* ---------------------------------------------------------------- boot ---- */

function ligarEventos() {
  $$('.nav-item').forEach((botao) => {
    botao.addEventListener('click', () => mostrarTela(botao.dataset.aba));
  });

  bibliotecaUI.ligar();
  painelUIReal.ligar();
  arvoreUI.ligar();
  adicionarLinkUI.ligar();

  $('#formulario-importacao').addEventListener('submit', importarVideo);
  $('#tipo-importacao').addEventListener('change', () => {
    $('#botao-importar').textContent = $('#tipo-importacao').value === 'importar-playlist'
      ? 'Importar playlist'
      : 'Importar vídeo';
  });

  $('#formulario-lote').addEventListener('submit', async evento => {
    evento.preventDefault();
    const botao = evento.target.querySelector('button');
    botao.disabled = true;
    try {
      const trabalho = await api('/api/ingestao/lote', {
        method: 'POST',
        body: JSON.stringify({
          urls: $('#urls-lote').value.split(/\r?\n/).map(u => u.trim()).filter(Boolean),
          chaveRequisicao: crypto.randomUUID(),
        }),
      });
      acompanharTrabalho(trabalho);
      $('#urls-lote').value = '';
      await carregarTrabalhos();
    } catch (erro) {
      $('#resultado-validacao').dataset.tipo = 'erro';
      $('#resultado-validacao').textContent = erro.message;
    } finally {
      botao.disabled = false;
    }
  });

  $('#mais-trabalhos').addEventListener('click', () => {
    estado.limiteTrabalhos += 50;
    void carregarTrabalhos();
  });

  window.addEventListener('hashchange', () => mostrarTela(telaDaUrl()));

  // ------------------------------------------------- gaveta de navegação --
  //
  // Abaixo de 900 px a barra lateral sai do fluxo e vira gaveta. Antes existia
  // só o CSS que a escondia com `translateX(-100%)` — nenhum controle para
  // reabri-la, então a navegação era inalcançável no mobile.
  const app = $('.aplicativo');
  const menuMobile = $('#abrir-menu-mobile');
  const veu = $('#veu-mobile');

  function abrirGaveta() {
    app.dataset.barraMobile = 'aberta';
    menuMobile.setAttribute('aria-expanded', 'true');
    menuMobile.setAttribute('aria-label', 'Fechar navegação');
    veu.hidden = false;
    // o foco vai para o primeiro item de navegação, não para o topo da página
    $('.nav-item')?.focus();
  }

  function fecharGaveta({ devolverFoco = true } = {}) {
    if (app.dataset.barraMobile !== 'aberta') return;
    delete app.dataset.barraMobile;
    menuMobile.setAttribute('aria-expanded', 'false');
    menuMobile.setAttribute('aria-label', 'Abrir navegação');
    veu.hidden = true;
    if (devolverFoco) menuMobile.focus();
  }

  menuMobile.addEventListener('click', () => {
    if (app.dataset.barraMobile === 'aberta') fecharGaveta();
    else abrirGaveta();
  });
  veu.addEventListener('click', () => fecharGaveta());
  document.addEventListener('keydown', (evento) => {
    if (evento.key === 'Escape' && app.dataset.barraMobile === 'aberta') fecharGaveta();
  });
  // Escolher uma tela fecha a gaveta: o destino já está na frente.
  $$('.nav-item').forEach((botao) => {
    botao.addEventListener('click', () => fecharGaveta({ devolverFoco: false }));
  });
  // Girar o aparelho/redimensionar para o desktop não pode deixar o véu preso.
  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) fecharGaveta({ devolverFoco: false });
  });
}

async function iniciar() {
  ligarEventos();
  mostrarTela(telaDaUrl());

  await verificarMotor();
  await Promise.all([carregarBiblioteca(), carregarConfiguracoes(), carregarDiagnostico()]);

  // Atividade global discreta: o status do motor se atualiza sem recarregar a tela.
  setInterval(verificarMotor, 15000);
  setInterval(() => {
    if (!document.hidden && (estado.tela === 'importacoes' || estado.pendentes.size)) void carregarTrabalhos();
  }, 1000);
}

iniciar();
