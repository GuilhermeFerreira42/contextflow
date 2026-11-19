/**
 * Interface do ContextFlow — camada de apresentação.
 *
 * Regra: a interface NUNCA é dona dos dados. Ela pede ao motor e reconcilia o que
 * voltou. Nada aqui simula um recurso ausente: quando o motor informa que um módulo
 * está pendente, a tela diz isso em vez de fingir funcionamento.
 */

const estado = {
  tela: 'biblioteca',
  busca: '',
  selecao: new Set(),
  itens: [],
  ultimoStatus: null,
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

function mostrarTela(nome) {
  estado.tela = nome;
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
}

function telaDaUrl() {
  const nome = location.hash.replace('#', '');
  return ['biblioteca', 'leitura', 'importacoes', 'configuracoes'].includes(nome) ? nome : 'biblioteca';
}

/* ---------------------------------------------------------- biblioteca ---- */

function formatarDuracao(segundos) {
  if (!Number.isFinite(segundos)) return '—';
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = Math.floor(segundos % 60);
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;
}

function rotuloEstado(est) {
  return (
    {
      novo: 'Novo',
      importando: 'Importando',
      pronto: 'Pronto',
      parcial: 'Parcial',
      erro: 'Erro',
    }[est] ?? est
  );
}

function linhaDaBiblioteca(video) {
  const tr = document.createElement('tr');
  tr.dataset.id = video.id;
  if (estado.selecao.has(video.id)) tr.classList.add('selecionada');

  const selecao = document.createElement('input');
  selecao.type = 'checkbox';
  selecao.checked = estado.selecao.has(video.id);
  selecao.setAttribute('aria-label', `Selecionar ${video.titulo}`);
  selecao.addEventListener('change', () => {
    // Seleção é por ID (nunca por índice): filtrar/ordenar não desloca a seleção.
    if (selecao.checked) estado.selecao.add(video.id);
    else estado.selecao.delete(video.id);
    tr.classList.toggle('selecionada', selecao.checked);
  });

  const tdSelecao = document.createElement('td');
  tdSelecao.append(selecao);

  const tdVideo = document.createElement('td');
  const celula = document.createElement('div');
  celula.className = 'celula-video';
  if (video.miniaturaUrl) {
    const img = document.createElement('img');
    img.className = 'miniatura';
    img.src = video.miniaturaUrl;
    img.alt = '';
    img.loading = 'lazy';
    celula.append(img);
  }
  const titulo = document.createElement('span');
  titulo.className = 'titulo-video';
  titulo.textContent = video.titulo;
  titulo.title = video.titulo;
  celula.append(titulo);
  tdVideo.append(celula);

  const tvCanal = document.createElement('td');
  tvCanal.textContent = video.canalNome ?? '—';

  const tvDuracao = document.createElement('td');
  tvDuracao.textContent = formatarDuracao(video.duracaoSegundos);

  const tvEstado = document.createElement('td');
  const etiqueta = document.createElement('span');
  etiqueta.className = 'etiqueta';
  etiqueta.dataset.estado = video.estado;
  etiqueta.textContent = rotuloEstado(video.estado);
  tvEstado.append(etiqueta);

  const tvResumo = document.createElement('td');
  tvResumo.textContent = '—';

  tr.append(tdSelecao, tdVideo, tvCanal, tvDuracao, tvEstado, tvResumo);
  return tr;
}

function desenharBiblioteca(pagina) {
  const corpo = $('#corpo-biblioteca');
  const vazio = $('#vazio-biblioteca');
  const tabela = $('.tabela-biblioteca');

  estado.itens = pagina.itens;
  corpo.replaceChildren(...pagina.itens.map(linhaDaBiblioteca));

  const semItens = pagina.itens.length === 0;
  vazio.hidden = !semItens;
  tabela.hidden = semItens;
  $('#contador').textContent = `${pagina.total} ${pagina.total === 1 ? 'vídeo' : 'vídeos'}`;
}

async function carregarBiblioteca() {
  const parametros = new URLSearchParams({ limite: '100' });
  if (estado.busca) parametros.set('busca', estado.busca);
  try {
    const pagina = await api(`/api/biblioteca?${parametros}`);
    desenharBiblioteca(pagina);
  } catch (erro) {
    $('#contador').textContent = 'erro';
    const vazio = $('#vazio-biblioteca');
    vazio.hidden = false;
    $('.tabela-biblioteca').hidden = true;
    vazio.querySelector('.vazio-titulo').textContent = 'Não foi possível carregar a biblioteca';
    vazio.querySelector('.vazio-texto').textContent = erro.message;
  }
}

/* --------------------------------------------------------- importações ---- */

async function validarUrl(evento) {
  evento.preventDefault();
  const campo = $('#url-video');
  const saida = $('#resultado-validacao');
  saida.dataset.tipo = '';
  saida.textContent = 'Validando…';

  try {
    const resultado = await api('/api/ingestao/validar', {
      method: 'POST',
      body: JSON.stringify({ url: campo.value }),
    });
    if (resultado.valido) {
      saida.dataset.tipo = 'ok';
      saida.textContent = `URL válida — vídeo ${resultado.youtubeId} (normalizada: ${resultado.urlNormalizada})`;
    } else {
      saida.dataset.tipo = 'erro';
      saida.textContent = resultado.motivo ?? 'URL inválida';
    }
  } catch (erro) {
    saida.dataset.tipo = 'erro';
    saida.textContent = erro.message;
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
      dd.textContent = valor === null || valor === '' ? 'Não definido' : String(valor);
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

  let temporizador;
  $('#busca').addEventListener('input', (evento) => {
    estado.busca = evento.target.value.trim();
    clearTimeout(temporizador);
    temporizador = setTimeout(carregarBiblioteca, 180);
  });

  $('#formulario-importacao').addEventListener('submit', validarUrl);
  window.addEventListener('hashchange', () => mostrarTela(telaDaUrl()));
}

async function iniciar() {
  ligarEventos();
  mostrarTela(telaDaUrl());

  await verificarMotor();
  await Promise.all([carregarBiblioteca(), carregarConfiguracoes()]);

  // Atividade global discreta: o status do motor se atualiza sem recarregar a tela.
  setInterval(verificarMotor, 15000);
}

iniciar();
