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
export function criarAdicionarLink({ api, aoEnfileirar, aoAceitar }) {
  const $ = seletor => document.querySelector(seletor);
  const fundo = $('#dialogo-adicionar');
  let focoAnterior = null;
  let colecoes = [];
  /** Timer do fechamento pós-aceite; cancelado se o usuário fechar antes. */
  let timerFechar = null;

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

  /**
   * Estado do botão de envio.
   *
   * `aria-busy` + `data-estado` dão ao leitor de tela e ao CSS a mesma
   * informação, e o rótulo descreve a etapa ("Enviando…" durante a
   * requisição, "Na fila" ao concluir). Antes o botão só ficava desabilitado:
   * quem olhava não sabia se estava processando ou travado.
   */
  function estadoBotao(etapa, rotulo) {
    const botao = $('#confirmar-adicionar');
    if (!botao) return;
    if (etapa) botao.dataset.estado = etapa;
    else delete botao.dataset.estado;
    botao.setAttribute('aria-busy', etapa === 'enviando' ? 'true' : 'false');
    // O texto original vive no HTML; guardar uma vez evita que "Adicionar
    // vídeo" vire "Enviando…" e nunca volte.
    if (!botao.dataset.rotuloOriginal) botao.dataset.rotuloOriginal = botao.textContent.trim();
    botao.textContent = rotulo ?? botao.dataset.rotuloOriginal;
  }

  function abrir() {
    focoAnterior = document.activeElement;
    fundo.hidden = false;
    document.body.style.overflow = 'hidden';
    avisar('', null);
    estadoBotao(null);
    $('#confirmar-adicionar').disabled = false;
    $('#adicionar-url').value = '';
    $('#adicionar-tipo').value = 'importar-video';
    $('#adicionar-url').focus();
  }

  function fechar() {
    clearTimeout(timerFechar);
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
    // Trava de clique repetido: `disabled` já impede, mas o guarda fecha a
    // janela entre o submit e a resposta (duplo Enter, por exemplo).
    if (botao.dataset.estado === 'enviando') return;
    botao.disabled = true;
    estadoBotao('enviando', 'Enviando…');
    avisar('Enviando para a fila…', 'pendente');

    try {
      /*
       * Contrato REAL de `POST /api/ingestao/importar` (conferido no motor):
       * a rota AGUARDA a ingestão e devolve o resultado
       * `{ video: {...}, transcricao: {...}, criado: bool }` — não o trabalho.
       * O tipo pedido (`tipo`) é validado aqui; o motor sempre cria
       * `importar-video` nesta rota, e playlist sai por `/api/ingestao/lote`.
       */
      const resposta = await api('/api/ingestao/importar', {
        method: 'POST',
        body: JSON.stringify({ url, chaveRequisicao: crypto.randomUUID() }),
      });
      // `id` só existe no formato de trabalho (fila assíncrona). Mantido como
      // defesa: se o motor passar a responder 202 com o trabalho, o fluxo de
      // provisória continua funcionando sem nova mudança aqui.
      const id = resposta?.id ?? resposta?.trabalhoId ?? null;
      const video = resposta?.video ?? null;

      /*
       * Fechamento da janela — pelo formato da resposta, não por um timer cego.
       *
       *  - resposta com `video` (ingestão já concluída): não há o que
       *    acompanhar. Fecha imediatamente e o `aoAceitar` leva o usuário à
       *    Biblioteca com a linha já criada.
       *  - resposta 202 com trabalho: a importação está na FILA. A janela
       *    mostra o estado "Na fila" (contrato do E2E do proprietário) e
       *    fecha logo em seguida — quem acompanha é o cartão/linha provisória
       *    da Biblioteca, não uma janela presa. O tempo é curto de propósito:
       *    basta para o estado ser lido, sem prender o usuário.
       *
       * Em nenhum caso há navegação automática para Importações.
       */
      $('#adicionar-url').value = '';
      const colecaoId = $('#adicionar-colecao').value;
      const jaConcluida = Boolean(video?.id);
      if (jaConcluida) fechar();
      else {
        estadoBotao('na-fila', 'Na fila');
        // Fechar depois de pintar o estado. `fechar()` cancela o timer se o
        // usuário fechar antes (Escape/botão) — daí o guarda `fundo.hidden`.
        clearTimeout(timerFechar);
        timerFechar = setTimeout(() => { if (!fundo.hidden) fechar(); }, 2200);
      }
      avisar(
        jaConcluida
          ? 'Importação concluída. O vídeo está na Biblioteca.'
          : 'Importação adicionada à fila. Acompanhe pela linha no topo da Biblioteca.',
        jaConcluida ? 'ok' : 'pendente',
      );

      aoAceitar?.({
        trabalhoId: id,
        tipo,
        url,
        colecaoId: colecaoId || null,
        titulo: video?.titulo ?? resposta?.titulo ?? null,
        videoId: video?.id ?? resposta?.videoId ?? null,
        // Presente quando a ingestão é síncrona (caso atual): a Biblioteca já
        // pode entrar com a linha definitiva em vez de uma provisória.
        video: video ? {
          id: video.id,
          titulo: video.titulo,
          canalNome: video.canalNome ?? null,
          duracaoSegundos: video.duracaoSegundos ?? null,
          miniaturaUrl: video.miniaturaUrl ?? null,
          estado: video.estado ?? 'novo',
        } : null,
      });
    } catch (erro) {
      estadoBotao('erro');
      avisar(`Não foi possível enfileirar: ${erro.message}`, 'erro');
    } finally {
      // Reabilita sempre: um erro de rede não pode deixar a janela travada.
      botao.disabled = false;
      if (botao.dataset.estado !== 'na-fila') estadoBotao(null);
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
