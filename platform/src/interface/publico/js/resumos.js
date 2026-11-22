/** Configuração, estimativa e histórico; a fonte de verdade permanece no motor. */
export function criarResumosUI({ api, aoEnfileirar, aoSalvar }) {
  const $ = seletor => document.querySelector(seletor);
  const dialogo = $('#dialogo-resumos');
  const historico = $('#dialogo-historico-resumos');
  let ids = [], estimativa = null, pedido = 0, provedores = [];
  const campos = { provedor: 'ia-provedor', modelo: 'ia-modelo', baseUrl: 'ia-endpoint', prompt: 'ia-prompt',
    versaoPrompt: 'ia-versao', contexto: 'ia-contexto', maxSaida: 'ia-saida', concorrencia: 'ia-concorrencia',
    timeoutSegundos: 'ia-timeout', precoEntrada: 'ia-preco-entrada', precoSaida: 'ia-preco-saida' };
  const avisoConfig = texto => { $('#ia-resultado').textContent = texto; };

  async function carregarConfiguracao() {
    try {
      const [lista, atual] = await Promise.all([api('/api/resumos/provedores'), api('/api/resumos/configuracao')]);
      provedores = lista.provedores;
      const opcoes = provedores.map(p => { const o = document.createElement('option'); o.value = p.id; o.textContent = p.nome; return o; });
      $('#ia-provedor').replaceChildren(...opcoes);
      const c = atual.configuracao ?? { provedor: 'openai', modelo: '', baseUrl: provedores[0].baseUrl, prompt: atual.promptPadrao,
        versaoPrompt: 'v1', contexto: 16384, maxSaida: 1024, concorrencia: 2, timeoutSegundos: 90, precoEntrada: '', precoSaida: '' };
      for (const [nome, id] of Object.entries(campos)) $('#' + id).value = c[nome] ?? '';
      $('#ia-chave').value = '';
      $('#ia-remover-chave').checked = false;
      $('#ia-endpoint').readOnly = ['openai', 'anthropic'].includes(c.provedor);
      $('#ia-protecao').textContent = `${atual.temChave ? 'Chave salva para este provedor e endpoint.' : 'Nenhuma chave salva para este endpoint.'} Proteção: ${atual.protecao}.`;
    } catch (erro) { avisoConfig(erro.message); }
  }

  async function abrir(videoIds) {
    ids = [...videoIds]; estimativa = null;
    const atual = ++pedido;
    $('#resumos-custo').textContent = 'Calculando estimativa…';
    $('#resumos-itens').replaceChildren(); $('#resumos-aviso').textContent = ''; $('#resumos-erro').textContent = '';
    $('#resumos-confirmar').disabled = true;
    if (!dialogo.open) dialogo.showModal();
    try {
      const resposta = await api('/api/resumos/estimar', { method: 'POST', body: JSON.stringify({ videoIds: ids }) });
      if (atual !== pedido || !dialogo.open) return;
      estimativa = resposta;
      $('#resumos-custo').textContent = resposta.totalCusto === null
        ? 'Custo não calculado: os preços do modelo não foram informados.'
        : `Custo estimado conservador: ${new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD', minimumFractionDigits: 4, maximumFractionDigits: 6 }).format(resposta.totalCusto)}.`;
      $('#resumos-aviso').textContent = resposta.aviso;
      $('#resumos-itens').replaceChildren(...resposta.itens.map(i => {
        const li = document.createElement('li');
        li.textContent = `${i.titulo}: ${!i.elegivel ? i.motivo : i.existente ? 'resumo já pronto, sem nova chamada.'
          : `${i.partes} parte(s), até ${i.chamadasMaximas} chamadas incluindo tentativas; entrada estimada ${i.tokensEntrada} tokens.`}`;
        return li;
      }));
      $('#resumos-confirmar').disabled = !resposta.itens.some(i => i.elegivel);
    } catch (erro) { if (atual === pedido) $('#resumos-erro').textContent = erro.message; }
  }

  async function abrirHistorico(videoId) {
    $('#historico-resumos-conteudo').textContent = 'Carregando histórico…';
    if (!historico.open) historico.showModal();
    try {
      const dados = await api(`/api/resumos/${encodeURIComponent(videoId)}`);
      const alvo = $('#historico-resumos-conteudo'); alvo.replaceChildren();
      if (!dados.itens.length) { alvo.textContent = 'Este vídeo ainda não tem resumos.'; return; }
      for (const r of dados.itens) {
        const d = document.createElement('details'), s = document.createElement('summary'), p = document.createElement('p');
        const versao = (r.versaoPrompt ?? '').split(':')[0];
        s.textContent = `${r.provedor} · ${r.modelo} · ${versao} · ${r.estado}${r.desatualizado ? ' · transcrição atualizada' : ''}`;
        p.className = 'historico-resumo-texto'; p.textContent = r.texto ?? r.erro ?? 'Ainda em processamento.';
        d.append(s, p); alvo.append(d);
      }
      const uso = document.createElement('p'); uso.className = 'painel-nota';
      const chamadas = dados.execucoes.reduce((n, e) => n + (e.uso?.chamadas ?? 0), 0);
      uso.textContent = `${chamadas} chamada(s) com uso registrado pelo motor. Tentativas sem resposta podem não informar consumo.`;
      alvo.append(uso);
    } catch (erro) { $('#historico-resumos-conteudo').textContent = erro.message; }
  }

  async function salvarConfiguracao() {
      if (!$('#formulario-ia').reportValidity()) return false;
      $('#ia-salvar').disabled = true; $('#ia-testar').disabled = true; avisoConfig('Salvando…');
      const dados = Object.fromEntries(Object.entries(campos).map(([nome, id]) => [nome, $('#' + id).value]));
      dados.apiKey = $('#ia-chave').value; dados.removerChave = $('#ia-remover-chave').checked;
      try {
        await api('/api/resumos/configuracao', { method: 'POST', body: JSON.stringify(dados) });
        await carregarConfiguracao(); avisoConfig('Configuração de IA salva.'); aoSalvar?.(); return true;
      } catch (erro) { avisoConfig(erro.message); return false; }
      finally { $('#ia-chave').value = ''; $('#ia-salvar').disabled = false; $('#ia-testar').disabled = false; }
  }

  function ligar() {
    $('#formulario-ia').addEventListener('submit', async e => {
      e.preventDefault(); await salvarConfiguracao();
    });
    $('#ia-provedor').addEventListener('change', () => {
      const p = provedores.find(p => p.id === $('#ia-provedor').value);
      $('#ia-endpoint').value = p?.baseUrl ?? ''; $('#ia-endpoint').readOnly = ['openai', 'anthropic'].includes(p?.id);
      $('#ia-chave').value = ''; $('#ia-concorrencia').value = p?.id === 'ollama' ? '1' : '2';
      $('#ia-modelos').replaceChildren();
      $('#ia-protecao').textContent = 'Salve para verificar a chave vinculada a este destino.';
    });
    $('#ia-endpoint').addEventListener('change', () => { $('#ia-chave').value = ''; $('#ia-modelos').replaceChildren(); });
    $('#ia-testar').addEventListener('click', async () => {
      if (!await salvarConfiguracao()) return;
      $('#ia-testar').disabled = true; avisoConfig('Testando a configuração salva…');
      try {
        const resultado = await api('/api/resumos/testar', { method: 'POST', body: '{}' });
        $('#ia-modelos').replaceChildren(...resultado.modelos.map(modelo => { const o = document.createElement('option'); o.value = modelo; return o; }));
        avisoConfig(resultado.mensagem);
      }
      catch (erro) { avisoConfig(erro.message); }
      finally { $('#ia-testar').disabled = false; }
    });
    $('#resumos-fechar').addEventListener('click', () => dialogo.close());
    dialogo.addEventListener('close', () => { pedido++; estimativa = null; });
    $('#resumos-confirmar').addEventListener('click', async () => {
      if (!estimativa) return;
      $('#resumos-confirmar').disabled = true;
      try {
        const resultado = await api('/api/resumos/gerar', { method: 'POST', body: JSON.stringify({ videoIds: ids,
          assinaturaEstimativa: estimativa.assinaturaEstimativa, confirmarCusto: true, chaveRequisicao: crypto.randomUUID() }) });
        dialogo.close(); await aoEnfileirar(resultado);
      } catch (erro) { $('#resumos-erro').textContent = erro.message; $('#resumos-confirmar').disabled = false; }
    });
    $('#historico-resumos-fechar').addEventListener('click', () => historico.close());
  }
  return { ligar, abrir, abrirHistorico, carregarConfiguracao };
}
