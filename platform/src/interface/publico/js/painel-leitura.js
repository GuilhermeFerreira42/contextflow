/**
 * Painel de leitura sobreposto (estilo cartão).
 *
 * Regras da SPEC:
 *  - Abre SÓ por ação explícita (botão na miniatura). Nunca ao selecionar linha.
 *  - Fechar devolve ao mesmo contexto: o painel não remonta a Biblioteca, não
 *    recarrega lista, não toca em busca/filtros/ordenação/scroll.
 *  - Leitura nas linhas é o principal; isto é complementar.
 */
export function criarPainel({ api }) {
  const $ = seletor => document.querySelector(seletor);
  const painel = $('#painel-leitura');

  let videoAtual = null;
  let focoAnterior = null;
  let pedido = 0;
  // Nomes das coleções para trocar o UUID cru da pílula por "Fundamentos".
  // Carregado uma vez; a lista muda pouco e o painel abre com frequência.
  let nomesColecoes = null;

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
    if (video.miniaturaUrl) {
      const img = document.createElement('img');
      img.alt = `Miniatura de ${video.titulo}`;
      // Mesma regra da lista: URL morta vira preenchimento, não ícone
      // quebrado com o texto alternativo em cima da imagem.
      img.addEventListener('error', () => {
        caixa.replaceChildren();
        caixa.dataset.vazio = 'true';
        caixa.textContent = 'sem miniatura';
      }, { once: true });
      img.src = video.miniaturaUrl;
      caixa.append(img);
    } else {
      caixa.dataset.vazio = 'true';
      caixa.textContent = 'sem miniatura';
    }

    // fatos
    const fatos = $('#painel-fatos');
    fatos.replaceChildren(
      ...fato('Canal', video.canalNome ?? '—'),
      ...fato('Duração', d ?? '—'),
      ...fato('Adicionado', dataLonga(video.criadoEm)),
      ...fato('Atualizado', dataLonga(video.atualizadoEm)),
      ...fato('Estado', ({ novo: 'Novo', importando: 'Importando', pronto: 'Pronto', parcial: 'Parcial', erro: 'Erro' })[video.estado] ?? video.estado),
      ...fato('YouTube', video.youtubeId ?? '—'),
    );

    // coleções
    const colecoes = $('#painel-colecoes');
    colecoes.replaceChildren();
    const ids = video.colecaoIds ?? [];
    if (ids.length) {
      // O UUID não diz nada a quem lê: mostra o título da coleção.
      // Enquanto os nomes não chegam, cai para o id (nunca para o vazio).
      void nomesDeColecoes().then(mapa => {
        if (videoAtual?.id !== video.id) return;
        const pilulas = ids.map(id => {
          const pilula = document.createElement('span');
          pilula.className = 'pilula';
          pilula.textContent = mapa.get(id) ?? id;
          if (!mapa.has(id)) {
            pilula.title = 'Coleção ainda não carregada';
            pilula.classList.add('pilula-ausente');
          }
          return pilula;
        });
        colecoes.replaceChildren(...pilulas);
      });
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

  /** id da coleção → título, com cache simples de sessão. */
  async function nomesDeColecoes() {
    if (nomesColecoes) return nomesColecoes;
    nomesColecoes = new Map();
    try {
      const lista = await api('/api/colecoes');
      const itens = Array.isArray(lista) ? lista : (lista.itens ?? []);
      for (const c of itens) nomesColecoes.set(c.id, c.titulo ?? c.nome ?? 'coleção');
    } catch {
      // Falha ao listar coleções não pode impedir a leitura do vídeo;
      // as pílulas caem para o id e a tela continua utilizável.
      nomesColecoes = new Map();
    }
    return nomesColecoes;
  }

  async function renderizarResumo(video, geracao) {
    const alvo = $('#painel-resumo');
    const estado = $('#painel-resumo-estado');
    alvo.replaceChildren();
    estado.hidden = true;

    try {
      const resumo = await api(`/api/biblioteca/${encodeURIComponent(video.id)}/resumo`);
      if (geracao !== pedido) return;

      if (resumo?.texto) {
        alvo.textContent = resumo.texto;
        mostrarSelo('painel-resumo-estado', 'pronto', 'Pronto');
        return;
      }

      const estadoResumo = resumo?.estado ?? 'pendente';
      const texto = document.createElement('span');
      texto.className = 'aviso';
      texto.textContent = estadoResumo === 'erro'
        ? `A geração do resumo falhou${resumo?.erro ? `: ${resumo.erro}` : '.'}`
        : 'Este vídeo ainda não tem resumo. A geração por IA entra na fase de resumos (F6).';
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

  async function renderizarTranscricao(video, geracao) {
    const lista = $('#segmentos-transcricao');
    const estado = $('#painel-transcricao-estado');
    lista.replaceChildren();
    estado.hidden = true;

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

      const fragmento = document.createDocumentFragment();
      for (const segmento of segmentos) {
        const item = document.createElement('li');
        item.className = 'segmento';

        const marca = document.createElement('a');
        marca.className = 'segmento-tempo';
        const inicioMs = segmento.inicioMs ?? 0;
        marca.href = `${video.url ?? '#'}&t=${Math.floor(inicioMs / 1000)}s`;
        marca.target = '_blank';
        marca.rel = 'noopener noreferrer';
        marca.textContent = tempo(inicioMs / 1000);

        const texto = document.createElement('span');
        texto.className = 'segmento-texto';
        texto.textContent = segmento.texto ?? '';

        item.append(marca, texto);
        fragmento.append(item);
      }
      lista.append(fragmento);
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

  function ligar() {
    $('#fechar-painel').addEventListener('click', fechar);
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
