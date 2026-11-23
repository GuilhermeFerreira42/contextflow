import { criarBiblioteca } from './biblioteca.js';
import { criarPainel } from './painel-leitura.js';
import { criarArvore } from './arvore-organizacao.js';
import { criarAdicionarLink } from './adicionar-link.js';
import { criarResumosUI } from './resumos.js';
import { criarTrabalhos } from './trabalhos.js';
import { criarAcompanhamento } from './acompanhamento.js';

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

/*
 * Cartão de acompanhamento: criado antes de resumos/fila porque os dois o
 * usam para "não tirar o usuário da tela". `aoMudar` força um ciclo imediato
 * da fila depois de cancelar/repetir — sem isso, o botão só refletiria o novo
 * estado no próximo segundo do polling.
 */
const acompanhamentoUI = criarAcompanhamento({
  api,
  $,
  aoIrParaImportacoes: () => mostrarTela('importacoes'),
  aoMudar: () => carregarTrabalhos(),
});

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
  /**
   * "Localizar vídeo" a partir da lateral.
   *
   * Quando `video` vem nulo e `selecionarListados` está preenchido, é a ação
   * "Selecionar visíveis" da seção Todos os vídeos: marca na Biblioteca os
   * ids listados ali. Os dois caminhos usam a MESMA fonte (a lista já
   * carregada); nenhum cria filtro ou registro paralelo.
   */
  aoAbrirVideo: (video, opcoes) => {
    if (video) bibliotecaUI.abrirVideo(video);
    else if (opcoes?.selecionarListados) bibliotecaUI.selecionarIds(opcoes.selecionarListados);
  },
});

/*
 * Importação pela janela "Adicionar link" (F6-B, parte A).
 *
 * Fluxo, na ordem em que o usuário vê:
 *   1. o backend aceita e a janela fecha;
 *   2. a Biblioteca ganha uma LINHA PROVISÓRIA com "Na fila"/"Importando";
 *   3. a cada ciclo da fila a provisória recebe o que o motor já sabe
 *      (título, miniatura, videoId) — sem segunda fila e sem inventar dados;
 *   4. quando o vídeo existe na API, a provisória sai e a linha real ocupa o
 *      lugar dela (reconciliação por `videoId`, sem duplicar);
 *   5. em falha, a provisória sai e o aviso aponta Importações.
 */
const acompanhamentoProvisorio = new Map(); // trabalhoId -> { chave, colecaoId }

