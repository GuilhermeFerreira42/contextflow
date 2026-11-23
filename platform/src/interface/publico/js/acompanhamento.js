/**
 * Cartão de acompanhamento (F6-B, item 4).
 *
 * Por que existe: gerar resumo (ou importar) obrigava a sair da tela. O fluxo
 * antigo fechava o diálogo e chamava `mostrarTela('importacoes')`, o que
 * interrompia a leitura em andamento. Aqui a regra é a oposta:
 *
 *  - o cartão aparece no canto e mostra fila/execução/progresso;
 *  - a tela NUNCA muda sozinha: ir para Importações é um botão explícito;
 *  - cancelar fica disponível enquanto o trabalho é cancelável;
 *  - ao concluir, a Biblioteca é atualizada por quem chamou (`aoConcluir`),
 *    não por navegação;
 *  - falha mostra a mensagem e oferece "Repetir".
 *
 * Não é uma fila: os trabalhos vêm do mesmo ciclo de `/api/trabalhos` que
 * alimenta a tabela de Importações. Este módulo só desenha e emite intenções
 * (cancelar, repetir, ir para Importações).
 */

const ROTULOS = {
  'na-fila': 'na fila',
  executando: 'processando',
  concluido: 'concluído',
  falhou: 'falhou',
  cancelado: 'cancelado',
};

/*
 * FASES — cópia FIEL da tabela de `aplicacao.js` (fonte: o motor).
 *
 * A primeira versão deste módulo inventou chaves (`buscando-metadados`,
 * `transcrevendo`) que o banco nunca produz: o motor grava `metadados`,
 * `legenda`, `gravacao`, `descobrindo`, `aguardando-itens`, `finalizado`.
 * O efeito era a sub-linha cair no fallback e mostrar `metadados` cru.
 */
const FASES = {
  aguardando: 'Aguardando',
  metadados: 'Buscando metadados',
  legenda: 'Buscando legenda',
  gravacao: 'Salvando',
  descobrindo: 'Lendo playlist',
  'aguardando-itens': 'Processando itens',
  finalizado: 'Finalizado',
  gerando: 'Gerando resumo',
  concluido: 'Finalizado',
};

const TERMINAIS = ['concluido', 'falhou', 'cancelado'];

