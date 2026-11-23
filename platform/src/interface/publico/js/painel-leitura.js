/**
 * Painel de leitura sobreposto (estilo cartão).
 *
 * Regras da SPEC:
 *  - Abre SÓ por ação explícita (botão na miniatura). Nunca ao selecionar linha.
 *  - Fechar devolve ao mesmo contexto: o painel não remonta a Biblioteca, não
 *    recarrega lista, não toca em busca/filtros/ordenação/scroll.
 *  - Leitura nas linhas é o principal; isto é complementar.
 */
import { lerLeitura, salvarLeitura } from './preferencias-leitura.js';
import { renderizarMarkdown } from './markdown.js';

export function criarPainel({ api, aoResumir, aoHistorico }) {
  const $ = seletor => document.querySelector(seletor);
  const painel = $('#painel-leitura');

  let videoAtual = null;
  let focoAnterior = null;
  let pedido = 0;
  // Segmentos como vieram do banco. A apresentação (tempos, texto corrido)
  // é só uma camada por cima — nunca altera esta lista.
  let segmentosAtuais = [];

  function escapar(texto) {
    return String(texto ?? '');
  }

  function dataLonga(iso) {
    const d = new Date(iso);
    return Number.isNaN(d.getTime())
      ? '—'
      : d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
  }

  function duracao(segundos) {
    if (!Number.isFinite(segundos)) return null;
    const h = Math.floor(segundos / 3600);
    const m = Math.floor((segundos % 3600) / 60);
    const s = Math.floor(segundos % 60);
    return h
      ? `${h}h ${String(m).padStart(2, '0')}min`
      : `${m}min ${String(s).padStart(2, '0')}s`;
  }

  function tempo(segundos) {
    const total = Math.max(0, Math.floor(Number(segundos) || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    const mm = String(m).padStart(2, '0');
    const ss = String(s).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${m}:${ss}`;
  }

  function fato(rotulo, valor) {
    const dt = document.createElement('dt');
    dt.textContent = rotulo;
    const dd = document.createElement('dd');
    if (valor instanceof Node) dd.append(valor);
    else dd.textContent = valor ?? '—';
    return [dt, dd];
  }

  function mostrarSelo(id, estado, rotulo) {
    const alvo = $('#' + id);
    alvo.dataset.estado = estado;
    alvo.textContent = rotulo;
    alvo.hidden = false;
  }

  function renderizarVideo(video) {
    $('#painel-titulo').textContent = video.titulo || 'Sem título';

    const meta = [];
    if (video.canalNome) meta.push(video.canalNome);
    const d = duracao(video.duracaoSegundos);
    if (d) meta.push(d);
    meta.push(`adicionado em ${dataLonga(video.criadoEm)}`);
    $('#painel-meta').textContent = meta.join(' · ');

    // miniatura
    const caixa = $('#painel-miniatura');
    caixa.replaceChildren();
    caixa.classList.remove('painel-miniatura-vazia');
    const semMiniatura = () => {
      caixa.classList.add('painel-miniatura-vazia');
      const vazio = document.createElement('span');
      vazio.className = 'sem-miniatura';
      vazio.textContent = 'sem miniatura';
      caixa.replaceChildren(vazio);
    };
    const img = document.createElement('img');
    img.alt = `Miniatura de ${video.titulo}`; img.referrerPolicy = 'no-referrer';
    img.decoding = 'async';
    const local = `/api/miniaturas/${encodeURIComponent(video.id)}`;
    let etapa = 'cache';
    const atual = () => caixa.contains(img) && videoAtual?.id === video.id && !painel.hidden;
    const fonteOuFallback = () => {
      if (video.miniaturaUrl && video.miniaturaUrl !== local) {
        etapa = 'remota'; img.src = video.miniaturaUrl;
      } else semMiniatura();
    };
    img.addEventListener('error', () => {
      if (!atual() || etapa === 'buscando') return;
      if (etapa !== 'cache') { semMiniatura(); return; }
      etapa = 'buscando';
      void (async () => {
        try {
          const resposta = await api(`${local}/buscar`, { method: 'POST', body: '{}' });
          if (!atual()) return;
          if (resposta?.miniaturaUrl) { etapa = 'recuperada'; img.src = resposta.miniaturaUrl; }
          else fonteOuFallback();
        } catch { if (atual()) fonteOuFallback(); }
      })();
    });
    // Preferir o cache por ID mesmo quando um motor antigo devolve a URL remota.
    caixa.append(img); img.src = local;

    // fatos
    const fatos = $('#painel-fatos');
    fatos.replaceChildren(
      ...fato('Canal', video.canalNome ?? '—'),
      ...fato('Duração', d ?? '—'),
      ...fato('Adicionado', dataLonga(video.criadoEm)),
      ...fato('Atualizado', dataLonga(video.atualizadoEm)),
      ...fato('Estado', video.estado),
      ...fato('YouTube', video.youtubeId ?? '—'),
    );

    // coleções
    const colecoes = $('#painel-colecoes');
    colecoes.replaceChildren();
    const ids = video.colecaoIds ?? [];
    if (ids.length) {
      for (const id of ids) {
        const pilula = document.createElement('span');
        pilula.className = 'pilula';
        pilula.textContent = id;
        colecoes.append(pilula);
      }
    } else {
      const vazio = document.createElement('span');
      vazio.className = 'pilula-vazia';
      vazio.textContent = 'Nenhuma coleção';
      colecoes.append(vazio);
    }

    const link = $('#painel-link');
    if (video.url) {
      link.href = video.url;
      link.hidden = false;
    } else {
      link.hidden = true;
    }
  }

  async function renderizarResumo(video, geracao) {
    const alvo = $('#painel-resumo');
    const estado = $('#painel-resumo-estado');
    alvo.replaceChildren();
    estado.hidden = true;
    $('#painel-copiar-resumo').disabled = true;

    try {
      const resumo = await api(`/api/biblioteca/${encodeURIComponent(video.id)}/resumo`);
      if (geracao !== pedido) return;

      if (resumo?.texto) {
        // Markdown do resumo é conteúdo não confiável (vem da IA). O
        // renderizador só cria nós e texto — nunca interpreta HTML.
        renderizarMarkdown(resumo.texto, alvo);
        alvo.dataset.markdown = 'sim';
        $('#painel-copiar-resumo').disabled = false;
        mostrarSelo('painel-resumo-estado', resumo.desatualizado ? 'parcial' : 'pronto', resumo.desatualizado ? 'Transcrição atualizada desde este resumo' : 'Pronto');
        return;
      }

      const estadoResumo = resumo?.estado ?? 'pendente';
      const texto = document.createElement('span');
      texto.className = 'aviso';
      texto.textContent = estadoResumo === 'erro'
        ? `A geração do resumo falhou${resumo?.erro ? `: ${resumo.erro}` : '.'}`
        : resumo?.estado === 'processando' ? 'Gerando resumo. Acompanhe o trabalho em Importações.' : 'Este vídeo ainda não tem resumo. Use Gerar resumo para conferir a estimativa.';
      alvo.append(texto);
      mostrarSelo('painel-resumo-estado', estadoResumo === 'erro' ? 'erro' : 'pendente', estadoResumo === 'erro' ? 'Erro' : 'Pendente');
    } catch (erro) {
      if (geracao !== pedido) return;
      const texto = document.createElement('span');
      texto.className = 'aviso';
      texto.textContent = `Não foi possível carregar o resumo: ${erro.message}`;
      alvo.append(texto);
      mostrarSelo('painel-resumo-estado', 'erro', 'Falha');
    }
  }

  /**
   * Desenha os segmentos conforme as duas opções de apresentação.
   *
   * "Mostrar tempos" e "Texto corrido" são independentes, então são quatro
   * combinações. Em texto corrido o texto é o mesmo, na mesma ordem, com um
   * espaço entre os trechos; os tempos, quando visíveis, ficam discretos e
   * clicáveis ao lado do trecho a que pertencem. Nada é reescrito, resumido
   * ou pontuado — a leitura contínua é só junção do que já existe.
   */
  function desenharTranscricao() {
    const lista = $('#segmentos-transcricao');
    if (!lista) return;
    const mostrarTempos = $('#mostrar-tempos')?.checked !== false;
    const corrido = $('#texto-corrido')?.checked === true;

    if (!segmentosAtuais.length) return;
    lista.replaceChildren();
    lista.dataset.apresentacao = `${mostrarTempos ? 'tempos' : 'sem-tempos'}${corrido ? ' corrido' : ''}`;

    if (corrido) {
      // Um único bloco em prosa. Os tempos, se pedidos, entram como marcas
      // pequenas antes do trecho — sem quebrar a linha entre eles.
      const item = document.createElement('li');
      item.className = 'segmento segmento-corrido';
      const bloco = document.createElement('p');
      bloco.className = 'texto-corrido';
      for (const segmento of segmentosAtuais) {
        const inicioMs = segmento.inicioMs ?? 0;
        if (mostrarTempos) {
          const marca = document.createElement('a');
          marca.className = 'marca-tempo';
          if (videoAtual?.url) {
            marca.href = `${videoAtual.url}&t=${Math.floor(inicioMs / 1000)}s`;
            marca.target = '_blank';
            marca.rel = 'noopener noreferrer';
          }
          marca.textContent = tempo(inicioMs / 1000);
          bloco.append(marca);
        }
        bloco.append(document.createTextNode((segmento.texto ?? '') + ' '));
      }
      item.append(bloco);
      lista.append(item);
      return;
    }

    const fragmento = document.createDocumentFragment();
    for (const segmento of segmentosAtuais) {
      const item = document.createElement('li');
      item.className = 'segmento' + (mostrarTempos ? '' : ' sem-tempo');

      const inicioMs = segmento.inicioMs ?? 0;
      const texto = document.createElement('span');
      texto.className = 'segmento-texto';
      texto.textContent = segmento.texto ?? '';

      if (mostrarTempos) {
        const marca = document.createElement('a');
        marca.className = 'segmento-tempo';
        marca.href = `${videoAtual?.url ?? '#'}&t=${Math.floor(inicioMs / 1000)}s`;
        marca.target = '_blank';
        marca.rel = 'noopener noreferrer';
        marca.textContent = tempo(inicioMs / 1000);
        item.append(marca, texto);
      } else {
        item.append(texto);
      }
      fragmento.append(item);
    }
    lista.append(fragmento);
  }

  async function renderizarTranscricao(video, geracao) {
    const lista = $('#segmentos-transcricao');
    const estado = $('#painel-transcricao-estado');
    lista.replaceChildren();
    estado.hidden = true;
    segmentosAtuais = [];

    try {
      const transcricao = await api(`/api/biblioteca/${encodeURIComponent(video.id)}/transcricao`);
      if (geracao !== pedido) return;

      const segmentos = transcricao?.segmentos ?? [];
      if (!segmentos.length) {
        const vazio = document.createElement('li');
        vazio.className = 'segmento';
        vazio.style.gridTemplateColumns = '1fr';
        const texto = document.createElement('span');
        texto.className = 'segmento-texto aviso';
        texto.textContent = transcricao?.motivo || 'Sem transcrição disponível para este vídeo.';
        vazio.append(texto);
        lista.append(vazio);
        mostrarSelo('painel-transcricao-estado', 'sem', 'Sem transcrição');
        return;
      }

      segmentosAtuais = segmentos;
      desenharTranscricao();
      const idioma = transcricao.idioma ? ` · ${transcricao.idioma}` : '';
      const origem = transcricao.origem === 'manual' ? 'manual' : 'automática';
      mostrarSelo('painel-transcricao-estado', 'pronto', `${segmentos.length} trechos · ${origem}${idioma}`);
    } catch (erro) {
      if (geracao !== pedido) return;
      const item = document.createElement('li');
      item.className = 'segmento';
      item.style.gridTemplateColumns = '1fr';
      const texto = document.createElement('span');
      texto.className = 'segmento-texto aviso';
      texto.textContent = `Não foi possível carregar a transcrição: ${erro.message}`;
      item.append(texto);
      lista.append(item);
      mostrarSelo('painel-transcricao-estado', 'erro', 'Falha');
    }
  }

  async function abrir(videoId) {
    if (!videoId) return;
    const geracao = ++pedido;
    focoAnterior = document.activeElement;
    // Reaplica a cada abertura: o painel pode ter sido fechado em outra aba ou
    // o controle pode ter voltado ao padrão do HTML.
    aplicarPreferenciasDeLeitura();

    // Esqueleto primeiro: o painel aparece já, mesmo com rede lenta.
    $('#painel-titulo').textContent = 'Carregando…';
    $('#painel-meta').textContent = '';
    $('#painel-resumo').textContent = '';
    $('#segmentos-transcricao').replaceChildren();
    painel.hidden = false;
    document.body.style.overflow = 'hidden';

    try {
      const video = await api(`/api/biblioteca/${encodeURIComponent(videoId)}`);
      if (geracao !== pedido) return;
      videoAtual = video;
      renderizarVideo(video);
      void renderizarResumo(video, geracao);
      void renderizarTranscricao(video, geracao);
      $('#fechar-painel').focus({ preventScroll: true });
    } catch (erro) {
      if (geracao !== pedido) return;
      $('#painel-titulo').textContent = 'Não foi possível abrir';
      $('#painel-meta').textContent = erro.message;
    }
  }

  function fechar() {
    pedido++;
    painel.hidden = true;
    videoAtual = null;
    document.body.style.overflow = '';
    // Devolver o foco ao ponto de origem mantém o contexto de teclado.
    if (focoAnterior && document.contains(focoAnterior)) focoAnterior.focus({ preventScroll: true });
    focoAnterior = null;
  }

  /**
   * Leva as preferências salvas para os dois controles.
   *
   * Roda em `ligar` (cobre recarregar a página) e em `abrir` (cobre uma
   * mudança feita em outra aba, já que `storage` não é observado aqui).
   */
  function aplicarPreferenciasDeLeitura() {
    const leitura = lerLeitura();
    const tempos = $('#mostrar-tempos');
    const corrido = $('#texto-corrido');
    if (tempos) tempos.checked = leitura.mostrarTempos;
    if (corrido) corrido.checked = leitura.textoCorrido;
  }

  function ligar() {
    $('#painel-resumir').addEventListener('click', () => { if (videoAtual) aoResumir?.(videoAtual.id); });
    $('#painel-historico').addEventListener('click', () => { if (videoAtual) aoHistorico?.(videoAtual.id); });
    $('#painel-copiar-resumo').addEventListener('click', async () => {
      try { await navigator.clipboard.writeText($('#painel-resumo').textContent); $('#painel-copia-status').textContent = 'Resumo copiado.'; }
      catch { $('#painel-copia-status').textContent = 'Não foi possível copiar. Selecione o texto para copiar manualmente.'; }
    });
    $('#fechar-painel').addEventListener('click', fechar);
    // Trocar a apresentação não refaz a chamada de rede nem toca no banco:
    // os mesmos segmentos são redesenhados.
    for (const id of ['#mostrar-tempos', '#texto-corrido']) {
      $(id)?.addEventListener('change', () => {
        desenharTranscricao();
        // Gravar a cada troca é barato e garante o estado mesmo se o painel
        // for fechado por Esc, clique no fundo ou recarregamento abrupto.
        salvarLeitura({
          mostrarTempos: $('#mostrar-tempos')?.checked !== false,
          textoCorrido: $('#texto-corrido')?.checked === true,
        });
      });
    }
    aplicarPreferenciasDeLeitura();
    $('#painel-fundo').addEventListener('click', fechar);

    // Esc fecha só o painel — nunca a tela por trás.
    document.addEventListener('keydown', evento => {
      if (evento.key === 'Escape' && !painel.hidden) {
        evento.stopPropagation();
        fechar();
      }
    });

    // Foco preso dentro do painel enquanto aberto.
    painel.addEventListener('keydown', evento => {
      if (evento.key !== 'Tab' || painel.hidden) return;
      const focaveis = [...painel.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')]
        .filter(el => !el.disabled && el.offsetParent !== null);
      if (!focaveis.length) return;
      const primeiro = focaveis[0];
      const ultimo = focaveis.at(-1);
      if (evento.shiftKey && document.activeElement === primeiro) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primeiro.focus();
      }
    });
  }

  return { ligar, abrir, fechar, get aberto() { return !painel.hidden; }, get video() { return videoAtual; } };
}
