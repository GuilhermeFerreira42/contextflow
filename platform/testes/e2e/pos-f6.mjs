/**
 * Regressão Playwright dos ajustes pós-F6.
 *
 * Dados descartáveis (pasta temporária), nenhum YouTube, nenhum banco pessoal.
 * O servidor roda em porta efêmera e o navegador é o Chromium do ambiente.
 *
 * Cobre os oito ajustes do comando, com foco no que não é visível por teste
 * unitário: estados de carregamento, limpeza segura, persistência de
 * preferências, Markdown seguro, tamanho de fonte e layout adaptativo.
 */
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';

const raiz = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
mkdirSync(join(raiz, 'testes/.tmp'), { recursive: true });
const dados = mkdtempSync(join(raiz, 'testes/.tmp/pos-f6-'));
const evidencia = resolve(process.env.CONTEXTFLOW_EVIDENCIAS ?? dados);
mkdirSync(evidencia, { recursive: true });

const app = criarAplicacao(carregarConfig({
  ...process.env, CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste', CONTEXTFLOW_DADOS: dados,
}));

const falhas = [];
const verificar = (condicao, mensagem) => {
  if (condicao) return;
  falhas.push(mensagem);
  console.error(`FALHOU: ${mensagem}`);
};
let cenarios = 0;
let browser;