export function criarAcompanhamento({ api, $, aoIrParaImportacoes, aoMudar }) {
  const estado = {
    trabalhos: new Map(), // id -> snapshot do trabalho exibido
    cancelando: new Set(),
    repetindo: new Set(),
    recolhido: false,
    /** Ids que já existiam quando o cartão abriu: só eles "terminam". */
    vistos: new Set(),
  };

  const cartao = () => $('#cartao-acompanhamento');

  function aberto() {
    return Boolean(cartao() && !cartao().hidden);
  }

  /**
   * Abre o cartão para os trabalhos informados.
   *
   * Aceita o array cru de `/api/trabalhos` e filtra por ids. Abrir com id que
   * ainda não apareceu na página não é bug: o trabalho pode estar numa página
   * seguinte; nesse caso o cartão fica aberto e o primeiro ciclo preenche.
   */
  function acompanhar(ids) {
    const alvo = cartao();
    if (!alvo || !ids?.length) return;
    alvo.hidden = false;
    alvo.dataset.recolhido = String(estado.recolhido);
    for (const id of ids) {
      estado.vistos.add(id);
      if (!estado.trabalhos.has(id)) estado.trabalhos.set(id, { id, estado: 'na-fila' });
    }
    desenhar();
  }

  /** Incorpora o snapshot da fila. Não abre o cartão por conta própria. */
  function absorver(trabalhos) {
    if (!aberto()) return;
    let mudou = false;
    for (const id of [...estado.trabalhos.keys()]) {
      const atual = trabalhos.find((t) => t.id === id);
      if (!atual) continue;
      const anterior = estado.trabalhos.get(id);
      // Comparação por campos que a tela mostra: `JSON.stringify` do objeto
      // inteiro re-renderiza a cada segundo por causa de timestamps.
      const igual = anterior.estado === atual.estado
        && anterior.fase === atual.fase
        && anterior.progresso === atual.progresso
        && anterior.tentativas === atual.tentativas;
      if (!igual) {
        estado.trabalhos.set(id, {
          id,
          titulo: atual.titulo ?? atual.resultado?.video?.titulo ?? anterior.titulo,
          tipo: atual.tipo ?? anterior.tipo,
          estado: atual.estado,
          fase: atual.fase,
          progresso: typeof atual.progresso === 'number' ? atual.progresso : null,
          erro: atual.erro ?? null,
          tentativas: atual.tentativas,
          cancelamentoSolicitado: Boolean(atual.cancelamentoSolicitado),
        });
        mudou = true;
      }
    }
    if (mudou) desenhar();
  }

  function nomeDe(t) {
    if (t.titulo) return t.titulo;
    if (t.tipo === 'gerar-resumo') return 'Resumo';
    if (t.tipo === 'importar-playlist') return 'Playlist';
    if (t.tipo === 'importar-lote') return 'Lote de vídeos';
    return 'Importação';
  }

  function desenhar() {
    const alvo = cartao();
    if (!alvo || alvo.hidden) return;
    alvo.dataset.recolhido = String(estado.recolhido);
    const lista = $('#acompanhamento-lista');
    if (!lista) return;

    const itens = [...estado.trabalhos.values()];
    const todosTerminais = itens.length > 0 && itens.every((t) => TERMINAIS.includes(t.estado));

    lista.replaceChildren(...itens.map((t) => {
      const caixa = document.createElement('div');
      caixa.className = 'acompanhamento-item';
      caixa.dataset.estado = t.estado;
      caixa.dataset.id = t.id;

      const linha = document.createElement('div');
      linha.className = 'acompanhamento-linha';
      const nome = document.createElement('span');
      nome.className = 'acompanhamento-nome';
      nome.textContent = nomeDe(t);
      nome.title = nome.textContent;

      const situacao = document.createElement('span');
      situacao.className = 'acompanhamento-situacao';
      // Estado em TEXTO, sempre. Progresso numérico só quando existe.
      const partes = [ROTULOS[t.estado] ?? t.estado];
      if (t.estado === 'executando' && t.fase) partes.push(FASES[t.fase] ?? t.fase);
      if (t.estado === 'executando' && t.cancelamentoSolicitado) partes.push('encerrando…');
      if (t.progresso !== null && t.progresso !== undefined) partes.push(`${Math.round(t.progresso * 100)}%`);
      if (t.estado === 'falhou' && t.tentativas > 1) partes.push(`tentativa ${t.tentativas}`);
      situacao.textContent = partes.join(' · ');
      linha.append(nome, situacao);

      const barra = document.createElement('span');
      barra.className = 'acompanhamento-barra';
      barra.setAttribute('role', 'progressbar');
      barra.setAttribute('aria-label', `Progresso de ${nome.textContent}`);
      if (t.progresso === null || t.progresso === undefined) {
        if (t.estado === 'concluido') {
          barra.setAttribute('aria-valuenow', '100');
          const cheio = document.createElement('span');
          cheio.style.width = '100%';
          barra.append(cheio);
        } else {
          barra.dataset.indeterminada = 'sim';
        }
      } else {
        barra.setAttribute('aria-valuemin', '0');
        barra.setAttribute('aria-valuemax', '100');
        barra.setAttribute('aria-valuenow', String(Math.round(t.progresso * 100)));
        const preenchimento = document.createElement('span');
        preenchimento.style.width = `${Math.round(t.progresso * 100)}%`;
        barra.append(preenchimento);
      }
      caixa.append(linha, barra);

      if (t.estado === 'falhou' && t.erro) {
        const erro = document.createElement('p');
        erro.className = 'acompanhamento-erro';
        erro.textContent = t.erro;
        caixa.append(erro);
      }

      // Ações por item: cancelar (ativo) ou repetir (falhou/cancelado).
      if (['na-fila', 'executando'].includes(t.estado) || ['falhou', 'cancelado'].includes(t.estado)) {
        const acoes = document.createElement('div');
        acoes.className = 'acompanhamento-acoes';
        if (['na-fila', 'executando'].includes(t.estado)) {
          const cancelar = document.createElement('button');
          cancelar.type = 'button';
          cancelar.className = 'botao-secundario';
          cancelar.textContent = estado.cancelando.has(t.id) ? 'Cancelando…' : 'Cancelar';
          cancelar.disabled = estado.cancelando.has(t.id) || t.cancelamentoSolicitado;
          cancelar.addEventListener('click', () => void cancelarTrabalho(t.id));
          acoes.append(cancelar);
        } else {
          const repetir = document.createElement('button');
          repetir.type = 'button';
          repetir.className = 'botao-secundario';
          repetir.textContent = estado.repetindo.has(t.id) ? 'Repetindo…' : 'Repetir';
          repetir.disabled = estado.repetindo.has(t.id);
          repetir.addEventListener('click', () => void repetirTrabalho(t));
          acoes.append(repetir);
        }
        caixa.append(acoes);
      }
      return caixa;
    }));

    const ir = $('#acompanhamento-ir');
    if (ir) ir.hidden = !itens.length;
    // "Fechar" só quando tudo acabou: fechar no meio esconderia o andamento.
    const fechar = $('#acompanhamento-fechar');
    if (fechar) fechar.hidden = !todosTerminais;
  }

  async function cancelarTrabalho(id) {
    estado.cancelando.add(id);
    desenhar();
    try {
      await api(`/api/trabalhos/${id}/cancelar`, {
        method: 'POST',
        body: JSON.stringify({ chaveRequisicao: crypto.randomUUID() }),
      });
    } catch (erro) {
      const alvo = $('#acompanhamento-lista');
      if (alvo) {
        const aviso = document.createElement('p');
        aviso.className = 'acompanhamento-erro';
        aviso.textContent = `Não foi possível cancelar: ${erro.message}`;
        alvo.append(aviso);
      }
    } finally {
      estado.cancelando.delete(id);
      // O próximo ciclo da fila reflete o estado real; pedir agora evita
      // esperar até o próximo segundo.
      await aoMudar?.();
      desenhar();
    }
  }

  async function repetirTrabalho(t) {
    estado.repetindo.add(t.id);
    desenhar();
    try {
      const novo = await api(`/api/trabalhos/${t.id}/repetir`, {
        method: 'POST',
        body: JSON.stringify({ chaveRequisicao: crypto.randomUUID() }),
      });
      // Repetir pode devolver o MESMO trabalho (retry in-place) ou um novo.
      // O id devolvido é a fonte de verdade.
      const id = novo?.id ?? t.id;
      estado.trabalhos.set(id, { id, tipo: t.tipo, titulo: t.titulo, estado: 'na-fila' });
      if (id !== t.id) estado.vistos.add(id);
      await aoMudar?.();
    } catch (erro) {
      estado.trabalhos.set(t.id, { ...t, erro: erro.message });
    } finally {
      estado.repetindo.delete(t.id);
      desenhar();
    }
  }

  function ligar() {
    $('#acompanhamento-recolher')?.addEventListener('click', (ev) => {
      estado.recolhido = !estado.recolhido;
      ev.currentTarget.setAttribute('aria-expanded', String(!estado.recolhido));
      ev.currentTarget.setAttribute('aria-label', estado.recolhido ? 'Expandir acompanhamento' : 'Minimizar acompanhamento');
      ev.currentTarget.textContent = estado.recolhido ? '▸' : '▾';
      desenhar();
    });
    $('#acompanhamento-ir')?.addEventListener('click', () => aoIrParaImportacoes?.());
    $('#acompanhamento-fechar')?.addEventListener('click', () => {
      const alvo = cartao();
      if (alvo) alvo.hidden = true;
      estado.trabalhos.clear();
      estado.vistos.clear();
    });
  }

  return {
    ligar,
    acompanhar,
    absorver,
    get aberto() { return aberto(); },
    get ids() { return [...estado.trabalhos.keys()]; },
  };
}
