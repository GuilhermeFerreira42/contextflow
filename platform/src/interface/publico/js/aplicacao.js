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
  transcricoes: [],
  leituraAberta: null,
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

  // Cada tela busca o que precisa ao ser aberta: a Biblioteca reflete a última
  // importação sem exigir recarregar a página.
  if (nome === 'biblioteca') void carregarBiblioteca();
  if (nome === 'leitura') void carregarLeitura();
  if (nome === 'importacoes') void carregarDiagnostico();
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

  // A importação chama o yt-dlp e pode levar alguns segundos: o botão precisa
  // dizer que algo está acontecendo, senão o usuário clica de novo.
  botao.disabled = true;
  botao.textContent = 'Importando…';
  saida.dataset.tipo = 'pendente';
  saida.textContent = 'Buscando metadados e legenda no YouTube…';

  try {
    const resultado = await api('/api/ingestao/importar', {
      method: 'POST',
      body: JSON.stringify({ url }),
    });

    const { video, transcricao } = resultado;
    saida.dataset.tipo = 'ok';

    if (transcricao.estado === 'pronta') {
      const rotulo = transcricao.origem === 'manual' ? 'manual' : 'automática';
      saida.textContent =
        `${resultado.criado ? 'Importado' : 'Já está na biblioteca'} — ${video.titulo}` +
        ` · ${transcricao.quantidadeSegmentos} trechos · legenda ${rotulo} (${transcricao.idioma}).`;
    } else {
      saida.dataset.tipo = 'aviso';
      saida.textContent = `${video.titulo} — ${transcricao.motivo ?? 'sem legenda disponível'}`;
    }

    campo.value = '';
    await Promise.all([carregarBiblioteca(), carregarLeitura()]);
  } catch (erro) {
    saida.dataset.tipo = 'erro';
    if (erro.codigo === 'video_duplicado') {
      saida.textContent = 'Este vídeo já está na biblioteca.';
    } else if (erro.codigo === 'ytdlp_ausente' || erro.codigo === 'indisponivel') {
      saida.textContent = `${erro.message} (veja o diagnóstico acima)`;
      await carregarDiagnostico();
    } else {
      saida.textContent = erro.message;
    }
  } finally {
    botao.disabled = false;
    botao.textContent = 'Importar vídeo';
  }
}

/* -------------------------------------------------------------- leitura ---- */

async function carregarLeitura() {
  const lista = $('#lista-transcricoes');
  const vazio = $('#vazio-transcricoes');
  if (!lista) return;

  try {
    const pagina = await api('/api/biblioteca?limite=100');
    const comTranscricao = [];

    for (const video of pagina.itens) {
      try {
        const transcricao = await api(`/api/biblioteca/${video.id}/transcricao`);
        if (transcricao.estado === 'pronta') {
          comTranscricao.push({ video, transcricao });
        }
      } catch {
        // Vídeo sem transcrição não entra na tela de leitura — e isso é normal.
      }
    }

    estado.transcricoes = comTranscricao;
    lista.replaceChildren(...comTranscricao.map(linhaDeLeitura));
    vazio.hidden = comTranscricao.length > 0;
    $('#contador-transcricoes').textContent =
      `${comTranscricao.length} ${comTranscricao.length === 1 ? 'transcrição' : 'transcrições'}`;
  } catch (erro) {
    vazio.hidden = false;
    vazio.querySelector('.vazio-titulo').textContent = 'Não foi possível carregar';
    vazio.querySelector('.vazio-texto').textContent = erro.message;
  }
}

function linhaDeLeitura({ video, transcricao }) {
  const botao = document.createElement('button');
  botao.type = 'button';
  botao.className = 'linha-leitura';
  botao.dataset.id = video.id;

  const titulo = document.createElement('span');
  titulo.className = 'linha-leitura-titulo';
  titulo.textContent = video.titulo;

  const meta = document.createElement('span');
  meta.className = 'linha-leitura-meta';
  const origem = transcricao.origem === 'manual' ? 'legenda manual' : 'legenda automática';
  meta.textContent = `${video.canalNome ?? 'canal desconhecido'} · ${origem} · ${transcricao.segmentos.length} trechos`;

  botao.append(titulo, meta);
  botao.addEventListener('click', () => abrirLeitura(video.id));
  return botao;
}

async function abrirLeitura(id) {
  const entrada = estado.transcricoes.find((t) => t.video.id === id);
  if (!entrada) return;

  estado.leituraAberta = id;
  const { video, transcricao } = entrada;

  $('#leitor-titulo').textContent = video.titulo;
  const origem = transcricao.origem === 'manual' ? 'legenda manual' : 'legenda automática';
  $('#leitor-meta').textContent =
    `${video.canalNome ?? 'canal desconhecido'} · ${origem} · idioma ${transcricao.idioma}` +
    (video.duracaoSegundos ? ` · ${formatarDuracao(video.duracaoSegundos)}` : '');

  const lista = $('#segmentos-transcricao');
  lista.replaceChildren(
    ...transcricao.segmentos.map((segmento) => {
      const item = document.createElement('li');
      item.className = 'segmento';

      const tempo = document.createElement('a');
      tempo.className = 'segmento-tempo';
      tempo.textContent = formatarTempo(segmento.inicioMs);
      tempo.href = `https://www.youtube.com/watch?v=${video.youtubeId}&t=${Math.floor(segmento.inicioMs / 1000)}s`;
      tempo.target = '_blank';
      tempo.rel = 'noopener';

      const texto = document.createElement('span');
      texto.className = 'segmento-texto';
      texto.textContent = segmento.texto;

      item.append(tempo, texto);
      return item;
    }),
  );

  $('#leitor-transcricao').hidden = false;
  $('#leitor-transcricao').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function fecharLeitura() {
  estado.leituraAberta = null;
  $('#leitor-transcricao').hidden = true;
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

  $('#formulario-importacao').addEventListener('submit', importarVideo);
  $('#fechar-leitor').addEventListener('click', fecharLeitura);
  window.addEventListener('hashchange', () => mostrarTela(telaDaUrl()));
}

async function iniciar() {
  ligarEventos();
  mostrarTela(telaDaUrl());

  await verificarMotor();
  await Promise.all([carregarBiblioteca(), carregarConfiguracoes(), carregarDiagnostico()]);

  // Atividade global discreta: o status do motor se atualiza sem recarregar a tela.
  setInterval(verificarMotor, 15000);
}

iniciar();
