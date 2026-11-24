export function lembrarExpansao(painel, nome) {
  const chave = `contextflow.importar-lote.${nome}`;
  try {
    const salvo = localStorage.getItem(chave);
    if (salvo !== null) painel.open = salvo === 'aberto';
  } catch { /* A seção funciona mesmo sem armazenamento. */ }
  painel.addEventListener('toggle', () => {
    try { localStorage.setItem(chave, painel.open ? 'aberto' : 'fechado'); }
    catch { /* A preferência vale enquanto a página estiver aberta. */ }
  });
}

export function enfileirarTexto(api, texto) {
  return api('/api/ingestao/lote', {
    method: 'POST',
    body: JSON.stringify({ texto, chaveRequisicao: crypto.randomUUID() }),
  });
}

export function mensagemLote({ videos, linhasIgnoradas, duplicatas }) {
  const partes = [videos === 1 ? '1 vídeo adicionado à fila.' : `${videos} vídeos adicionados à fila.`];
  if (linhasIgnoradas) partes.push(linhasIgnoradas === 1 ? '1 linha sem vídeo ignorada.' : `${linhasIgnoradas} linhas sem vídeo ignoradas.`);
  if (duplicatas) partes.push(duplicatas === 1 ? '1 link repetido removido.' : `${duplicatas} links repetidos removidos.`);
  return partes.join(' ');
}
