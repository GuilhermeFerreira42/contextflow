/**
 * Renderizador de Markdown para os resumos.
 *
 * Por que próprio: o resumo vem de uma IA, ou seja, é conteúdo **não
 * confiável**. Um renderizador que devolve HTML em texto e depois usa
 * `innerHTML` abriria a porta para script. A regra aqui é a inversa:
 *
 *  1. o texto é lido como texto, sempre;
 *  2. só construímos nós com `createElement` e `textContent`;
 *  3. `innerHTML` nunca é usado — nem para conteúdo, nem para "sanitizar".
 *
 * Links passam por uma lista de protocolos. Qualquer outra coisa (`javascript:`,
 * `data:`, `vbscript:`) vira texto comum.
 *
 * Subconjunto suportado — o que aparece de fato nos resumos gerados:
 * títulos ATX, parágrafos, listas (`-`, `*`, `+`, `1.`), ênfase (`**`, `*`,
 * `_`, `~~`), código inline e em bloco, citação, regra horizontal, links e
 * imagens Markdown rebaixadas para link (imagem remota daria requisição
 * imprevisível no painel).
 */

/** Protocolos aceitos em link. `mailto:` e âncoras locais não fazem sentido aqui, mas são inofensivos. */
const PROTOCOLOS = new Set(['http:', 'https:', 'mailto:']);

export function urlSegura(bruta) {
  const texto = String(bruta ?? '').trim();
  if (!texto) return null;
  // Link relativo/simples (`/api/...`) não passa por `new URL` com base: só
  // aceitamos URL absoluta. Isso elimina `javascript:` disfarçado de caminho.
  let url;
  try {
    url = new URL(texto);
  } catch {
    return null;
  }
  if (!PROTOCOLOS.has(url.protocol)) return null;
  return url.href;
}

/** `**forte**` → <strong>; mantém o resto como texto. */
function enfatizar(texto, raiz) {
  // Ordem importa: `**` antes de `*`, senão o par duplo vira dois simples.
  const padrao = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|_[^_\s][^_]*_|`[^`]+`|~~[^~]+~~)/g;
  let ultimo = 0;
  for (const achado of texto.matchAll(padrao)) {
    if (achado.index > ultimo) raiz.append(document.createTextNode(texto.slice(ultimo, achado.index)));
    const trecho = achado[0];
    let no;
    if (trecho.startsWith('**') || trecho.startsWith('__')) {
      no = document.createElement('strong');
      no.textContent = trecho.slice(2, -2);
    } else if (trecho.startsWith('~~')) {
      no = document.createElement('del');
      no.textContent = trecho.slice(2, -2);
    } else if (trecho.startsWith('`')) {
      no = document.createElement('code');
      no.textContent = trecho.slice(1, -1);
    } else {
      no = document.createElement('em');
      no.textContent = trecho.slice(1, -1);
    }
    raiz.append(no);
    ultimo = achado.index + trecho.length;
  }
  if (ultimo < texto.length) raiz.append(document.createTextNode(texto.slice(ultimo)));
}

/** `[rótulo](url)` e `![alt](url)` → <a> seguro, ou o texto cru se a URL não presta. */
function comLinks(texto, raiz) {
  const padrao = /!?\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
  let ultimo = 0;
  for (const achado of texto.matchAll(padrao)) {
    if (achado.index > ultimo) enfatizar(texto.slice(ultimo, achado.index), raiz);
    const [bruto, rotulo, destino] = achado;
    const href = urlSegura(destino);
    if (!href) {
      // Sem link confiável, o trecho continua legível como texto.
      enfatizar(bruto, raiz);
    } else {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = rotulo || destino;
      a.target = '_blank';
      a.rel = 'noopener noreferrer nofollow';
      raiz.append(a);
    }
    ultimo = achado.index + bruto.length;
  }
  if (ultimo < texto.length) enfatizar(texto.slice(ultimo), raiz);
}

/** Uma linha de texto corrido (com links e ênfase). */
function linha(container, texto) {
  if (!texto.trim()) return;
  const p = document.createElement('p');
  comLinks(texto, p);
  container.append(p);
}

/**
 * Renderiza Markdown em `alvo`, substituindo o conteúdo.
 *
 * Devolve o texto puro equivalente — útil para copiar, para medir e para os
 * testes conferirem que nada do conteúdo foi perdido na conversão.
 */