const adicionarLinkUI = criarAdicionarLink({
  api,
  aoAceitar: async ({ trabalhoId, tipo, url, colecaoId, titulo, videoId, video }) => {
    /*
     * Dois desfechos possíveis, e a interface não mente sobre nenhum:
     *
     *  A) a rota respondeu com o vídeo (caso atual) — o vídeo JÁ existe. A
     *     provisória nasce concluída só para dar o feedback imediato de
     *     "entrou", e é removida no mesmo ciclo, com a Biblioteca recarregada.
     *     Isto é o que o pedido chama de feedback imediato: linha na tela,
     *     sem esperar a próxima pintura.
     *  B) a rota respondeu 202 com um trabalho — a provisória acompanha a fila
     *     até o vídeo existir (fluxo de polling em `sincronizarProvisorias`).
     */
    if (video?.id) {
      if (estado.tela !== 'biblioteca') mostrarTela('biblioteca');
      // Coleção: agora é possível vincular, porque o vídeo existe. Corrigido o
      // contrato (`{ videoIds: [...] }`) e a falha passa a ser visível.
      if (colecaoId) {
        try {
          await api(`/api/colecoes/${encodeURIComponent(colecaoId)}/videos`, {
            method: 'POST',
            body: JSON.stringify({ videoIds: [video.id] }),
          });
        } catch (erro) {
          $('#resultado-biblioteca').textContent =
            `Vídeo importado, mas não entrou na coleção: ${erro.message}`;
        }
      }
      $('#resultado-biblioteca').dataset.tipo = 'ok';
      $('#resultado-biblioteca').textContent = `“${video.titulo ?? titulo ?? 'Vídeo'}” importado e adicionado à Biblioteca.`;
      await carregarBiblioteca();
      await carregarTrabalhos();
      void arvoreUI.carregar();
      return;
    }

    if (!trabalhoId) {
      $('#resultado-biblioteca').dataset.tipo = 'erro';
      $('#resultado-biblioteca').textContent = 'O motor aceitou a importação, mas não informou vídeo nem trabalho. Veja Importações.';
      await carregarTrabalhos();
      return;
    }

    estado.pendentes.add(trabalhoId);
    const chave = bibliotecaUI.adicionarProvisoria({
      trabalhoId, tipo, url, titulo, videoId, colecaoId,
      estado: 'na-fila',
    });
    acompanhamentoProvisorio.set(trabalhoId, { chave, colecaoId });
    $('#resultado-biblioteca').dataset.tipo = 'pendente';
    $('#resultado-biblioteca').textContent = 'Importação na fila. A linha provisória está no topo da Biblioteca.';
    if (estado.tela !== 'biblioteca') mostrarTela('biblioteca');
    await carregarTrabalhos();
    await carregarBiblioteca();
  },
});
const resumosUI = criarResumosUI({ api, aoSalvar: () => void carregarConfiguracoes(), aoEnfileirar: async resultado => {
  /*
   * Antes: `mostrarTela('importacoes')` — o usuário era ARRANCADO da leitura
   * só por ter pedido um resumo. Agora:
   *   - permanece onde estava;
   *   - o cartão de acompanhamento mostra fila/execução e permite cancelar;
   *   - a Biblioteca se atualiza sozinha quando cada trabalho termina.
   * Importações continua acessível, como opção (botão no cartão).
   */
  for (const t of resultado.trabalhos) estado.pendentes.add(t.id);
  painelUI?.fechar();
  $('#resultado-biblioteca').textContent = `${resultado.trabalhos.length} trabalho(s) de resumo; ${resultado.reutilizados.length} já pronto(s); ${resultado.ignorados.length} ignorado(s).`;
  if (resultado.trabalhos.length) {
    acompanhamentoUI.acompanhar(resultado.trabalhos.map(t => t.id));
    await carregarTrabalhos();
  } else {
    await carregarBiblioteca();
  }
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
    await reconciliarProvisoria(t);
    // O cartão precisa ver o estado terminal mesmo que o trabalho já tenha
    // saído da primeira página; `absorver` recebe a lista completa dela.
    acompanhamentoUI.absorver(trabalhosUI.itens);
    await carregarBiblioteca();
    void arvoreUI.carregar();
  },
  aoMudarAtivos: (ativos) => {
    desenharAtividadeBiblioteca(ativos);
    acompanhamentoUI.absorver(trabalhosUI.itens);
    void sincronizarProvisorias(ativos);
    // Reconciliação de segurança: se o vídeo já entrou na API por outro
    // caminho (reload, outra aba), a provisória equivalente sai.
    if (bibliotecaUI.reconciliarProvisorias() > 0) void carregarBiblioteca();
  },
});

/**
 * Aplica ao estado da linha provisória o que o trabalho já sabe.
 *
 * Chamada a cada ciclo do polling (milissegundos de diferença, não uma segunda
 * fonte de dados). Quando o trabalho termina, a linha sai e — se deu certo —
 * o vínculo de coleção é feito aqui, porque `videoId` só existe no fim.
 */
async function sincronizarProvisorias(ativos) {
  for (const t of ativos ?? []) {
    const acompanhamento = acompanhamentoProvisorio.get(t.id);
    if (!acompanhamento) continue;
    bibliotecaUI.atualizarProvisoria(acompanhamento.chave, {
      estado: t.estado,
      fase: t.fase ? (FASES[t.fase] ?? t.fase) : null,
      progresso: typeof t.progresso === 'number' ? t.progresso : null,
      titulo: t.titulo ?? t.resultado?.video?.titulo ?? null,
      videoId: t.videoId ?? t.resultado?.video?.id ?? null,
      canalNome: t.resultado?.video?.canalNome ?? null,
      duracaoSegundos: t.resultado?.video?.duracaoSegundos ?? null,
      miniaturaUrl: t.resultado?.video?.miniaturaUrl ?? null,
    });
  }
}

