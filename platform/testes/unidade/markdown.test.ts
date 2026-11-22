/**
 * Renderizador de Markdown dos resumos.
 *
 * O teste roda em Node puro: um DOM mínimo implementa só o que o renderizador
 * usa (`createElement`, `textContent`, `append`, `replaceChildren`). Isso é
 * proposital — serve de prova de que o renderizador **não** depende de
 * `innerHTML`, de parser do navegador nem de biblioteca externa. Se um dia
 * alguém trocar por `innerHTML`, este DOM mínimo não terá como sustentar e o
 * teste quebra.
 *
 * A segurança é verificada pelo outro lado: quando entram tags, elas precisam
 * sair como TEXTO.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

class NodoFalso {
  tagName: string;
  filho: NodoFalso[] = [];
  #texto = '';
  atributos: Record<string, string> = {};
  style: Record<string, string> = {};
  constructor(tag: string) { this.tagName = tag.toUpperCase(); }
  append(...nos: (NodoFalso | { texto: string } | string)[]) {
    for (const no of nos) {
      if (no instanceof NodoFalso) { this.filho.push(no); this.#texto += no.textContent; }
      // `append` de string no DOM real vira nó de texto. Espelhar isso é o que
      // pega renderizador que esquece de criar nó — o texto sumiria.
      else if (typeof no === 'string') this.#texto += no;
      else this.#texto += String((no as { texto?: string }).texto ?? '');
    }
  }
  replaceChildren(...nos: (NodoFalso | { texto: string })[]) {
    this.filho = [];
    this.#texto = '';
    this.append(...nos);
  }
  setAttribute(nome: string, valor: string) { this.atributos[nome] = valor; }
  // O renderizador escreve `a.href = ...` (propriedade), como no DOM real.
  // Aqui a propriedade é espelhada no mapa de atributos para o teste conferir.
  set href(valor: string) { this.atributos.href = valor; }
  get href(): string { return this.atributos.href ?? ''; }
  set target(valor: string) { this.atributos.target = valor; }
  set rel(valor: string) { this.atributos.rel = valor; }
  set type(valor: string) { this.atributos.type = valor; }
  set textContent(valor: string) { this.filho = []; this.#texto = valor; }
  get textContent(): string { return this.#texto; }
  querySelectorAll(tag: string): NodoFalso[] {
    const alvo = tag.toUpperCase();
    const achados: NodoFalso[] = [];
    const percorrer = (no: NodoFalso) => {
      for (const filho of no.filho) {
        if (filho.tagName === alvo) achados.push(filho);
        percorrer(filho);
      }
    };
    percorrer(this);
    return achados;
  }
  buscar(tag: string) { return this.querySelectorAll(tag); }
}

// `document` mínimo, só para este teste.
(globalThis as Record<string, unknown>).document = {
  createElement: (tag: string) => new NodoFalso(tag),
  createTextNode: (texto: string) => ({ texto }),
};

const { renderizarMarkdown, urlSegura } =
  await import('../../src/interface/publico/js/markdown.js');

function render(texto: string): { arvore: NodoFalso; puro: string } {
  const alvo = new NodoFalso('div');
  // O renderizador só usa `replaceChildren`/`append`/`textContent`; o tipo
  // declarado reflete isso em vez de exigir o DOM completo.
  const puro = renderizarMarkdown(texto, alvo as unknown as Parameters<typeof renderizarMarkdown>[1]);
  return { arvore: alvo, puro };
}

test('títulos viram h2..h6 com o texto sem a cerquilha', () => {
  // `#` (nível 1) vira h2: o h1 do painel é o título do vídeo, e um segundo
  // h1 no documento quebraria a navegação por leitor de tela.
  const { arvore, puro } = render('# Um\n\n### Três\n\n###### Seis');
  assert.equal(arvore.buscar('h1').length, 0, 'resumo nunca produz h1');
  assert.equal(arvore.buscar('h2')[0]!.textContent, 'Um');
  assert.equal(arvore.buscar('h4')[0]!.textContent, 'Três');
  assert.equal(arvore.buscar('h6')[0]!.textContent, 'Seis');
  assert.ok(!puro.includes('#'));
});

test('listas não ordenadas e ordenadas são elementos distintos', () => {
  const { arvore } = render('- a\n- b\n\n1. um\n2. dois');
  assert.equal(arvore.buscar('ul').length, 1);
  assert.equal(arvore.buscar('ol').length, 1);
  assert.equal(arvore.buscar('li').length, 4);
});

test('ênfase, código inline e riscado', () => {
  const { arvore } = render('**forte** e *leve* e `codigo` e ~~fora~~');
  assert.equal(arvore.buscar('strong')[0]!.textContent, 'forte');
  assert.equal(arvore.buscar('em')[0]!.textContent, 'leve');
  assert.equal(arvore.buscar('code')[0]!.textContent, 'codigo');
  assert.equal(arvore.buscar('del')[0]!.textContent, 'fora');
});

test('bloco de código preserva o conteúdo literal, sem interpretar marcação', () => {
  const { arvore } = render('```\n# não é título\n**não é forte**\n```');
  const pre = arvore.buscar('pre');
  assert.equal(pre.length, 1);
  assert.equal(pre[0]!.textContent, '# não é título\n**não é forte**');
  assert.equal(arvore.buscar('h2').length, 0, 'conteúdo da cerca não pode virar título');
  assert.equal(arvore.buscar('strong').length, 0);
});

test('citação e regra horizontal', () => {
  const { arvore } = render('> citado\n\n---\n\ntexto');
  assert.equal(arvore.buscar('blockquote').length, 1);
  assert.equal(arvore.buscar('blockquote')[0]!.textContent, 'citado');
  assert.equal(arvore.buscar('hr').length, 1);
});

test('links seguros ganham rel e target; texto é preservado', () => {
  const { arvore } = render('[exemplo](https://example.com/pagina)');
  const links = arvore.buscar('a');
  assert.equal(links.length, 1);
  assert.equal(links[0]!.textContent, 'exemplo');
  assert.equal(links[0]!.atributos.href, 'https://example.com/pagina');
  assert.equal(links[0]!.atributos.rel, 'noopener noreferrer nofollow');
  assert.equal(links[0]!.atributos.target, '_blank');
});

test('HTML no resumo é TEXTO: nada de script, imagem ou iframe', () => {
  const { arvore, puro } = render(
    '<script>alert(1)</script><img src=x onerror=alert(1)><b>negrito</b><iframe src=x></iframe>',
  );
  for (const tag of ['script', 'img', 'b', 'iframe', 'a']) {
    assert.equal(arvore.buscar(tag).length, 0, `<${tag}> não pode virar elemento`);
  }
  assert.ok(puro.includes('<script>'), 'a tag precisa aparecer como texto');
  assert.ok(puro.includes('<b>negrito</b>'));
});

test('URL perigosa é descartada e o link vira texto comum', () => {
  for (const destino of ['javascript:alert(1)', 'data:text/html,<script>x</script>', 'vbscript:x', 'JAVASCRIPT:alert(1)']) {
    assert.equal(urlSegura(destino), null, `deveria recusar ${destino}`);
  }
  const { arvore } = render('[clique](javascript:alert(1))');
  assert.equal(arvore.buscar('a').length, 0, 'link javascript: não pode virar âncora');
  assert.ok(arvore.textContent.includes('clique'), 'o rótulo continua legível');
});

test('protocolos aceitos', () => {
  assert.equal(urlSegura('https://example.com'), 'https://example.com/');
  assert.equal(urlSegura('http://example.com/a'), 'http://example.com/a');
  assert.match(urlSegura('mailto:alguem@example.com') ?? '', /^mailto:/);
  assert.equal(urlSegura(''), null);
  assert.equal(urlSegura(null), null);
  assert.equal(urlSegura('/api/local'), null, 'caminho relativo não é link de resumo');
});

test('texto sem marcação continua íntegro e na ordem', () => {
  const original = 'Primeira frase. Segunda frase com acentuação: ação, coração.';
  const { puro } = render(original);
  assert.equal(puro.replace(/\s+/g, ' ').trim(), original);
});

test('quebras de linha simples viram espaço no mesmo parágrafo', () => {
  const { arvore } = render('primeira linha\nsegunda linha');
  assert.equal(arvore.buscar('p').length, 1);
  assert.equal(arvore.textContent.includes('primeira linha segunda linha'), true);
});

test('linha em branco separa parágrafos', () => {
  const { arvore } = render('um\n\ndois');
  assert.equal(arvore.buscar('p').length, 2);
});

test('entrada vazia ou nula não quebra', () => {
  for (const entrada of ['', '   ', '\n\n', null, undefined]) {
    const { arvore, puro } = render(entrada as string);
    assert.equal(arvore.filho.length, 0);
    assert.equal(puro, '');
  }
});

test('resumo grande não perde conteúdo nem explode em nós', () => {
  const paragrafos = Array.from({ length: 200 }, (_, i) => `Parágrafo ${i} com **ênfase** e texto.`);
  const { arvore, puro } = render(paragrafos.join('\n\n'));
  assert.equal(arvore.buscar('p').length, 200);
  assert.equal(arvore.buscar('strong').length, 200);
  for (const i of [0, 99, 199]) assert.ok(puro.includes(`Parágrafo ${i} `));
});