export function renderizarMarkdown(texto, alvo) {
  const fonte = String(texto ?? '').replace(/\r\n?/g, '\n');
  alvo.replaceChildren();
  if (!fonte.trim()) return '';

  const linhas = fonte.split('\n');
  let i = 0;

  const grupos = { listaOrdenada: null, listaNaoOrdenada: null, citacao: null };

  const fecharGrupos = () => {
    grupos.listaOrdenada = null;
    grupos.listaNaoOrdenada = null;
    grupos.citacao = null;
  };

  while (i < linhas.length) {
    const atual = linhas[i];

    // Bloco de código com cerca: ``` ou ~~~, linguagem ignorada.
    const cerca = /^\s*(`{3,}|~{3,})(.*)$/.exec(atual);
    if (cerca) {
      fecharGrupos();
      const marcador = cerca[1][0];
      const corpo = [];
      i++;
      while (i < linhas.length && !new RegExp(`^\\s*${marcador}{3,}\\s*$`).test(linhas[i])) {
        corpo.push(linhas[i]);
        i++;
      }
      i++; // consome a cerca de fechamento (se existir)
      const pre = document.createElement('pre');
      const code = document.createElement('code');
      code.textContent = corpo.join('\n');
      pre.append(code);
      alvo.append(pre);
      continue;
    }

    if (!atual.trim()) {
      fecharGrupos();
      i++;
      continue;
    }

    // Regra horizontal
    if (/^\s*([-*_])\s*\1\s*\1[\s\-*_]*$/.test(atual)) {
      fecharGrupos();
      alvo.append(document.createElement('hr'));
      i++;
      continue;
    }

    // Título ATX. O `#` nunca aparece no texto final: vira tipografia.
    const titulo = /^\s*(#{1,6})\s+(.*?)\s*#*\s*$/.exec(atual);
    if (titulo) {
      fecharGrupos();
      const nivel = Math.min(6, Math.max(2, titulo[1].length + 1)); // h1 do painel já existe
      const h = document.createElement(`h${nivel}`);
      comLinks(titulo[2], h);
      alvo.append(h);
      i++;
      continue;
    }

    // Citação: linhas consecutivas `>` viram um bloco.
    const citacao = /^\s*>\s?(.*)$/.exec(atual);
    if (citacao) {
      grupos.listaOrdenada = null;
      grupos.listaNaoOrdenada = null;
      if (!grupos.citacao) {
        grupos.citacao = document.createElement('blockquote');
        alvo.append(grupos.citacao);
      }
      linha(grupos.citacao, citacao[1]);
      i++;
      continue;
    }

    // Item de lista, ordenada ou não. Listas de níveis diferentes (indentação)
    // são achatadas de propósito: o resumo não usa aninhamento e fingir que usa
    // criaria margens que estouram a célula da tabela.
    const itemNaoOrdenado = /^\s*[-*+]\s+(.*)$/.exec(atual);
    const itemOrdenado = /^\s*\d+[.)]\s+(.*)$/.exec(atual);
    if (itemNaoOrdenado || itemOrdenado) {
      const ordenada = Boolean(itemOrdenado);
      grupos.citacao = null;
      const chave = ordenada ? 'listaOrdenada' : 'listaNaoOrdenada';
      const outra = ordenada ? 'listaNaoOrdenada' : 'listaOrdenada';
      grupos[outra] = null;
      if (!grupos[chave]) {
        grupos[chave] = document.createElement(ordenada ? 'ol' : 'ul');
        alvo.append(grupos[chave]);
      }
      const li = document.createElement('li');
      comLinks((itemOrdenado ?? itemNaoOrdenado)[1], li);
      grupos[chave].append(li);
      i++;
      continue;
    }

    // Parágrafo: consome linhas seguidas até algo estrutural. Quebras simples
    // viram espaço; linha em branco fecha o parágrafo.
    fecharGrupos();
    const partes = [];
    while (i < linhas.length && linhas[i].trim() &&
      !/^\s*(#{1,6}\s|>|`{3,}|~{3,}|[-*+]\s|\d+[.)]\s)/.test(linhas[i])) {
      partes.push(linhas[i].trim());
      i++;
    }
    linha(alvo, partes.join(' '));
  }

  return alvo.textContent;
}
