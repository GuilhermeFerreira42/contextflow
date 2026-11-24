import { enfileirarTexto, lembrarExpansao } from './importar-lote.js';

/** Adiciona à fila persistente existente; o diálogo espera apenas o aceite. */
export function criarAdicionarLink({ api, aoAceitar, aoAceitarLote }) {
  const $ = seletor => document.querySelector(seletor);
  const fundo = $('#dialogo-adicionar');
  let focoAnterior = null;
  let colecoes = [];
  let sessao = 0;
  function atualizarResumo() {
    const opcao = $('#adicionar-resumir');
    opcao.disabled = $('#adicionar-tipo').value !== 'importar-video';
    if (opcao.disabled) opcao.checked = false;
    $('#adicionar-resumir-nota').textContent = opcao.disabled
      ? 'Disponível para um vídeo por vez.'
      : 'A IA é chamada após obter a transcrição e pode gerar cobrança.';
  }

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
    sessao++;
    focoAnterior = document.activeElement;
    fundo.hidden = false;
    document.body.style.overflow = 'hidden';
    avisar('', null);
    estadoBotao(null);
    $('#confirmar-adicionar').disabled = false;
    $('#adicionar-url').value = '';
    $('#adicionar-tipo').value = 'importar-video';
    $('#adicionar-resumir').checked = false;
    atualizarResumo();
    $('#formulario-lote-biblioteca button').disabled = false;
    $('#resultado-lote-biblioteca').textContent = '';
    $('#adicionar-url').focus();
  }

  function fechar() {
    sessao++;
    fundo.hidden = true;
    document.body.style.overflow = '';
    if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus({ preventScroll: true });
    focoAnterior = null;
  }

  function preencherColecoes() {
    const select = $('#adicionar-colecao-destino');
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
    const envio = sessao;
    const colecaoId = $('#adicionar-colecao-destino').value;
    const resumirAoImportar = tipo === 'importar-video' && $('#adicionar-resumir').checked;
    botao.disabled = true;
    estadoBotao('enviando', 'Enviando…');
    avisar('Enviando para a fila…', 'pendente');

    try {
      const resposta = await api('/api/trabalhos', {
        method: 'POST',
        body: JSON.stringify({ tipo, escopo: { url, chaveRequisicao: crypto.randomUUID(), ...(resumirAoImportar ? { resumirAoImportar } : {}) } }),
      });
      const id = resposta?.id;
      if (!id) throw new Error('A fila não confirmou o trabalho.');
      // Mesmo se o usuário já fechou/reabriu, registrar o trabalho aceito,
      // mas nunca limpar ou fechar o novo formulário.
      if (envio === sessao) {
        $('#adicionar-url').value = '';
        fechar();
      }
      aoAceitar?.({
        trabalhoId: id,
        tipo,
        url,
        colecaoId: colecaoId || null,
        titulo: resposta?.titulo ?? null,
        videoId: resposta?.videoId ?? null,
        video: null,
      });
    } catch (erro) {
      if (envio !== sessao) return;
      estadoBotao('erro');
      avisar(`Não foi possível enfileirar: ${erro.message}`, 'erro');
    } finally {
      // Reabilita sempre: um erro de rede não pode deixar a janela travada.
      if (envio === sessao) botao.disabled = false;
      if (envio === sessao && botao.dataset.estado !== 'na-fila') estadoBotao(null);
    }
  }

  async function enviarLote(evento) {
    evento.preventDefault();
    const botao = evento.currentTarget.querySelector('button');
    if (botao.disabled) return;
    const campo = $('#urls-lote-biblioteca');
    const saida = $('#resultado-lote-biblioteca');
    const envio = sessao;
    const texto = campo.value;
    botao.disabled = true;
    saida.dataset.tipo = 'pendente';
    saida.textContent = 'Enviando para a fila…';
    try {
      const trabalho = await enfileirarTexto(api, texto);
      if (sessao === envio) {
        if (campo.value === texto) campo.value = '';
        fechar();
      }
      aoAceitarLote?.(trabalho);
    } catch (erro) {
      if (sessao !== envio) return;
      saida.dataset.tipo = 'erro';
      saida.textContent = erro.message;
    } finally {
      if (sessao === envio) botao.disabled = false;
    }
  }

  function ligar() {
    lembrarExpansao($('#painel-lote-biblioteca'), 'biblioteca');
    $('#formulario-lote-biblioteca').addEventListener('submit', enviarLote);
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
      atualizarResumo();
    });

    // Espelha a opção no formulário clássico de Importações.
    $('#adicionar-tipo').addEventListener('change', () => {
      const tipo = $('#adicionar-tipo').value;
      atualizarResumo();
      const texto = tipo === 'importar-playlist' ? 'Adicionar playlist' : 'Adicionar vídeo';
      $('#confirmar-adicionar').textContent = texto;
    });
  }

  return { ligar, abrir, fechar };
}
