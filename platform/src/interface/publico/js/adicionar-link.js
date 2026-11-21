/**
 * Janela "Adicionar link".
 *
 * Encaminha para a MESMA importação que já existe (`/api/ingestao/importar` e
 * `/api/ingestao/lote`): nada de segundo caminho. A validação local só evita
 * ida ao servidor com URL obviamente errada; quem decide é o motor.
 *
 * O resumo por IA fica desabilitado com motivo até a F6 — nada de prometer o
 * que a fase não entrega.
 */
export function criarAdicionarLink({ api, aoEnfileirar }) {
  const $ = seletor => document.querySelector(seletor);
  const fundo = $('#dialogo-adicionar');
  let focoAnterior = null;
  let colecoes = [];

  const PADRAO_VIDEO = /^https?:\/\/(www\.)?(youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/shorts\/)[\w-]{6,}/i;
  const PADRAO_PLAYLIST = /^https?:\/\/(www\.)?youtube\.com\/playlist\?list=[\w-]{6,}/i;

  function detectarTipo(url) {
    if (PADRAO_PLAYLIST.test(url)) return 'importar-playlist';
    if (PADRAO_VIDEO.test(url)) return 'importar-video';
    return null;
  }

  function avisar(texto, tipo) {
    const alvo = $('#adicionar-resultado');
    alvo.textContent = texto;
    if (tipo) alvo.dataset.tipo = tipo;
    else delete alvo.dataset.tipo;
  }

  function abrir() {
    focoAnterior = document.activeElement;
    fundo.hidden = false;
    document.body.style.overflow = 'hidden';
    avisar('', null);
    $('#adicionar-url').value = '';
    $('#adicionar-tipo').value = 'importar-video';
    $('#adicionar-url').focus();
  }

  function fechar() {
    fundo.hidden = true;
    document.body.style.overflow = '';
    if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus({ preventScroll: true });
    focoAnterior = null;
  }

  function preencherColecoes() {
    const select = $('#adicionar-colecao');
    const valor = select.value;
    const inicial = document.createElement('option');
    inicial.value = '';
    inicial.textContent = 'Biblioteca principal (sem coleção)';
    select.replaceChildren(inicial, ...colecoes.map(c => {
      const option = document.createElement('option');
      option.value = c.id;
      option.textContent = c.titulo ?? c.nome ?? 'coleção';
      return option;
    }));
    if ([...select.options].some(o => o.value === valor)) select.value = valor;
  }

  async function atualizarColecoes() {
    try {
      const resposta = await api('/api/colecoes');
      colecoes = resposta.itens ?? [];
      preencherColecoes();
    } catch { /* sem coleções não impede importar */ }
  }

  async function enviar(evento) {
    evento.preventDefault();
    const url = $('#adicionar-url').value.trim();
    const tipo = $('#adicionar-tipo').value;

    if (!url) {
      avisar('Cole a URL de um vídeo ou playlist.', 'erro');
      return;
    }

    const detectado = detectarTipo(url);
    if (!detectado) {
      avisar('A URL não parece ser de um vídeo ou playlist do YouTube.', 'erro');
      return;
    }
    if (detectado !== tipo) {
      avisar(
        detectado === 'importar-playlist'
          ? 'Esta URL é de playlist. Troque o tipo para Playlist.'
          : 'Esta URL é de vídeo. Troque o tipo para Vídeo.',
        'aviso',
      );
      return;
    }

    const botao = $('#confirmar-adicionar');
    botao.disabled = true;
    avisar('Enviando para a fila…', 'pendente');

    try {
      const trabalho = await api('/api/ingestao/importar', {
        method: 'POST',
        body: JSON.stringify({ url, tipo, chaveRequisicao: crypto.randomUUID() }),
      });
      const id = trabalho?.id ?? trabalho?.trabalhoId;
      avisar(
        'Importação adicionada à fila. Acompanhe em Importações.',
        'ok',
      );
      if (id) aoEnfileirar?.(id);

      const colecaoId = $('#adicionar-colecao').value;
      if (colecaoId && trabalho?.videoId) {
        try {
          await api(`/api/colecoes/${encodeURIComponent(colecaoId)}/videos`, {
            method: 'POST',
            body: JSON.stringify({ videoId: trabalho.videoId }),
          });
        } catch { /* o vínculo é secundário; a importação já está em curso */ }
      }

      $('#adicionar-url').value = '';
      // Fechar após sucesso leva o usuário a Importações; deixamos isso explícito.
      setTimeout(() => {
        if (!fundo.hidden) fechar();
      }, 900);
    } catch (erro) {
      avisar(erro.message, 'erro');
    } finally {
      botao.disabled = false;
    }
  }

  function ligar() {
    $('#abrir-adicionar-link').addEventListener('click', async () => {
      await atualizarColecoes();
      abrir();
    });
    $('#fechar-adicionar').addEventListener('click', fechar);
    $('#cancelar-adicionar').addEventListener('click', fechar);
    $('#formulario-adicionar').addEventListener('submit', enviar);
    fundo.addEventListener('click', evento => {
      if (evento.target === fundo) fechar();
    });
    document.addEventListener('keydown', evento => {
      if (evento.key === 'Escape' && !fundo.hidden) {
        evento.stopPropagation();
        fechar();
      }
    });

    // Detectar o tipo pela URL evita erro bobo de escolha manual.
    $('#adicionar-url').addEventListener('input', () => {
      const tipo = detectarTipo($('#adicionar-url').value.trim());
      if (tipo) $('#adicionar-tipo').value = tipo;
    });

    // Espelha a opção no formulário clássico de Importações.
    $('#adicionar-tipo').addEventListener('change', () => {
      const tipo = $('#adicionar-tipo').value;
      const texto = tipo === 'importar-playlist' ? 'Adicionar playlist' : 'Adicionar vídeo';
      $('#confirmar-adicionar').textContent = texto;
    });
  }

  return { ligar, abrir, fechar };
}