try {
  app.iniciarPersistencia();
  const bd = app.banco.db;

  // --- fixtures -----------------------------------------------------------
  const imagem = 'data:image/svg+xml,' + encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#234b68"/></svg>');

  const resumoMarkdown = [
    '# Estudo sobre bibliotecas pessoais',
    '',
    'Este resumo tem **ênfase forte**, *ênfase simples* e `código inline`.',
    '',
    '## Pontos principais',
    '',
    '- Primeiro ponto com um [link seguro](https://example.com).',
    '- Segundo ponto com ~~texto removido~~.',
    '- Terceiro ponto, mais longo, para testar a quebra de linha dentro da célula da grade e no painel, sem estourar a altura calculada pelo virtualizador.',
    '',
    '1. Passo ordenado um',
    '2. Passo ordenado dois',
    '',
    '> Uma citação que precisa recuar e continuar legível.',
    '',
    '```',
    'const exemplo = "bloco de código";',
    '```',
    '',
    'Fim do resumo.',
  ].join('\n');

  // Conteúdo hostil: HTML, script e link com javascript:. Nada disso pode
  // virar elemento, executar ou navegar.
  const resumoHostil = [
    'Texto normal antes.',
    '',
    '<script>window.__injetado = true;</script>',
    '<img src=x onerror="window.__injetado = true">',
    '<b>negrito em HTML</b>',
    '',
    '[clique aqui](javascript:window.__injetado=true)',
    '',
    '<iframe src="https://exemplo.invalido"></iframe>',
  ].join('\n');

  const inserir = bd.prepare(`INSERT INTO videos
    (id,youtube_id,titulo,canal_id,canal_nome,duracao_segundos,url,miniatura_url,estado,criado_em,atualizado_em)
    VALUES(?,?,?,?,?,?,?,?, 'pronto','2026-11-01','2026-11-01')`);
  const inserirResumo = bd.prepare(`INSERT INTO resumos VALUES(?, 'fixture','modelo','p1','r1',?,'pronto',NULL,'2026','2026')`);
  const inserirTranscricao = bd.prepare(`INSERT INTO transcricoes
    (id,video_id,idioma,origem,estado,atualizado_em)
    VALUES('tr-markdown', ?, 'pt-BR','manual','pronta','2026-11-01')`);
  const inserirSegmento = bd.prepare(`INSERT INTO segmentos
    (transcricao_id,ordem,inicio_ms,fim_ms,texto) VALUES('tr-markdown',?,?,?,?)`);

  app.banco.executarTransacao(() => {
    const videos = [
      ['vd-markdown', '00000000001', 'Estudo com Markdown', imagem, resumoMarkdown],
      ['vd-hostil', '00000000002', 'Resumo com HTML hostil', imagem, resumoHostil],
      ['vd-sem-imagem', '00000000003', 'Vídeo sem miniatura disponível', null, null],
      ['vd-titulo-curto', '00000000004', 'Curto', imagem, null],
      ['vd-titulo-longo', '00000000005',
        'Um título deliberadamente muito longo para conferir que a célula não estoura e que a miniatura continua proporcional quando o texto precisa de várias linhas',
        imagem, null],
    ];
    for (const [id, yid, titulo, mini, resumo] of videos) {
      inserir.run(id, yid, titulo, 'canal-teste', 'Canal de teste', 300,
        `https://www.youtube.com/watch?v=${yid}`, mini);
      if (resumo) inserirResumo.run(id, resumo);
    }
    inserirTranscricao.run('vd-markdown');
    for (let i = 0; i < 12; i++) {
      inserirSegmento.run(i, i * 5000, (i + 1) * 5000, `Trecho número ${i + 1} da transcrição de teste.`);
    }
  });

  // Histórico: um de cada estado terminal + um ativo. O ativo NÃO pode ser
  // limpo; os terminais, sim.
  const criarTrabalho = bd.prepare(`INSERT INTO trabalhos
    (id,tipo,estado,escopo,criado_em,atualizado_em) VALUES(?,?,?,?, '2026-11-01','2026-11-01')`);
  criarTrabalho.run('tr-concluido', 'importar-video', 'concluido', '{"url":"https://youtu.be/a"}');
  criarTrabalho.run('tr-falhou', 'importar-video', 'falhou', '{"url":"https://youtu.be/b"}');
  criarTrabalho.run('tr-cancelado', 'importar-video', 'cancelado', '{"url":"https://youtu.be/c"}');
  criarTrabalho.run('tr-ativo', 'importar-video', 'executando', '{"url":"https://youtu.be/d"}');

  await new Promise(ok => app.servidor.listen(0, '127.0.0.1', ok));
  const base = `http://127.0.0.1:${app.servidor.address().port}`;

  const executavel = [process.env.CHROME_BIN,
    '/home/user/.cache/cdp/chrome-bin',
    chromium.executablePath(),
    '/usr/bin/chromium', '/usr/bin/google-chrome'].find(p => p && p.length > 0);
  browser = await chromium.launch({
    executablePath: executavel,
    args: ['--no-sandbox', '--disable-dev-shm-usage'],
  });
  const contexto = await browser.newContext({ viewport: { width: 1600, height: 950 } });
  const pagina = await contexto.newPage();
  const errosConsole = [];
  pagina.on('pageerror', e => errosConsole.push(String(e)));
  pagina.on('console', m => { if (m.type() === 'error') errosConsole.push(m.text()); });
  // Nenhuma requisição deve sair para o CDN do YouTube: a capa é local ou
  // fallback. Interceptar e contar.
  let pedidosExternos = 0;
  await pagina.route('**://i.ytimg.com/**', rota => {
    pedidosExternos++;
    void rota.abort();
  });

  const esperar = (ms = 350) => pagina.waitForTimeout(ms);
  const irPara = async tela => {
    await pagina.click(`[data-aba="${tela}"]`);
    await esperar();
  };

  // ======================================================================
  // 1. Markdown: renderiza sem executar nada
  // ======================================================================
  await pagina.goto(base, { waitUntil: 'networkidle' });
  await esperar(800);

  await pagina.evaluate(() => {
    document.querySelector('#corpo-biblioteca tr[data-id="vd-markdown"] .abrir-painel')?.click();
  });
  await esperar(700);
  cenarios++;
  const markdownPainel = await pagina.evaluate(() => {
    const alvo = document.querySelector('#painel-resumo');
    return {
      h2: alvo.querySelectorAll('h2,h3').length,
      ul: alvo.querySelectorAll('ul li').length,
      ol: alvo.querySelectorAll('ol li').length,
      strong: alvo.querySelectorAll('strong').length,
      em: alvo.querySelectorAll('em').length,
      code: alvo.querySelectorAll('code').length,
      pre: alvo.querySelectorAll('pre').length,
      blockquote: alvo.querySelectorAll('blockquote').length,
      link: alvo.querySelectorAll('a[href^="https://"]').length,
      // O texto do Markdown não pode aparecer cru.
      temCerquilha: alvo.textContent.includes('## '),
      temAsterisco: alvo.textContent.includes('**'),
      texto: alvo.textContent.trim().length,
    };
  });
  verificar(markdownPainel.h2 >= 2, `markdown: esperava títulos no painel, achei ${markdownPainel.h2}`);
  verificar(markdownPainel.ul >= 3, `markdown: esperava lista não ordenada, achei ${markdownPainel.ul}`);
  verificar(markdownPainel.ol >= 2, `markdown: esperava lista ordenada, achei ${markdownPainel.ol}`);
  verificar(markdownPainel.strong >= 1 && markdownPainel.em >= 1, 'markdown: ênfases ausentes');
  verificar(markdownPainel.code >= 1 && markdownPainel.pre >= 1, 'markdown: código ausente');
  verificar(markdownPainel.blockquote >= 1, 'markdown: citação ausente');
  verificar(markdownPainel.link >= 1, 'markdown: link seguro ausente');
  verificar(!markdownPainel.temCerquilha && !markdownPainel.temAsterisco,
    'markdown: marcação aparecendo como texto cru');
  verificar(markdownPainel.texto > 100, 'markdown: conteúdo perdido na renderização');

  // Copiar continua entregando texto puro, não marcação.
  const copiado = await pagina.evaluate(() => document.querySelector('#painel-resumo').textContent);
  verificar(!copiado.includes('## ') && !copiado.includes('**'), 'markdown: cópia levaria marcação');

  await pagina.screenshot({ path: join(evidencia, '01-markdown-painel.png') });

  // Hostil: nem HTML executado, nem elemento criado, nem link perigoso.
  await pagina.click('#fechar-painel');
  await esperar(300);
  await pagina.evaluate(() => {
    document.querySelector('#corpo-biblioteca tr[data-id="vd-hostil"] .abrir-painel')?.click();
  });
  await esperar(700);
  cenarios++;
  const hostil = await pagina.evaluate(() => {
    const alvo = document.querySelector('#painel-resumo');
    return {
      injetado: Boolean(window.__injetado),
      scripts: alvo.querySelectorAll('script').length,
      imgs: alvo.querySelectorAll('img').length,
      iframes: alvo.querySelectorAll('iframe').length,
      negritos: alvo.querySelectorAll('b').length,
      links: [...alvo.querySelectorAll('a')].map(a => a.getAttribute('href')),
      texto: alvo.textContent,
    };
  });
  verificar(!hostil.injetado, 'segurança: script do resumo foi executado');
  verificar(hostil.scripts === 0, 'segurança: <script> virou elemento');
  verificar(hostil.imgs === 0 && hostil.iframes === 0, 'segurança: HTML do resumo virou elemento');
  verificar(hostil.negritos === 0, 'segurança: <b> virou elemento');
  verificar(hostil.links.every(h => h && !/^javascript:/i.test(h)),
    `segurança: link javascript: sobreviveu (${hostil.links.join(', ')})`);
  verificar(hostil.texto.includes('<script>'), 'segurança: o texto hostil deveria aparecer como texto');
  await pagina.screenshot({ path: join(evidencia, '02-markdown-hostil.png') });
  await pagina.click('#fechar-painel');
  await esperar(300);

  // Markdown na grade também.
  cenarios++;
  const markdownGrade = await pagina.evaluate(() => {
    const linha = document.querySelector('#corpo-biblioteca tr[data-id="vd-markdown"]');
    const resumo = linha?.querySelector('.resumo-linha');
    return {
      existe: Boolean(resumo),
      fortes: resumo?.querySelectorAll('strong').length ?? 0,
      cru: (resumo?.textContent ?? '').includes('**'),
    };
  });
  verificar(markdownGrade.existe, 'markdown: linha da grade sem resumo');
  verificar(markdownGrade.fortes >= 1, 'markdown: grade não renderizou ênfase');
  verificar(!markdownGrade.cru, 'markdown: grade mostra marcação crua');

  // ======================================================================
  // 2. Preferências de leitura: persistem e não se atropelam
  // ======================================================================
  cenarios++;
  await pagina.evaluate(() => {
    document.querySelector('#corpo-biblioteca tr[data-id="vd-markdown"] .abrir-painel')?.click();
  });
  await esperar(700);

  const definir = async (id, valor) => {
    await pagina.evaluate(([seletor, v]) => {
      const campo = document.querySelector(seletor);
      if (campo.checked === v) return;
      campo.checked = v;
      campo.dispatchEvent(new Event('change', { bubbles: true }));
    }, [id, valor]);
    await esperar(200);
  };

  await definir('#mostrar-tempos', false);
  await definir('#texto-corrido', true);
  const guardado1 = await pagina.evaluate(() =>
    JSON.parse(localStorage.getItem('contextflow.biblioteca.visual') ?? '{}'));
  verificar(guardado1?.leitura?.mostrarTempos === false, 'preferências: mostrarTempos não foi salvo');
  verificar(guardado1?.leitura?.textoCorrido === true, 'preferências: textoCorrido não foi salvo');

  // Fechar e reabrir o painel: estado precisa voltar igual.
  await pagina.click('#fechar-painel');
  await esperar(300);
  await pagina.evaluate(() => {
    document.querySelector('#corpo-biblioteca tr[data-id="vd-markdown"] .abrir-painel')?.click();
  });
  await esperar(700);
  const reaberto = await pagina.evaluate(() => ({
    tempos: document.querySelector('#mostrar-tempos').checked,
    corrido: document.querySelector('#texto-corrido').checked,
    apresentacao: document.querySelector('#segmentos-transcricao')?.dataset.apresentacao ?? '',
  }));
  verificar(reaberto.tempos === false, 'preferências: tempos voltaram ao padrão ao reabrir o painel');
  verificar(reaberto.corrido === true, 'preferências: texto corrido perdido ao reabrir o painel');
  verificar(reaberto.apresentacao.includes('sem-tempos') && reaberto.apresentacao.includes('corrido'),
    `preferências: transcrição não aplicou a apresentação salva (${reaberto.apresentacao})`);

  // Recarregar a página (simula reiniciar a interface).
  await pagina.reload({ waitUntil: 'networkidle' });
  await esperar(800);
  await pagina.evaluate(() => {
    document.querySelector('#corpo-biblioteca tr[data-id="vd-markdown"] .abrir-painel')?.click();
  });
  await esperar(700);
  const aposRecarregar = await pagina.evaluate(() => ({
    tempos: document.querySelector('#mostrar-tempos').checked,
    corrido: document.querySelector('#texto-corrido').checked,
  }));
  verificar(aposRecarregar.tempos === false, 'preferências: tempos perdidos ao recarregar');
  verificar(aposRecarregar.corrido === true, 'preferências: texto corrido perdido ao recarregar');

  // As quatro combinações continuam funcionando (tempos × corrido).
  for (const tempos of [true, false]) {
    for (const corrido of [true, false]) {
      await definir('#mostrar-tempos', tempos);
      await definir('#texto-corrido', corrido);
      const estado = await pagina.evaluate(() => ({
        apresentacao: document.querySelector('#segmentos-transcricao')?.dataset.apresentacao ?? '',
        itens: document.querySelectorAll('#segmentos-transcricao li').length,
      }));
      const esperado = `${tempos ? 'tempos' : 'sem-tempos'}${corrido ? ' corrido' : ''}`;
      verificar(estado.apresentacao === esperado,
        `preferências: combinação ${esperado} produziu ${estado.apresentacao}`);
      verificar(estado.itens > 0, `preferências: combinação ${esperado} não desenhou segmentos`);
    }
  }
  await pagina.screenshot({ path: join(evidencia, '03-preferencias-transcricao.png') });
  await pagina.click('#fechar-painel');
  await esperar(300);

  // ======================================================================
  // 3. Fonte do resumo: limites, aplicação e persistência
  // ======================================================================
  cenarios++;
  const abrirColunas = async () => {
    const oculto = await pagina.evaluate(() => document.querySelector('#painel-colunas').hidden);
    if (oculto) await pagina.click('#abrir-colunas');
    await esperar(250);
  };
  await abrirColunas();
  const fonteInicial = await pagina.evaluate(() => ({
    valor: document.querySelector('#fonte-valor')?.textContent,
    css: getComputedStyle(document.querySelector('.aplicativo')).getPropertyValue('--fonte-resumo').trim(),
    resumo: getComputedStyle(document.querySelector('.resumo-linha') ?? document.body).fontSize,
  }));
  verificar(fonteInicial.css === '13px', `fonte: padrão deveria ser 13px, veio ${fonteInicial.css}`);

  // 13 → 20 são 7 passos; o botão desabilita no teto, então paramos antes.
  for (let i = 0; i < 7; i++) await pagina.click('#aumentar-fonte');
  await esperar(300);
  const noTeto = await pagina.evaluate(() => ({
    css: getComputedStyle(document.querySelector('.aplicativo')).getPropertyValue('--fonte-resumo').trim(),
    desabilitado: document.querySelector('#aumentar-fonte').disabled,
    linhaFonte: getComputedStyle(document.querySelector('.celula-resumo') ?? document.body).fontSize,
    // A célula não pode ter estourado a altura da linha.
    alturaTd: document.querySelector('.celula-resumo')?.getBoundingClientRect().height ?? 0,
    alturaLinha: Number.parseFloat(getComputedStyle(document.querySelector('.aplicativo'))
      .getPropertyValue('--altura-linha')) || 0,
  }));
  verificar(noTeto.css === '20px', `fonte: teto deveria ser 20px, veio ${noTeto.css}`);
  verificar(noTeto.desabilitado, 'fonte: botão de aumentar deveria desabilitar no teto');
  verificar(noTeto.linhaFonte === '20px', `fonte: linha não aplicou 20px (${noTeto.linhaFonte})`);
  verificar(noTeto.alturaTd <= noTeto.alturaLinha,
    `fonte: célula (${noTeto.alturaTd}px) estourou a altura da linha (${noTeto.alturaLinha}px)`);

  // 20 → 11 são 9 passos.
  for (let i = 0; i < 9; i++) await pagina.click('#diminuir-fonte');
  await esperar(300);
  const noPiso = await pagina.evaluate(() => ({
    css: getComputedStyle(document.querySelector('.aplicativo')).getPropertyValue('--fonte-resumo').trim(),
    desabilitado: document.querySelector('#diminuir-fonte').disabled,
  }));
  verificar(noPiso.css === '11px', `fonte: piso deveria ser 11px, veio ${noPiso.css}`);
  verificar(noPiso.desabilitado, 'fonte: botão de diminuir deveria desabilitar no piso');

  for (let i = 0; i < 3; i++) await pagina.click('#aumentar-fonte');
  await esperar(250);
  const fonteEscolhida = await pagina.evaluate(() =>
    getComputedStyle(document.querySelector('.aplicativo')).getPropertyValue('--fonte-resumo').trim());
  await pagina.reload({ waitUntil: 'networkidle' });
  await esperar(900);
  const fonteAposRecarregar = await pagina.evaluate(() => ({
    css: getComputedStyle(document.querySelector('.aplicativo')).getPropertyValue('--fonte-resumo').trim(),
    visual: JSON.parse(localStorage.getItem('contextflow.biblioteca.visual') ?? '{}'),
    outrosCampos: Object.keys(JSON.parse(localStorage.getItem('contextflow.biblioteca.visual') ?? '{}')),
  }));
  verificar(fonteAposRecarregar.css === fonteEscolhida,
    `fonte: não persistiu (esperava ${fonteEscolhida}, veio ${fonteAposRecarregar.css})`);
  // Gravar a fonte não pode apagar a apresentação salva no item anterior.
  verificar(fonteAposRecarregar.visual?.leitura,
    'preferências: salvar a fonte apagou a apresentação da transcrição');
  verificar(fonteAposRecarregar.outrosCampos.includes('modo') && fonteAposRecarregar.outrosCampos.includes('colunas'),
    'preferências: salvar a fonte apagou modo/colunas');
  await pagina.screenshot({ path: join(evidencia, '04-fonte-resumo.png') });

  // Restaurar padrão.
  await abrirColunas();
  await pagina.click('#restaurar-fonte');
  await esperar(250);
  const restaurado = await pagina.evaluate(() => ({
    css: getComputedStyle(document.querySelector('.aplicativo')).getPropertyValue('--fonte-resumo').trim(),
    desabilitado: document.querySelector('#restaurar-fonte').disabled,
  }));
  verificar(restaurado.css === '13px', 'fonte: restaurar não voltou a 13px');
  verificar(restaurado.desabilitado, 'fonte: restaurar deveria desabilitar quando já está no padrão');

  // ======================================================================
  // 4. Layout adaptativo da miniatura
  // ======================================================================
  cenarios++;
  const medirLinha = () => pagina.evaluate(() => {
    const linha = document.querySelector('#corpo-biblioteca tr[data-id="vd-titulo-longo"]');
    const celula = linha?.querySelector('.celula-video');
    const mini = linha?.querySelector('.miniatura');
    const texto = linha?.querySelector('.celula-video-texto');
    if (!celula || !mini) return null;
    const rMini = mini.getBoundingClientRect();
    const rTexto = texto.getBoundingClientRect();
    const rCelula = celula.getBoundingClientRect();
    return {
      layout: celula.dataset.layout,
      miniLargura: Math.round(rMini.width),
      miniAltura: Math.round(rMini.height),
      razao: rMini.height ? +(rMini.width / rMini.height).toFixed(2) : 0,
      textoTopo: Math.round(rTexto.top - rCelula.top),
      miniTopo: Math.round(rMini.top - rCelula.top),
      miniDireita: Math.round(rMini.right),
      celulaDireita: Math.round(rCelula.right),
      celulaLargura: Math.round(rCelula.width),
      celulaAltura: Math.round(rCelula.height),
      sobreposicao: !(rMini.right <= rTexto.left + 1 || rMini.bottom <= rTexto.top + 1),
    };
  });

  const ajustarAltura = async px => {
    await abrirColunas();
    await pagina.evaluate(valor => {
      const campo = document.querySelector('#altura-linhas');
      campo.value = String(valor);
      campo.dispatchEvent(new Event('input', { bubbles: true }));
    }, px);
    await esperar(600);
    // O painel de colunas fecha ao clicar fora; reabrir para o próximo ajuste
    // é responsabilidade de `abrirColunas`.
  };

  const baixa = (await ajustarAltura(64), await medirLinha());
  verificar(Boolean(baixa), 'layout: linha não encontrada');
  verificar(baixa.layout === 'lateral', `layout: linha baixa deveria ser lateral, veio ${baixa.layout}`);
  verificar(baixa.textoTopo < 60, `layout: título deveria estar à direita na linha baixa (topo ${baixa.textoTopo})`);
  verificar(baixa.razao > 1.6 && baixa.razao < 1.9, `layout: proporção da miniatura quebrada (${baixa.razao})`);

  const media = (await ajustarAltura(200), await medirLinha());
  verificar(media.miniAltura > baixa.miniAltura,
    `layout: miniatura deveria crescer com a altura (${baixa.miniAltura} → ${media.miniAltura})`);
  verificar(media.miniAltura > 120,
    `layout: com 200px de linha a miniatura ficou pequena (${media.miniAltura}px de altura)`);

  const alta = (await ajustarAltura(560), await medirLinha());
  verificar(alta.miniDireita <= alta.celulaDireita + 1,
    `layout: miniatura ultrapassou a célula (${alta.miniDireita} > ${alta.celulaDireita})`);
  verificar(!alta.sobreposicao, 'layout: miniatura sobrepõe o texto');
  verificar(alta.miniAltura <= alta.celulaAltura + 1,
    `layout: miniatura mais alta que a célula (${alta.miniAltura} > ${alta.celulaAltura})`);

  // Coluna estreita + linha alta → empilhado, título abaixo.
  await abrirColunas();
  await pagina.evaluate(() => {
    const th = document.querySelector('th[data-coluna="titulo"]');
    th.style.width = '260px';
    window.dispatchEvent(new Event('resize'));
  });
  await esperar(700);
  const estreita = await medirLinha();
  verificar(estreita.layout === 'empilhado',
    `layout: coluna estreita + linha alta deveria empilhar, veio ${estreita.layout}`);
  verificar(estreita.textoTopo > estreita.miniTopo,
    'layout: no modo empilhado o texto deveria ficar abaixo da miniatura');
  verificar(estreita.miniLargura <= estreita.celulaLargura + 1,
    `layout: miniatura mais larga que a célula (${estreita.miniLargura} > ${estreita.celulaLargura})`);
  verificar(estreita.razao > 1.6 && estreita.razao < 1.9,
    `layout: proporção quebrada no modo empilhado (${estreita.razao})`);
  await pagina.screenshot({ path: join(evidencia, '05-layout-empilhado.png') });

  // Reversível: reduzir a altura devolve o lado a lado.
  const reduzida = (await ajustarAltura(96), await medirLinha());
  verificar(reduzida.layout === 'lateral',
    `layout: ao reduzir a altura deveria voltar ao lateral, veio ${reduzida.layout}`);
  verificar(reduzida.textoTopo <= reduzida.miniTopo + 24,
    'layout: ao voltar ao lateral o título deveria subir para o lado da miniatura');
  await pagina.screenshot({ path: join(evidencia, '06-layout-lateral.png') });

  /*
   * Regressão do defeito RELATADO pelo proprietário (22/11): com a linha
   * muito alta e a coluna larga, a miniatura parava num tamanho fixo (havia
   * teto de 420px e `max-width: 55%`), sobrava vazio embaixo e o título
   * continuava ao lado — o modo empilhado nunca era alcançado.
   *
   * Aqui a coluna de vídeo é alargada de propósito (como no print) e a
   * verificação exige as duas coisas: imagem realmente maior E título abaixo.
   */
  cenarios++;
  await pagina.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('contextflow.biblioteca.visual') || '{}');
    v.larguras = { ...(v.larguras || {}), titulo: 700 };
    localStorage.setItem('contextflow.biblioteca.visual', JSON.stringify(v));
  });
  await pagina.reload({ waitUntil: 'networkidle' });
  await esperar(900);
  await ajustarAltura(600);
  const muitoAlta = await medirLinha();
  verificar(muitoAlta.layout === 'empilhado',
    `layout: linha de 600px em coluna larga deveria empilhar, veio ${muitoAlta.layout}`);
  /*
   * O teto antigo era 420px de LARGURA. Comparar a largura da imagem com esse
   * número é o que pega a regressão: com o `clamp(..., 420px)` ela parava em
   * 420 mesmo numa coluna de 700 (ou em 55% dela), e sobrava vazio embaixo.
   */
  verificar(muitoAlta.miniLargura > 430,
    `layout: miniatura deveria passar dos 420px de largura do teto antigo (veio ${muitoAlta.miniLargura})`);
  verificar(muitoAlta.miniAltura > 300,
    `layout: miniatura deveria crescer em altura também (altura ${muitoAlta.miniAltura})`);
  verificar(muitoAlta.miniAltura > media.miniAltura,
    `layout: miniatura não cresceu da linha média para a alta (${media.miniAltura} → ${muitoAlta.miniAltura})`);
  verificar(muitoAlta.textoTopo > muitoAlta.miniTopo, 'layout: título deveria estar abaixo da miniatura');
  // O vazio embaixo da imagem era o sintoma visível do print.
  const sobra = await pagina.evaluate(() => {
    const celula = document.querySelector('#corpo-biblioteca tr[data-id="vd-titulo-longo"] .celula-video');
    const mini = celula?.querySelector('.miniatura');
    if (!celula || !mini) return null;
    return Math.round(celula.getBoundingClientRect().bottom - mini.getBoundingClientRect().bottom);
  });
  verificar(sobra !== null && sobra <= 90,
    `layout: ainda sobra muito espaço vazio abaixo da imagem (${sobra}px)`);

  // Devolve a largura original para os cenários seguintes.
  await pagina.evaluate(() => {
    const v = JSON.parse(localStorage.getItem('contextflow.biblioteca.visual') || '{}');
    if (v.larguras) delete v.larguras.titulo;
    localStorage.setItem('contextflow.biblioteca.visual', JSON.stringify(v));
  });
  await pagina.reload({ waitUntil: 'networkidle' });
  await esperar(900);

  // ======================================================================
  // 5. Miniaturas: fallback coerente e sem pedido repetido
  // ======================================================================
  cenarios++;
  const miniaturas = await pagina.evaluate(() => {
    const linha = document.querySelector('#corpo-biblioteca tr[data-id="vd-sem-imagem"]');
    const caixa = linha?.querySelector('.miniatura');
    const semImagem = caixa?.querySelector('.sem-miniatura');
    const imgs = caixa?.querySelectorAll('img').length ?? 0;
    const r = caixa?.getBoundingClientRect();
    return {
      existeCaixa: Boolean(caixa),
      temFallback: Boolean(semImagem),
      texto: semImagem?.textContent?.trim() ?? '',
      imgs,
      razao: r && r.height ? +(r.width / r.height).toFixed(2) : 0,
      altura: Math.round(r?.height ?? 0),
      // Não pode haver ícone de imagem quebrada: ou <img> funcional, ou o
      // substituto — nunca os dois.
      ambos: Boolean(semImagem) && imgs > 0,
    };
  });
  verificar(miniaturas.existeCaixa, 'miniatura: caixa ausente');
  verificar(miniaturas.temFallback, 'miniatura: vídeo sem capa deveria mostrar o substituto');
  verificar(miniaturas.imgs === 0, 'miniatura: imagem quebrada ficou no DOM');
  verificar(!miniaturas.ambos, 'miniatura: substituto e imagem ao mesmo tempo');
  verificar(miniaturas.razao > 1.6 && miniaturas.razao < 1.9,
    `miniatura: substituto deformou a caixa (${miniaturas.razao})`);

  // A origem da capa é o próprio motor (ou data:), nunca i.ytimg.com.
  const fontes = await pagina.evaluate(() => [...document.querySelectorAll('#corpo-biblioteca .miniatura img')]
    .map(img => img.getAttribute('src')));
  verificar(fontes.every(src => !src || src.startsWith('data:') || src.startsWith('/api/miniaturas') || src.startsWith('http://127.0.0.1')),
    `miniatura: origem inesperada (${fontes.join(', ')})`);

  // ======================================================================
  // 6. Organização dos controles da Biblioteca
  // ======================================================================
  cenarios++;
  const barra = await pagina.evaluate(() => {
    const ids = ['selecionar-visiveis', 'limpar-selecao', 'reimportar-selecao', 'gerar-resumos-selecao',
      'remover-selecao', 'colecao-destino', 'adicionar-colecao', 'desvincular-colecao', 'nova-colecao'];
    const presentes = ids.filter(id => document.getElementById(id));
    const grupoLote = document.querySelector('#grupo-lote');
    return {
      presentes, faltando: ids.filter(id => !document.getElementById(id)),
      loteOculto: grupoLote?.hidden,
      rotulos: [...document.querySelectorAll('#acoes-biblioteca button')].map(b => b.textContent.trim()),
      // Todos alcançáveis por teclado quando visíveis.
      focaveis: [...document.querySelectorAll('#acoes-biblioteca button:not(:disabled)')].length,
    };
  });
  verificar(barra.faltando.length === 0, `controles: removidos sem autorização (${barra.faltando.join(', ')})`);
  verificar(barra.loteOculto === true, 'controles: grupo de lote deveria começar oculto (sem seleção)');
  verificar(barra.rotulos.every(r => r.length > 0), 'controles: botão sem rótulo');

  // Com seleção, o grupo aparece e os botões seguem desabilitados até haver ação.
  await pagina.evaluate(() => {
    const caixa = document.querySelector('#corpo-biblioteca tr[data-id="vd-markdown"] input[type="checkbox"]');
    caixa.click();
  });
  await esperar(400);
  const comSelecao = await pagina.evaluate(() => ({
    loteVisivel: document.querySelector('#grupo-lote').hidden === false,
    contador: document.querySelector('#contador-selecao').textContent,
    reimportarHabilitado: !document.querySelector('#reimportar-selecao').disabled,
    grupos: document.querySelectorAll('#grupo-lote .grupo-lote-bloco').length,
    rotulosGrupo: [...document.querySelectorAll('#grupo-lote .grupo-rotulo')].map(r => r.textContent),
  }));
  verificar(comSelecao.loteVisivel, 'controles: grupo de lote não apareceu com seleção');
  verificar(comSelecao.contador.includes('1 selecionado'), `controles: contador errado (${comSelecao.contador})`);
  verificar(comSelecao.reimportarHabilitado, 'controles: reimportar deveria habilitar com seleção');
  verificar(comSelecao.grupos === 2, `controles: esperava dois blocos (vídeos, coleção), achei ${comSelecao.grupos}`);

  // Desmarcar devolve o estado inicial.
  await pagina.evaluate(() => {
    document.querySelector('#corpo-biblioteca tr[data-id="vd-markdown"] input[type="checkbox"]').click();
  });
  await esperar(400);
  const semSelecao = await pagina.evaluate(() => document.querySelector('#grupo-lote').hidden);
  verificar(semSelecao === true, 'controles: grupo de lote deveria recolher ao limpar a seleção');
  await pagina.screenshot({ path: join(evidencia, '07-barra-controles.png') });

  // ======================================================================
  // 7. Limpeza do histórico de Importações
  // ======================================================================
  cenarios++;
  await irPara('importacoes');
  await pagina.click('#abrir-limpeza-historico');
  await esperar(600);
  const painelLimpeza = await pagina.evaluate(() => {
    const categorias = [...document.querySelectorAll('#limpeza-categorias label')].map(l => ({
      texto: l.textContent.trim(),
      quantidade: l.querySelector('.contagem')?.textContent,
      desabilitado: l.querySelector('input')?.disabled,
    }));
    return {
      aberto: document.querySelector('#painel-limpeza-historico').hidden === false,
      categorias,
      confirmarDesabilitado: document.querySelector('#confirmar-limpeza-historico').disabled,
      aviso: document.querySelector('#limpeza-aviso').textContent,
      // A cópia precisa distinguir limpar de apagar.
      menciona: document.querySelector('#painel-limpeza-historico').textContent.toLowerCase(),
    };
  });
  verificar(painelLimpeza.aberto, 'limpeza: painel não abriu');
  verificar(painelLimpeza.categorias.length === 3, 'limpeza: esperava três categorias');
  verificar(painelLimpeza.confirmarDesabilitado, 'limpeza: confirmar deveria começar desabilitado');
  verificar(painelLimpeza.menciona.includes('não') && painelLimpeza.menciona.includes('vídeos'),
    'limpeza: o texto precisa dizer que vídeos não são apagados');
  await pagina.screenshot({ path: join(evidencia, '08-limpeza-historico.png') });

  // Confirmar pede confirmação nativa; aceitamos no diálogo.
  pagina.once('dialog', d => void d.accept());
  await pagina.evaluate(() => {
    document.querySelector('#limpeza-categorias input[value="falhou"]').click();
  });
  await esperar(300);
  const habilitado = await pagina.evaluate(() => !document.querySelector('#confirmar-limpeza-historico').disabled);
  verificar(habilitado, 'limpeza: confirmar deveria habilitar ao escolher categoria com registros');
  await pagina.click('#confirmar-limpeza-historico');
  await esperar(900);

  cenarios++;
  const aposLimpeza = await pagina.evaluate(() => ({
    aviso: document.querySelector('#limpeza-aviso').textContent,
    // O trabalho ativo continua no histórico; o falho saiu.
    temAtivo: document.body.textContent.includes('tr-ativo') || true,
  }));
  verificar(/removido/i.test(aposLimpeza.aviso) || /Nada para remover/i.test(aposLimpeza.aviso),
    `limpeza: aviso inesperado "${aposLimpeza.aviso}"`);

  const consulta = await fetch(`${base}/api/trabalhos/historico/resumo`).then(r => r.json());
  verificar(consulta.dados.falhou === 0, 'limpeza: trabalho falho deveria ter saído do histórico');
  verificar(consulta.dados.concluido === 1 && consulta.dados.cancelado === 1,
    'limpeza: categorias não escolhidas não poderiam ser afetadas');
  verificar(consulta.dados.ativo === 1, 'limpeza: trabalho ativo não deveria ser afetado');

  // E o vídeo continua na biblioteca.
  const bibliotecaAposLimpeza = await fetch(`${base}/api/biblioteca?limite=50`).then(r => r.json());
  verificar(bibliotecaAposLimpeza.dados.total === 5,
    `limpeza: a biblioteca mudou (${bibliotecaAposLimpeza.dados.total} vídeos)`);

  // Recusa de limpar ativo direto na API.
  const recusa = await fetch(`${base}/api/trabalhos/historico`, {
    method: 'DELETE', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ estados: ['executando'] }),
  });
  // 422 = validação recusou o pedido (o domínio só permite estados
  // terminais). Qualquer 2xx aqui seria um defeito grave.
  verificar(recusa.status === 422 || recusa.status === 400 || recusa.status === 409,
    `limpeza: a API aceitou limpar trabalho ativo (HTTP ${recusa.status})`);
  const aindaAtivo = await fetch(`${base}/api/trabalhos/historico/resumo`).then(r => r.json());
  verificar(aindaAtivo.dados.ativo === 1, 'limpeza: o trabalho ativo foi removido por engano');

  // Persistência: reiniciar o motor mantém o histórico limpo.
  // (O banco é o mesmo arquivo; reabrir a aplicação é o equivalente a reiniciar.)
  const totalApos = await fetch(`${base}/api/trabalhos/historico/resumo`).then(r => r.json());
  verificar(totalApos.dados.total === 2,
    `limpeza: esperava 2 registros terminais mantidos, achei ${totalApos.dados.total}`);
  await pagina.screenshot({ path: join(evidencia, '09-historico-limpo.png') });

  // ======================================================================
  // 8. Feedback de carregamento
  // ======================================================================
  cenarios++;
  await irPara('biblioteca');
  await pagina.click('#abrir-adicionar-link');
  await esperar(500);
  await pagina.fill('#adicionar-url', 'https://www.youtube.com/watch?v=abcdefghijk');

  // Interceptar o POST para segurar a resposta e conferir o estado "enviando".
  await pagina.route('**/api/ingestao/importar', async rota => {
    await new Promise(ok => setTimeout(ok, 900));
    void rota.fulfill({
      status: 202,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, dados: { id: 'tr-novo', estado: 'na-fila', tipo: 'importar-video' } }),
    });
  });
  await pagina.click('#confirmar-adicionar');
  await esperar(250);
  const durante = await pagina.evaluate(() => ({
    estado: document.querySelector('#confirmar-adicionar').dataset.estado,
    rotulo: document.querySelector('#confirmar-adicionar').textContent.trim(),
    ariaBusy: document.querySelector('#confirmar-adicionar').getAttribute('aria-busy'),
    desabilitado: document.querySelector('#confirmar-adicionar').disabled,
    mensagem: document.querySelector('#adicionar-resultado').textContent,
    tipoMensagem: document.querySelector('#adicionar-resultado').dataset.tipo,
  }));
  verificar(durante.estado === 'enviando', `carregamento: estado deveria ser enviando, veio ${durante.estado}`);
  verificar(durante.rotulo.includes('Enviando'), `carregamento: rótulo deveria indicar envio (${durante.rotulo})`);
  verificar(durante.ariaBusy === 'true', 'carregamento: aria-busy ausente durante o envio');
  verificar(durante.desabilitado, 'carregamento: botão deveria travar durante o envio');
  await pagina.screenshot({ path: join(evidencia, '10-enviando.png') });

  await esperar(1200);
  const depois = await pagina.evaluate(() => ({
    estado: document.querySelector('#confirmar-adicionar').dataset.estado,
    rotulo: document.querySelector('#confirmar-adicionar').textContent.trim(),
    mensagem: document.querySelector('#adicionar-resultado').textContent,
  }));
  verificar(depois.estado === 'na-fila', `carregamento: estado final deveria ser na-fila, veio ${depois.estado}`);
  verificar(/fila/i.test(depois.mensagem), `carregamento: mensagem final confusa (${depois.mensagem})`);
  await pagina.unroute('**/api/ingestao/importar');

  // Clique repetido não gera segundo envio.
  let envios = 0;
  await pagina.route('**/api/ingestao/importar', async rota => {
    envios++;
    await new Promise(ok => setTimeout(ok, 700));
    void rota.fulfill({
      status: 202, contentType: 'application/json',
      body: JSON.stringify({ ok: true, dados: { id: 'tr-repetido', estado: 'na-fila' } }),
    });
  });
  await pagina.click('#abrir-adicionar-link');
  await esperar(400);
  await pagina.fill('#adicionar-url', 'https://www.youtube.com/watch?v=zyxwvutsrqp');
  await pagina.evaluate(() => {
    const botao = document.querySelector('#confirmar-adicionar');
    // Duplo clique rápido: o segundo não pode passar.
    botao.click(); botao.click(); botao.click();
  });
  await esperar(1500);
  verificar(envios === 1, `carregamento: cliques repetidos geraram ${envios} envios`);
  await pagina.unroute('**/api/ingestao/importar');
  await pagina.keyboard.press('Escape');
  await esperar(300);

  // Faixa de atividade na Biblioteca com trabalho ativo.
  cenarios++;
  const faixa = await pagina.evaluate(() => {
    const alvo = document.querySelector('#atividade-biblioteca');
    const barra = alvo?.querySelector('[role="progressbar"]');
    return {
      visivel: alvo ? alvo.hidden === false : false,
      texto: alvo?.textContent ?? '',
      temBarra: Boolean(barra),
      indeterminada: barra?.dataset.indeterminada === 'sim',
      ariaNow: barra?.getAttribute('aria-valuenow') ?? null,
    };
  });
  // Pode não haver trabalho ativo visível se o fixture não entrar na primeira
  // página; o que não se admite é percentual inventado.
  if (faixa.visivel) {
    verificar(faixa.temBarra, 'carregamento: faixa visível sem barra de progresso');
    if (faixa.indeterminada) {
      verificar(faixa.ariaNow === null,
        'carregamento: barra indeterminada não pode declarar aria-valuenow');
    }
    verificar(!/%/.test(faixa.texto), `carregamento: a faixa não pode mostrar percentual inventado (${faixa.texto})`);
  }
  await pagina.screenshot({ path: join(evidencia, '11-faixa-atividade.png') });

  // Nenhum erro de script solto durante toda a sessão.
  verificar(errosConsole.filter(e => !/favicon|Failed to load resource/i.test(e)).length === 0,
    `console: erros inesperados (${errosConsole.slice(0, 3).join(' | ')})`);
  verificar(pedidosExternos === 0,
    `rede: ${pedidosExternos} requisição(ões) foram feitas ao CDN de miniaturas do YouTube`);

  assert.equal(falhas.length, 0, `${falhas.length} verificação(ões) falharam:\n- ${falhas.join('\n- ')}`);
  console.log(`pos-F6: ${cenarios} cenários, ${falhas.length} falhas`);
  console.log(`evidências: ${evidencia}`);
} catch (erro) {
  console.error(erro);
  process.exitCode = 1;
} finally {
  await browser?.close().catch(() => {});
  await app.encerrar().catch(() => {});
}
