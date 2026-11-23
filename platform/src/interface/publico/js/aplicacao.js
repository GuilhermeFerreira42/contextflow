import { criarBiblioteca } from './biblioteca.js';
import { criarPainel } from './painel-leitura.js';
import { criarArvore } from './arvore-organizacao.js';
import { criarAdicionarLink } from './adicionar-link.js';
import { criarResumosUI } from './resumos.js';
import { criarTrabalhos } from './trabalhos.js';

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
  aoResumir: ids => resumosUI.abrir(ids),
});

async function carregarBiblioteca() {
  await Promise.all([bibliotecaUI.carregar(), bibliotecaUI.carregarOpcoes()]);
}

const painelUIReal = criarPainel({ api, aoResumir: id => resumosUI.abrir([id]), aoHistorico: id => resumosUI.abrirHistorico(id) });
painelUI = painelUIReal;

const arvoreUI = criarArvore({
  api,
  aoFiltrar: (parametro, valor) => {
    if (parametro === 'dataImportacao') {
      // A árvore de datas usa o filtro de intervalo da API (aditivo na F5-UI).
      bibliotecaUI.aplicarIntervaloData(valor.inicio, valor.fim);
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
const resumosUI = criarResumosUI({ api, aoSalvar: () => void carregarConfiguracoes(), aoEnfileirar: async resultado => {
  for (const t of resultado.trabalhos) estado.pendentes.add(t.id);
  painelUI?.fechar();
  $('#resultado-biblioteca').textContent = `${resultado.trabalhos.length} trabalho(s) de resumo; ${resultado.reutilizados.length} já pronto(s); ${resultado.ignorados.length} ignorado(s).`;
  if (resultado.trabalhos.length) { mostrarTela('importacoes'); await carregarTrabalhos(); }
  else await carregarBiblioteca();
} });

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
  if (trabalho.tipo === 'gerar-resumo') {
    saida.dataset.tipo = 'ok'; saida.textContent = 'Resumo concluído. Abra o vídeo na Biblioteca para ler.';
  } else if (resultado?.video) {
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

/**
 * Linha de um trabalho FILHO (item de playlist ou de lote).
 *
 * A tabela de Importações desenha as raízes; itens filhos aparecem dentro do
 * detalhe da raiz, num contêiner estreito. Por isso esta marcação é simples
 * (título + meta + selo) e não replica colunas — a tabela cuidaria mal de um
 * item que não tem data nem ação próprias.
 */
function linhaTrabalho(trabalho) {
  const linha = document.createElement('div');
  // Nome próprio: `.trabalho` agora identifica a <tr> da tabela de Importações.
  linha.className = 'item-filho';
  linha.dataset.id = trabalho.id;

  const titulo = document.createElement('strong');
  titulo.className = 'trabalho-titulo';
  titulo.textContent = trabalho.titulo ?? trabalho.resultado?.video?.titulo
    ?? ({ 'importar-video': 'Vídeo', 'importar-playlist': 'Playlist', 'importar-lote': 'Lote' }[trabalho.tipo]);

  const resumo = document.createElement('p');
  resumo.className = 'trabalho-meta';
  resumo.textContent = `${ESTADOS_TRABALHO[trabalho.estado]} · ${FASES[trabalho.fase] ?? trabalho.fase} · tentativa ${trabalho.tentativas}`;
  if (trabalho.cancelamentoSolicitado && trabalho.estado === 'executando') resumo.textContent += ' · encerrando…';

  const estadoSelo = document.createElement('span');
  estadoSelo.className = 'selo';
  estadoSelo.dataset.estado = trabalho.estado === 'concluido' ? 'pronto'
    : trabalho.estado === 'na-fila' ? 'na-fila'
      : trabalho.estado === 'executando' ? 'processando'
        : trabalho.estado === 'falhou' ? 'erro' : 'pendente';
  estadoSelo.textContent = ESTADOS_TRABALHO[trabalho.estado];

  const caixa = document.createElement('div');
  caixa.append(titulo, resumo);
  linha.append(caixa, estadoSelo);
  return linha;
}

/*
 * Limpeza do histórico de importações.
 *
 * Três ações que parecem uma e não são:
 *  - limpar histórico  = apagar o REGISTRO da tarefa (aqui);
 *  - cancelar          = interromper a tarefa, mantendo o vídeo;
 *  - remover da biblioteca = apagar vídeo + transcrição + resumo (outra tela).
 *
 * A tela diz isso por extenso antes de confirmar, e o servidor recusa limpar
 * trabalho ativo embora a UI já não ofereça essa opção.
 */
const CATEGORIAS_HISTORICO = [
  { id: 'falhou', rotulo: 'Falhas' },
  { id: 'cancelado', rotulo: 'Cancelados' },
  { id: 'concluido', rotulo: 'Concluídos' },
];

function ligarLimpezaHistorico() {
  const painel = $('#painel-limpeza-historico');
  const abrir = $('#abrir-limpeza-historico');
  const confirmar = $('#confirmar-limpeza-historico');
  const aviso = $('#limpeza-aviso');
  const categorias = $('#limpeza-categorias');

  const marcarAviso = (texto, tipo = '') => {
    if (!aviso) return;
    aviso.textContent = texto;
    if (tipo) aviso.dataset.tipo = tipo;
    else delete aviso.dataset.tipo;
  };

  const selecionadas = () => [...categorias.querySelectorAll('input[type="checkbox"]:checked')]
    .map(c => c.value);

  /*
   * Atualiza botão e aviso.
   *
   * `manterAviso` existe porque, depois de limpar, a lista de categorias é
   * recarregada (as quantidades mudam e a seleção sai). Sem essa flag, este
   * caminho sobrescrevia o "N registros removidos" por "Nenhum registro
   * selecionado" — o usuário via a ação como se não tivesse feito nada.
   */
  const atualizarBotao = ({ manterAviso = false } = {}) => {
    const total = selecionadas().reduce((soma, id) => {
      const campo = categorias.querySelector(`input[value="${id}"]`);
      return soma + Number(campo?.dataset.contagem ?? 0);
    }, 0);
    confirmar.disabled = total === 0;
    confirmar.textContent = total === 1
      ? 'Limpar 1 registro'
      : `Limpar ${total} registros`;
    if (manterAviso) return;
    marcarAviso(total === 0
      ? 'Nenhum registro selecionado.'
      : 'Serão removidos só os registros da lista de tarefas. Vídeos, transcrições e resumos continuam na Biblioteca.');
  };

  async function carregarContagens({ manterAviso = false } = {}) {
    categorias.replaceChildren();
    if (!manterAviso) marcarAviso('Contando registros…');
    try {
      const resumo = await api('/api/trabalhos/historico/resumo');
      for (const categoria of CATEGORIAS_HISTORICO) {
        const quantidade = Number(resumo?.[categoria.id] ?? 0);
        const rotulo = document.createElement('label');
        const caixa = document.createElement('input');
        caixa.type = 'checkbox';
        caixa.value = categoria.id;
        caixa.dataset.contagem = String(quantidade);
        // Categoria vazia não pode ser escolhida: um "Limpar 0 registros" não
        // informa nada e parece defeito.
        caixa.disabled = quantidade === 0;
        caixa.addEventListener('change', atualizarBotao);
        const nome = document.createElement('span');
        nome.textContent = categoria.rotulo;
        const contagem = document.createElement('span');
        contagem.className = 'contagem';
        contagem.textContent = String(quantidade);
        rotulo.append(caixa, nome, contagem);
        categorias.append(rotulo);
      }
      if (resumo?.ativo) {
        const nota = document.createElement('p');
        nota.className = 'painel-nota';
        nota.textContent = `${resumo.ativo} tarefa(s) em andamento não entram na limpeza.`;
        categorias.append(nota);
      }
      if (resumo?.repetido) {
        const nota = document.createElement('p');
        nota.className = 'painel-nota';
        nota.textContent = `${resumo.repetido} importação(ões) foram refeitas e têm mais de uma tentativa registrada; limpar o histórico remove todas as entradas dessas tarefas.`;
        categorias.append(nota);
      }
      atualizarBotao({ manterAviso });
    } catch (erro) {
      marcarAviso(`Não foi possível contar o histórico: ${erro.message}`, 'erro');
    }
  }

  abrir?.addEventListener('click', () => {
    const vaiAbrir = painel.hidden;
    painel.hidden = !vaiAbrir;
    abrir.setAttribute('aria-expanded', String(vaiAbrir));
    if (vaiAbrir) {
      void carregarContagens();
      // Foco no primeiro controle: a ação precisa ser confirmada, então o
      // teclado já entra no lugar certo.
      categorias.querySelector('input:not(:disabled)')?.focus();
    }
  });

  $('#cancelar-limpeza-historico')?.addEventListener('click', () => {
    painel.hidden = true;
    abrir.setAttribute('aria-expanded', 'false');
    abrir.focus();
  });

  confirmar?.addEventListener('click', async () => {
    const estados = selecionadas();
    if (!estados.length) return;
    // Confirmação explícita: a operação é destrutiva, ainda que só do registro.
    const total = estados.reduce((soma, id) => soma + Number(
      categorias.querySelector(`input[value="${id}"]`)?.dataset.contagem ?? 0), 0);
    const rotulos = estados.map(id => CATEGORIAS_HISTORICO.find(c => c.id === id)?.rotulo.toLowerCase());
    if (!window.confirm(`Remover ${total} registro(s) do histórico (${rotulos.join(', ')})?\n\nVídeos, transcrições e resumos não serão apagados.`)) return;

    const rotuloOriginal = confirmar.textContent;
    confirmar.disabled = true;
    confirmar.textContent = 'Limpando…';
    try {
      const resultado = await api('/api/trabalhos/historico', {
        method: 'DELETE',
        body: JSON.stringify({ estados }),
      });
      marcarAviso(
        resultado.removidos
          ? `${resultado.removidos} registro(s) removidos do histórico. A Biblioteca não mudou.`
          : 'Nada para remover nessas categorias.',
        'sucesso',
      );
      // `manterAviso: true` preserva a confirmação de sucesso na tela.
      await carregarContagens({ manterAviso: true });
      await carregarTrabalhos();
    } catch (erro) {
      marcarAviso(`Não foi possível limpar: ${erro.message}`, 'erro');
      confirmar.disabled = false;
      confirmar.textContent = rotuloOriginal;
    }
  });
}

/**
 * Faixa de atividade na Biblioteca.
 *
 * Mostra só o que está de fato na fila ou executando. O progresso vem de
 * `contadores` (itens concluídos / total) ou de `progresso` quando o motor
 * calcula — nunca de uma animação nossa. Sem número confiável, a barra é
 * indeterminada e o texto diz "aguardando"/"processando".
 */
function desenharAtividadeBiblioteca(ativos) {
  const faixa = $('#atividade-biblioteca');
  if (!faixa) return;
  if (!ativos.length) {
    faixa.hidden = true;
    faixa.replaceChildren();
    return;
  }
  faixa.hidden = false;
  faixa.replaceChildren();

  const rotulo = document.createElement('span');
  rotulo.className = 'faixa-atividade-rotulo';
  rotulo.textContent = ativos.length === 1
    ? '1 tarefa na biblioteca'
    : `${ativos.length} tarefas na biblioteca`;
  faixa.append(rotulo);

  for (const trabalho of ativos.slice(0, 3)) {
    const item = document.createElement('span');
    item.className = 'faixa-atividade-item';
    item.dataset.estado = trabalho.estado;

    const nome = document.createElement('span');
    nome.className = 'faixa-atividade-nome';
    nome.textContent = trabalho.titulo ?? trabalho.tipo;

    const situacao = document.createElement('span');
    situacao.className = 'faixa-atividade-situacao';
    // "Na fila" e "executando" são estados diferentes e o usuário precisa
    // saber qual é: um trabalho na fila não começou, um executando já está
    // consumindo rede.
    situacao.textContent = trabalho.estado === 'na-fila'
      ? 'aguardando na fila'
      : (FASES[trabalho.fase] ?? 'processando').toLowerCase();

    // Progresso real: `progresso` (0–1) quando existe, senão contadores de
    // itens. Sem nenhum dos dois, indeterminado.
    const c = trabalho.contadores ?? {};
    const totalItens = Number(c.total ?? 0);
    const feitos = Number(c.concluidos ?? 0) + Number(c.falhos ?? 0) + Number(c.cancelados ?? 0);
    const fracao = typeof trabalho.progresso === 'number'
      ? Math.min(1, Math.max(0, trabalho.progresso))
      : totalItens > 0 ? Math.min(1, feitos / totalItens) : null;

    const barra = document.createElement('span');
    barra.className = 'faixa-atividade-barra';
    barra.setAttribute('role', 'progressbar');
    barra.setAttribute('aria-label', `Progresso de ${nome.textContent}`);
    if (fracao === null) {
      barra.dataset.indeterminada = 'sim';
      barra.removeAttribute('aria-valuenow');
    } else {
      barra.setAttribute('aria-valuemin', '0');
      barra.setAttribute('aria-valuemax', '100');
      barra.setAttribute('aria-valuenow', String(Math.round(fracao * 100)));
      const preenchimento = document.createElement('span');
      preenchimento.className = 'faixa-atividade-preenchimento';
      preenchimento.style.width = `${Math.round(fracao * 100)}%`;
      barra.append(preenchimento);
    }
    situacao.textContent += totalItens > 0 ? ` · ${feitos}/${totalItens}` : '';

    item.append(nome, situacao, barra);
    faixa.append(item);
  }

  if (ativos.length > 3) {
    const resto = document.createElement('span');
    resto.className = 'faixa-atividade-resto';
    resto.textContent = `+${ativos.length - 3} em Importações`;
    faixa.append(resto);
  }
}

/*
 * A tabela de Importações vive em `js/trabalhos.js`.
 *
 * `carregarTrabalhos` continua existindo com o mesmo nome porque é chamada em
 * oito pontos deste arquivo (navegação, importação, limpeza, foco da janela).
 * Manter a costura aqui evita espalhar `trabalhosUI.carregar()` por toda parte
 * e deixa um único lugar para reações pós-carregamento.
 */
const trabalhosUI = criarTrabalhos({
  api,
  $,
  // Um trabalho terminou: atualiza Biblioteca, árvore e o cartão de resumo.
  aoConcluir: async (t) => {
    estado.pendentes.delete(t.id);
    if (t.tipo === 'gerar-resumo' && t.videoId) bibliotecaUI.invalidarResumos([t.videoId]);
    if (t.id === estado.ultimoTrabalho) mostrarResultadoTrabalho(t);
    await carregarBiblioteca();
    void arvoreUI.carregar();
  },
  aoMudarAtivos: (ativos) => desenharAtividadeBiblioteca(ativos),
});

async function carregarTrabalhos() {
  await trabalhosUI.carregar();
  // A reconciliação de `estado.pendentes` fica com o módulo; aqui só sobra o
  // aviso de erro limpo, que é específico desta tela.
  const erro = $('#erro-trabalhos');
  if (erro) erro.textContent = '';
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

  bibliotecaUI.ligar();
  painelUIReal.ligar();
  arvoreUI.ligar();
  adicionarLinkUI.ligar();
  resumosUI.ligar();

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

  ligarLimpezaHistorico();

  // A tabela de Importações é montada aqui, uma vez. `montar` cria
  // `<table>`/`<thead>`/`<tbody>` dentro de `#lista-trabalhos`; `ligarControles`
  // conecta pesquisa, filtros, ordenação, "carregar mais" e ações em lote.
  trabalhosUI.montar($('#lista-trabalhos'));
  trabalhosUI.ligarControles();

  window.addEventListener('hashchange', () => mostrarTela(telaDaUrl()));
}

async function iniciar() {
  ligarEventos();
  mostrarTela(telaDaUrl());

  await verificarMotor();
  await Promise.all([carregarBiblioteca(), carregarConfiguracoes(), carregarDiagnostico(), resumosUI.carregarConfiguracao()]);

  // Atividade global discreta: o status do motor se atualiza sem recarregar a tela.
  setInterval(verificarMotor, 15000);
  setInterval(() => {
    // O polling também precisa rodar quando a TABELA tem trabalho ativo —
    // antes só `estado.pendentes` e a tela de Importações contavam. Repetir um
    // trabalho pela tabela não marcava nada em `pendentes`, então o
    // acompanhamento parava e a linha nunca saía de "Na fila".
    const temAtivo = trabalhosUI.possuiAtivo();
    if (!document.hidden && (estado.tela === 'importacoes' || estado.pendentes.size || temAtivo)) {
      void carregarTrabalhos();
    }
  }, 1000);
}

iniciar();