async function reconciliarProvisoria(t) {
  const acompanhamento = acompanhamentoProvisorio.get(t.id);
  if (!acompanhamento) return;
  acompanhamentoProvisorio.delete(t.id);

  const videoId = t.videoId ?? t.resultado?.video?.id ?? null;
  if (t.estado === 'concluido' && videoId) {
    // Deu certo: a linha real passa a existir. O vínculo de coleção é feito
    // agora porque o vídeo só existe agora — e a FALHA é reportada, em vez de
    // engolida (o `catch` vazio anterior escondia um contrato errado).
    if (acompanhamento.colecaoId) {
      try {
        await api(`/api/colecoes/${encodeURIComponent(acompanhamento.colecaoId)}/videos`, {
          method: 'POST',
          // Contrato real: `{ videoIds: string[] }` (a rota valida o array).
          body: JSON.stringify({ videoIds: [videoId] }),
        });
        bibliotecaUI.recarregarOpcoes?.();
        void arvoreUI.carregar();
      } catch (erro) {
        $('#resultado-biblioteca').textContent =
          `Vídeo importado, mas não entrou na coleção: ${erro.message}`;
      }
    }
    // A provisória só sai depois que a Biblioteca recarregar; a deduplicação
    // por `videoId` evita piscar uma linha a menos no intervalo.
    bibliotecaUI.atualizarProvisoria(acompanhamento.chave, { estado: 'concluido', videoId });
    await carregarBiblioteca();
    bibliotecaUI.removerProvisoria(acompanhamento.chave);
  } else {
    // Falhou/cancelou: sai da Biblioteca (o registro fica em Importações) e o
    // usuário é avisado, sem modal e sem tirá-lo da tela.
    bibliotecaUI.removerProvisoria(acompanhamento.chave);
    $('#resultado-biblioteca').textContent = t.estado === 'cancelado'
      ? 'Importação cancelada. O registro continua em Importações.'
      : `A importação falhou: ${t.erro ?? 'veja os detalhes em Importações.'}`;
    await carregarBiblioteca();
  }
}

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

/* --------------------------------------------------- reparo de miniaturas ---- */

/**
 * Reparo em lote das capas (F6-B, D-2).
 *
 * Três decisões que o relatório precisa deixar visíveis:
 *
 *  1. O botão fica desabilitado durante a operação com texto que diz o que
 *     está acontecendo. Não se troca o conteúdo da tela nem se abre outro
 *     painel — o usuário continua onde estava (o app não arranca ninguém do
 *     lugar ao enfileirar trabalho).
 *  2. O resultado é um texto com números reais: recuperadas, falhas e o motivo
 *     agrupado. "Concluído" sem número é o que a spec proíbe.
 *  3. Recarregar a biblioteca é necessário porque a miniatura recuperada muda
 *     a lista — mas só ao final.
 */
