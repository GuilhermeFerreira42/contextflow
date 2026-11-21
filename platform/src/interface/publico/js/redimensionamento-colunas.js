/** Controles de largura da tabela; preferências continuam sob domínio da Biblioteca. */
export function criarRedimensionamentoColunas({ tabela, limites, obterPreferencia, aoAlterar }) {
  const controles = [];
  let arraste = null;

  function terminar(cancelar = false) {
    if (!arraste) return;
    const atual = arraste;
    arraste = null;
    document.documentElement.classList.remove('redimensionando-colunas');
    if (atual.alvo.hasPointerCapture(atual.ponteiro)) atual.alvo.releasePointerCapture(atual.ponteiro);
    aoAlterar(atual.nome, cancelar || atual.valor === atual.inicio ? atual.anterior : atual.valor, { salvar: true });
  }

  function sincronizar() {
    for (const { cabecalho, controle, nome } of controles) {
      if (cabecalho.offsetParent === null) continue;
      const largura = Math.round(cabecalho.getBoundingClientRect().width);
      controle.setAttribute('aria-valuenow', String(largura));
      controle.setAttribute('aria-valuetext', `${largura} pixels`);
    }
  }

  function ligar() {
    for (const cabecalho of tabela.querySelectorAll('th[data-coluna]')) {
      const nome = cabecalho.dataset.coluna;
      const rotulo = cabecalho.textContent.trim();
      const [minimo, maximo] = limites(nome);
      const controle = document.createElement('span');
      controle.className = 'redimensionar-coluna';
      controle.tabIndex = 0;
      controle.setAttribute('role', 'separator');
      controle.setAttribute('aria-orientation', 'vertical');
      controle.setAttribute('aria-label', `Redimensionar coluna ${rotulo}`);
      controle.setAttribute('aria-valuemin', String(minimo));
      controle.setAttribute('aria-valuemax', String(maximo));
      controle.title = 'Arraste para ajustar. Duplo clique restaura. Setas ajustam pelo teclado.';
      controle.addEventListener('pointerdown', evento => {
        if (evento.button !== 0 || arraste) return;
        evento.preventDefault();
        evento.stopPropagation();
        controle.focus({ preventScroll: true });
        const inicio = cabecalho.getBoundingClientRect().width;
        arraste = { nome, alvo: controle, ponteiro: evento.pointerId, x: evento.clientX,
          inicio, valor: inicio, anterior: obterPreferencia(nome) };
        controle.setPointerCapture(evento.pointerId);
        document.documentElement.classList.add('redimensionando-colunas');
      });
      controle.addEventListener('pointermove', evento => {
        if (arraste?.alvo !== controle || evento.pointerId !== arraste.ponteiro) return;
        arraste.valor = Math.round(Math.min(maximo, Math.max(minimo, arraste.inicio + evento.clientX - arraste.x)));
        aoAlterar(nome, arraste.valor, { salvar: false });
      });
      controle.addEventListener('pointerup', evento => { if (evento.pointerId === arraste?.ponteiro) terminar(); });
      controle.addEventListener('pointercancel', evento => { if (evento.pointerId === arraste?.ponteiro) terminar(true); });
      controle.addEventListener('lostpointercapture', () => { if (arraste?.alvo === controle) terminar(); });
      controle.addEventListener('click', evento => evento.stopPropagation());
      controle.addEventListener('dblclick', evento => {
        evento.preventDefault();
        evento.stopPropagation();
        aoAlterar(nome, null, { salvar: true });
      });
      controle.addEventListener('keydown', evento => {
        if (evento.key === 'Escape' && arraste) { evento.preventDefault(); terminar(true); return; }
        const atual = cabecalho.getBoundingClientRect().width;
        const passo = evento.shiftKey ? 50 : 10;
        const valor = { ArrowLeft: atual - passo, ArrowRight: atual + passo, Home: minimo, End: maximo }[evento.key];
        if (valor === undefined) return;
        evento.preventDefault();
        evento.stopPropagation();
        aoAlterar(nome, Math.round(Math.min(maximo, Math.max(minimo, valor))), { salvar: true });
      });
      cabecalho.append(controle);
      controles.push({ cabecalho, controle, nome });
    }
    sincronizar();
  }
  return { ligar, sincronizar };
}