function ligarReparoMiniaturas() {
  const botao = $('#miniaturas-reparar');
  const forcar = $('#miniaturas-forcar');
  const saida = $('#miniaturas-reparo-resultado');
  if (!botao || !saida) return;

  botao.addEventListener('click', async () => {
    const rotulo = botao.textContent;
    botao.disabled = true;
    if (forcar) forcar.disabled = true;
    botao.textContent = 'Reparando…';
    saida.dataset.tipo = '';
    saida.textContent = 'Procurando capas faltantes. Isso pode levar alguns segundos.';

    try {
      const resultado = await api('/api/miniaturas/reparar', {
        method: 'POST',
        body: JSON.stringify({ forcar: Boolean(forcar?.checked) }),
      });
      const linha = resumoDoReparo(resultado);
      saida.textContent = linha;
      saida.dataset.tipo = resultado.recuperados > 0 ? 'sucesso' : 'neutro';
      // Motivos agrupados: o usuário vê o padrão ("sem miniatura", "sem
      // candidato") em vez de uma lista de ids que não significam nada para ele.
      if (resultado.falhas?.length) {
        // O `<p>` é `role="status"`: inserir texto antes da lista mantém o
        // anúncio com uma frase completa, em vez de números soltos.
        const resumo = document.createElement('p');
        resumo.className = 'reparo-resumo';
        resumo.textContent = linha;
        saida.textContent = '';
        saida.append(resumo);
        const lista = document.createElement('ul');
        lista.className = 'reparo-motivos';
        for (const [motivo, quantidade] of agruparMotivos(resultado.falhas)) {
          const item = document.createElement('li');
          item.textContent = `${quantidade} ${quantidade === 1 ? 'vídeo' : 'vídeos'}: ${motivo}`;
          lista.append(item);
        }
        saida.append(lista);
      }
      if (resultado.recuperados > 0) {
        await carregarBiblioteca();
        // A miniatura só aparece depois de redesenhar; a Biblioteca é a tela
        // onde o efeito é visível, então é lá que se confere o resultado.
      }
    } catch (erro) {
      saida.dataset.tipo = 'erro';
      saida.textContent = `Não foi possível reparar: ${erro.message}`;
    } finally {
      botao.disabled = false;
      if (forcar) forcar.disabled = false;
      botao.textContent = rotulo;
    }
  });
}

/** Texto do relatório. Separado para poder ser testado sem browser. */
function resumoDoReparo(resultado) {
  const total = Number(resultado?.total ?? 0);
  const recuperados = Number(resultado?.recuperados ?? 0);
  const falhas = Number(resultado?.falhas?.length ?? 0);
  if (total === 0) return 'Nada a reparar: todas as capas já estão carregadas.';
  if (falhas === 0) return `Pronto: ${recuperados} de ${total} ${recuperados === 1 ? 'capa recuperada' : 'capas recuperadas'}.`;
  const alvo = total === 1 ? 'vídeo analisado' : 'vídeos analisados';
  return `${recuperados} ${recuperados === 1 ? 'capa recuperada' : 'capas recuperadas'} de ${total} ${alvo}; ${falhas} sem recuperação.`;
}

/**
 * Motivo técnico → frase para o usuário.
 *
 * "fetch failed" é o texto do Node quando não há rede ou o host não responde;
 * mostrado cru, parece defeito do app. Cada motivo conhecido ganha uma frase
 * que diz o que fazer, e o desconhecido passa direto (não se inventa causa).
 */
const MOTIVOS_LEGIVEIS = [
  [/fetch failed|network|ECONN|ENOTFOUND|ETIMEDOUT/i, 'sem conexão com o servidor de imagens do YouTube'],
  [/^sem miniatura|sem miniatura|não tem miniatura/i, 'o vídeo não tem miniatura disponível na origem'],
  [/URL inválida|inválida/i, 'endereço de capa inválido — a correção depende de importar de novo'],
  [/sem candidatos/i, 'origem sem candidatos conhecidos para a capa'],
];

function motivoLegivel(motivo) {
  const texto = String(motivo ?? '').trim();
  if (!texto) return 'motivo não informado';
  for (const [padrao, frase] of MOTIVOS_LEGIVEIS) if (padrao.test(texto)) return frase;
  return texto;
}

/** Agrupa os motivos para o relatório não virar uma parede de ids. */
function agruparMotivos(falhas) {
  const contagem = new Map();
  for (const falha of falhas ?? []) {
    const motivo = motivoLegivel(falha?.motivo);
    contagem.set(motivo, (contagem.get(motivo) ?? 0) + 1);
  }
  return [...contagem.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
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
  ligarReparoMiniaturas();

  // A tabela de Importações é montada aqui, uma vez. `montar` cria
  // `<table>`/`<thead>`/`<tbody>` dentro de `#lista-trabalhos`; `ligarControles`
  // conecta pesquisa, filtros, ordenação, "carregar mais" e ações em lote.
  trabalhosUI.montar($('#lista-trabalhos'));
  trabalhosUI.ligarControles();
  acompanhamentoUI.ligar();

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
