#!/usr/bin/env node
/**
 * Teste E2E da interface em navegador real (Chrome headless via CDP).
 *
 * Não usa mock: sobe a aplicação, abre a página, clica, digita e confere o DOM.
 * Verifica o que um teste de unidade não vê: a interface ligada ao motor de verdade.
 *
 * Requer um Chrome/Chromium acessível em CHROME_BIN (ver README).
 * Saída: PASS/FAIL por cenário, exit != 0 se qualquer cenário falhar.
 */
import { exercitarBiblioteca } from './biblioteca-cenarios.mjs';
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORTA_CDP = Number(process.env.CONTEXTFLOW_CDP_PORTA ?? 9333);

/**
 * Descobre um Chrome/Chromium/Edge instalado.
 *
 * Ordem: CHROME_BIN explícito > caminhos conhecidos por sistema operacional >
 * descoberta no sandbox de desenvolvimento. Sem isso, o teste E2E só rodaria
 * na máquina onde foi escrito — e não no computador do proprietário.
 */
function descobrirNavegador() {
  if (process.env.CHROME_BIN) return process.env.CHROME_BIN;

  const candidatos = [];
  const env = process.env;

  if (process.platform === 'win32') {
    const bases = [env['PROGRAMFILES'], env['PROGRAMFILES(X86)'], env['LOCALAPPDATA']].filter(Boolean);
    for (const base of bases) {
      candidatos.push(
        join(base, 'Google', 'Chrome', 'Application', 'chrome.exe'),
        join(base, 'Microsoft', 'Edge', 'Application', 'msedge.exe'),
        join(base, 'Chromium', 'Application', 'chrome.exe'),
      );
    }
  } else if (process.platform === 'darwin') {
    candidatos.push(
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
    );
  } else {
    candidatos.push(
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      '/usr/bin/microsoft-edge',
      '/snap/bin/chromium',
      `${env.HOME}/.cache/cdp/chrome-bin`,
    );
  }

  return candidatos.find((caminho) => existsSync(caminho)) ?? null;
}

const CHROME = descobrirNavegador();
// Só o Chrome empacotado do sandbox precisa de bibliotecas próprias.
const LIBS = process.env.CHROME_LIBS ?? `${process.env.HOME}/.cache/cdp/al2023/lib`;
const USA_LIBS_DO_SANDBOX = Boolean(process.env.CHROME_LIBS) || CHROME?.includes('.cache/cdp');

const resultados = [];
const registrar = (cenario, ok, detalhe) => {
  resultados.push({ cenario, ok, detalhe });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${cenario}${detalhe ? ` — ${detalhe}` : ''}`);
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

if (!CHROME) {
  console.error(
    'Nenhum Chrome/Chromium/Edge encontrado.\n' +
      'Instale o Google Chrome ou aponte o executável com CHROME_BIN:\n' +
      '  PowerShell : $env:CHROME_BIN = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe"\n' +
      '  bash       : export CHROME_BIN=/usr/bin/google-chrome',
  );
  process.exit(2);
}

// --------------------------------------------------------------- CDP ------
const errosJs = [];
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pendentes = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
      if (msg.method === 'Runtime.exceptionThrown') errosJs.push(msg.params?.exceptionDetails?.text ?? 'Exceção JavaScript');
      if (msg.id && this.pendentes.has(msg.id)) {
        const { resolver, rejeitar } = this.pendentes.get(msg.id);
        this.pendentes.delete(msg.id);
        msg.error ? rejeitar(new Error(JSON.stringify(msg.error))) : resolver(msg.result);
      }
    });
  }
  enviar(method, params = {}, sessionId) {
    const id = ++this.id;
    this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    return new Promise((resolver, rejeitar) => {
      this.pendentes.set(id, { resolver, rejeitar });
      setTimeout(() => {
        if (this.pendentes.delete(id)) rejeitar(new Error(`timeout: ${method}`));
      }, 60000);
    });
  }
}

async function abrirNavegador() {
  const proc = spawn(
    CHROME,
    [
      '--headless=new', '--no-sandbox', '--disable-gpu', '--disable-dev-shm-usage', '--no-zygote',
      `--remote-debugging-port=${PORTA_CDP}`, '--window-size=1440,900', '--hide-scrollbars', 'about:blank',
    ],
    {
      env: USA_LIBS_DO_SANDBOX ? { ...process.env, LD_LIBRARY_PATH: LIBS } : { ...process.env },
      stdio: 'ignore',
    },
  );

  for (let i = 0; i < 80; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORTA_CDP}/json/version`);
      if (r.ok) return { proc, info: await r.json() };
    } catch {}
    await dormir(250);
  }
  proc.kill('SIGKILL');
  throw new Error('CDP não respondeu');
}

// ---------------------------------------------------------------- main ----
const config = carregarConfig({
  CONTEXTFLOW_PORTA: '0',
  CONTEXTFLOW_AMBIENTE: 'teste',
  CONTEXTFLOW_DADOS: join(raiz, 'testes', '.tmp', 'dados-e2e'),
});
// Cada execução começa com banco limpo: teste de UI não pode depender de estado anterior.
rmSync(config.pastaDados, { recursive: true, force: true });
mkdirSync(config.pastaDados, { recursive: true });

/**
 * Executor yt-dlp falso para o E2E.
 *
 * O teste de navegador não pode depender do YouTube: a rede do ambiente muda e
 * o teste ficaria intermitente. O dublê devolve um vídeo com legenda manual,
 * que é o caminho mais completo — metadados + segmentos com tempo.
 */
const bloqueadosE2e = new Set();
const falhasE2e = new Set();
const executorE2e = {
  async disponivel() {
    return { disponivel: true, versao: '2026.10.26 (dublê E2E)', caminho: 'yt-dlp' };
  },
  async inspecionar(url, sinal) {
    const id = new URL(url).searchParams.get('v');
    while (bloqueadosE2e.has(id)) {
      if (sinal?.aborted) throw new Error('Operação abortada pelo teste.');
      await dormir(20);
    }
    return {
      id: 'dQw4w9WgXcQ',
      titulo: id === 'dQw4w9WgXcQ' ? 'Vídeo de demonstração E2E' : `Vídeo E2E ${id}`,
      canalId: 'UCe2e',
      canalNome: 'Canal E2E',
      duracaoSegundos: 212,
      miniaturaUrl: null,
      publicadoEm: '2024-07-20T00:00:00.000Z',
      legendasManuais: ['pt'],
      legendasAutomaticas: [],
    };
  },
  async baixarLegenda(url) {
    const id = new URL(url).searchParams.get('v');
    if (id === 'bbbbbbbbbbb') return null;
    if (falhasE2e.delete(id)) throw new Error('Falha temporária controlada.');
    return {
      idioma: 'pt',
      origem: 'manual',
      segmentos: [
        { inicioMs: 0, fimMs: 2000, texto: 'Bem-vindo ao ContextFlow.' },
        { inicioMs: 2000, fimMs: 5000, texto: 'Esta é a primeira fala da transcrição.' },
        { inicioMs: 5000, fimMs: 9000, texto: 'E aqui termina a demonstração.' },
      ],
    };
  },
  async descobrirPlaylist(_url, aoItem) {
    aoItem({ youtubeId: 'aaaaaaaaaaa', titulo: 'Primeiro da playlist', posicao: 0 });
    aoItem({ youtubeId: 'bbbbbbbbbbb', titulo: 'Sem legenda na playlist', posicao: 1 });
  },
};

const app = criarAplicacao(config, { executorYtdlp: executorE2e });
// Migrações antes de escutar: sem isso a API responde sobre tabela inexistente.
app.iniciarPersistencia();
await new Promise((ok) => app.servidor.listen(0, '127.0.0.1', ok));
const porta = app.servidor.address().port;
const base = `http://127.0.0.1:${porta}`;

const { proc: navegador, info } = await abrirNavegador();
const ws = new WebSocket(info.webSocketDebuggerUrl);
await new Promise((ok, falhou) => {
  ws.addEventListener('open', ok, { once: true });
  ws.addEventListener('error', falhou, { once: true });
});
const cli = new Cdp(ws);
const { targetId } = await cli.enviar('Target.createTarget', { url: 'about:blank' });
const { sessionId } = await cli.enviar('Target.attachToTarget', { targetId, flatten: true });
const S = (m, p) => cli.enviar(m, p, sessionId);

await S('Page.enable');
await S('Runtime.enable');
const avaliar = async (expr) => (await S('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })).result?.value;
const esperar = async (expr, ms = 15000) => {
  const fim = Date.now() + ms;
  while (Date.now() < fim) {
    if (await avaliar(expr)) return true;
    await dormir(200);
  }
  return false;
};

try {
  await S('Page.navigate', { url: base });
  const montou = await esperar(`!!document.querySelector('.aplicativo')`);
  registrar('a interface monta no navegador', montou);

  // 1. Status do motor refletido na tela (não é decorativo).
  const statusOk = await esperar(`document.querySelector('.status-texto')?.textContent.includes('conectado')`, 12000);
  const textoStatus = await avaliar(`document.querySelector('.status-texto')?.textContent`);
  registrar('a tela mostra o motor conectado', statusOk, textoStatus);

  // 2. Biblioteca vazia é declarada honestamente.
  const vazioVisivel = await avaliar(`!document.querySelector('#vazio-biblioteca').hidden`);
  const textoVazio = await avaliar(`document.querySelector('.vazio-texto')?.textContent.trim().slice(0, 60)`);
  registrar('biblioteca vazia mostra estado explícito', vazioVisivel === true, textoVazio);

  // 3. Navegação funciona e muda a URL.
  await avaliar(`document.querySelector('[data-aba="importacoes"]').click()`);
  const foiImportacoes = await esperar(`!document.querySelector('[data-tela-nome="importacoes"]').hidden`);
  const hash = await avaliar(`location.hash`);
  registrar('navegação abre Importações', foiImportacoes && hash === '#importacoes', hash);

  // 3b. Diagnóstico da ingestão é real (vem do motor, não é texto fixo).
  const diagnosticoOk = await esperar(
    `document.querySelector('#diagnostico-texto')?.textContent.includes('2026.10.26')`, 10000,
  );
  const textoDiagnostico = await avaliar(`document.querySelector('#diagnostico-texto')?.textContent`);
  registrar('diagnóstico do yt-dlp é exibido', diagnosticoOk, textoDiagnostico);

  // 4. Importação real: resultado com título, canal e legenda.
  await avaliar(`(() => {
    const campo = document.querySelector('#url-video');
    campo.value = 'https://youtu.be/dQw4w9WgXcQ';
    document.querySelector('#formulario-importacao').requestSubmit();
    return true;
  })()`);
  const importou = await esperar(`document.querySelector('#resultado-validacao').dataset.tipo === 'ok'`, 20000);
  const textoImport = await avaliar(`document.querySelector('#resultado-validacao').textContent.trim().slice(0, 120)`);
  const temMetadados =
    textoImport?.includes('Vídeo de demonstração E2E') && textoImport?.includes('legenda manual');
  registrar(
    'importação real traz título, canal e legenda',
    importou === true && temMetadados === true,
    textoImport,
  );

  // 5. Validação de URL: domínio externo é rejeitado com mensagem.
  await avaliar(`(() => {
    const campo = document.querySelector('#url-video');
    campo.value = 'https://exemplo.com/video';
    document.querySelector('#formulario-importacao').requestSubmit();
    return true;
  })()`);
  const rejeita = await esperar(`document.querySelector('#resultado-validacao').dataset.tipo === 'erro'`, 10000);
  const textoRejeita = await avaliar(`document.querySelector('#resultado-validacao').textContent.trim().slice(0, 70)`);
  registrar('URL inválida é rejeitada com mensagem clara', rejeita === true, textoRejeita);

  // 5b. Persistência visível: recarregar a página e o vídeo continua lá.
  await S('Page.navigate', { url: base });
  const recarregou = await esperar(`!!document.querySelector('.aplicativo')`, 20000);
  const linhasAposRecarregar = await esperar(
    `document.querySelectorAll('#corpo-biblioteca tr').length === 1`, 15000,
  );
  const tituloNaTabela = await avaliar(`document.querySelector('#corpo-biblioteca .titulo-video')?.textContent`);
  const canalNaTabela = await avaliar(`document.querySelector('#corpo-biblioteca tr td:nth-child(3)')?.textContent`);
  const duracaoNaTabela = await avaliar(`document.querySelector('#corpo-biblioteca tr td:nth-child(4)')?.textContent`);
  const contadorTexto = await avaliar(`document.querySelector('#contador')?.textContent`);
  registrar(
    'vídeo importado persiste após recarregar a página',
    recarregou && linhasAposRecarregar === true && contadorTexto?.includes('1'),
    `${tituloNaTabela} · ${contadorTexto}`,
  );
  registrar(
    'metadados reais aparecem na Biblioteca',
    canalNaTabela?.includes('Canal E2E') && duracaoNaTabela?.includes('3:32'),
    `canal=${canalNaTabela} · duração=${duracaoNaTabela}`,
  );

  // 5c. Deduplicação visível na UI.
  await avaliar(`document.querySelector('[data-aba="importacoes"]').click()`);
  await esperar(`!document.querySelector('[data-tela-nome="importacoes"]').hidden`);
  await avaliar(`(() => {
    document.querySelector('#url-video').value = 'https://youtu.be/dQw4w9WgXcQ';
    document.querySelector('#formulario-importacao').requestSubmit();
    return true;
  })()`);
  const avisouDuplicata = await esperar(
    `document.querySelector('#resultado-validacao').textContent.includes('Já está na biblioteca')`, 10000,
  );
  registrar('deduplicação é explicada ao usuário', avisouDuplicata === true);

  // 5d. F5-UI: a tela "Leitura" foi absorvida pela Biblioteca. A leitura
  //     acontece na linha; o painel sobreposto é complementar e abre por botão.
  const abaLeituraSumiu = await avaliar(`document.querySelector('[data-aba="leitura"]')===null`);
  registrar('abas principais são Biblioteca, Importações e Configurações', abaLeituraSumiu);

  // Abre o painel pelo botão explícito da miniatura — nunca por selecionar linha.
  await avaliar(`document.querySelector('[data-aba="biblioteca"]').click()`);
  const painelDisponivel = await esperar(`!!document.querySelector('#corpo-biblioteca tr[data-id] .abrir-painel')`, 15000);
  if (!painelDisponivel) throw new Error('botão de abrir painel não apareceu na linha');

  const antesDoClique = await avaliar(`document.querySelector('#painel-leitura').hidden`);
  await avaliar(`document.querySelector('#corpo-biblioteca tr[data-id] input').click()`);
  const selecionarNaoAbre = await avaliar(`document.querySelector('#painel-leitura').hidden`);
  registrar('selecionar a linha não abre o painel', antesDoClique && selecionarNaoAbre);
  await avaliar(`document.querySelector('#limpar-selecao').click()`);

  await avaliar(`document.querySelector('#corpo-biblioteca tr[data-id] .abrir-painel').click()`);
  const segmentosVisiveis = await esperar(
    `document.querySelectorAll('#segmentos-transcricao .segmento').length === 3`, 15000,
  );
  const primeiroTempo = await avaliar(`document.querySelector('.segmento-tempo')?.textContent`);
  const primeiroTexto = await avaliar(`document.querySelector('.segmento-texto')?.textContent`);
  registrar(
    'painel abre com trechos e tempo',
    segmentosVisiveis && primeiroTempo === '0:00' && primeiroTexto?.includes('Bem-vindo'),
    `${primeiroTempo} ${primeiroTexto}`,
  );

  const linkTempo = await avaliar(`document.querySelector('.segmento-tempo')?.href`);
  registrar(
    'tempo do trecho leva ao momento no YouTube',
    typeof linkTempo === 'string' && linkTempo.includes('youtube.com/watch') && linkTempo.includes('t=0s'),
    linkTempo?.slice(0, 60),
  );

  const resumoNoPainel = await avaliar(`document.querySelector('#painel-resumo')?.textContent?.length > 50`);
  const linkOriginal = await avaliar(`document.querySelector('#painel-link')?.href?.startsWith('https://www.youtube.com/watch')`);
  registrar('painel mostra resumo completo e link original', resumoNoPainel && linkOriginal);

  // Fechar devolve ao mesmo contexto: busca, filtros e posição intactos.
  await avaliar(`document.querySelector('#busca').value='Bem-vindo'`);
  await avaliar(`document.querySelector('#busca').dispatchEvent(new Event('input'))`);
  await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='1'`);
  await S('Input.dispatchKeyEvent',{type:'keyDown',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  await S('Input.dispatchKeyEvent',{type:'keyUp',key:'Escape',code:'Escape',windowsVirtualKeyCode:27});
  const contextoPreservado = await esperar(
    `document.querySelector('#painel-leitura').hidden && document.querySelector('#busca').value==='Bem-vindo' && document.querySelector('#biblioteca-viewport').dataset.total==='1'`,
  );
  registrar('fechar o painel preserva busca, filtros e posição', contextoPreservado);
  await avaliar(`document.querySelector('#limpar-filtros').click()`);
  await esperar(`document.querySelector('#biblioteca-viewport').dataset.total==='1'`);

  // 6. Configurações vêm do motor.
  await avaliar(`document.querySelector('[data-aba="configuracoes"]').click()`);
  const configCarregou = await esperar(`document.querySelectorAll('#lista-config dt').length >= 3`);
  const primeiroRotulo = await avaliar(`document.querySelector('#lista-config dt')?.textContent`);
  registrar('configurações listam valores reais do motor', configCarregou, primeiroRotulo);

  // 7. Tema escuro aplicado de fato (não basta declarar no CSS).
  const fundo = await avaliar(`getComputedStyle(document.body).backgroundColor`);
  const azul = await avaliar(`getComputedStyle(document.querySelector('.marca-simbolo')).backgroundImage.includes('76, 154, 255')`);
  // F5-UI: o grafite de fundo ficou mais profundo para casar com o mockup
  // (#080b12). O teste guarda o VALOR, não um número solto: mudar o tema exige
  // mudar o teste de propósito.
  registrar('tema grafite escuro com detalhe azul aplicado', fundo === 'rgb(8, 11, 18)' && azul === true, `${fundo} / azul=${azul}`);

  // 8. Console sem erros de script.
  const erros = errosJs.length;
  registrar('sem erro de script na página', !erros);

  // 9. Captura de tela como evidência.
  await avaliar(`document.querySelector('[data-aba="biblioteca"]').click()`);
  await dormir(600);
  const captura = await S('Page.captureScreenshot', { format: 'png' });
  const pastaEvidencia = join(raiz, 'testes', '.tmp');
  mkdirSync(pastaEvidencia, { recursive: true });
  const arquivo = join(pastaEvidencia, 'interface-biblioteca.png');
  writeFileSync(arquivo, Buffer.from(captura.data, 'base64'));
  registrar('captura de evidência gerada', existsSync(arquivo), arquivo);
  // F4: exercer ações pelo DOM, mantendo as respostas externas controladas.
  await avaliar(`document.querySelector('[data-aba="importacoes"]').click()`);
  bloqueadosE2e.add('aaaaaaaaaaa');
  await avaliar(`document.querySelector('#url-video').value='https://youtu.be/aaaaaaaaaaa';document.querySelector('#formulario-importacao').requestSubmit()`);
  const aceitouFila = await esperar(`document.querySelector('#resultado-validacao').textContent.includes('Adicionado à fila') && !document.querySelector('#botao-importar').disabled`);
  const pausado = await avaliar(`fetch('/api/trabalhos?raizes=1&limite=1').then(r=>r.json()).then(r=>r.dados.itens[0].id)`);
  const faseReal = await esperar(`document.querySelector('.trabalho[data-id="${pausado}"]')?.textContent.includes('Buscando metadados')`);
  registrar('fila aceita sem esperar a rede e exibe fase real', aceitouFila && faseReal);
  await avaliar(`document.querySelector('[data-aba="biblioteca"]').click()`);
  registrar('Biblioteca continua navegável durante trabalho bloqueado', await avaliar(`!document.querySelector('[data-tela-nome="biblioteca"]').hidden`));
  await S('Page.navigate', { url: base + '/#importacoes' });
  const sobreviveReload = await esperar(`document.querySelector('.trabalho[data-id="${pausado}"]')?.textContent.includes('Executando')`);
  registrar('trabalho ativo reaparece depois de recarregar a interface', sobreviveReload);
  await avaliar(`document.querySelector('.trabalho[data-id="${pausado}"] [data-acao="cancelar"]').click()`);
  registrar('Cancelar pela interface encerra o trabalho', await esperar(`document.querySelector('.trabalho[data-id="${pausado}"]')?.textContent.includes('Cancelado')`));
  bloqueadosE2e.delete('aaaaaaaaaaa');
  await avaliar(`document.querySelector('.trabalho[data-id="${pausado}"] [data-acao="repetir"]').click()`);
  const repetiu = await esperar(`document.querySelector('.trabalho[data-id="${pausado}"]')?.textContent.includes('Concluído') && document.querySelector('.trabalho[data-id="${pausado}"]')?.textContent.includes('tentativa 2')`);
  registrar('Repetir pela interface usa o mesmo trabalho e nova tentativa', repetiu);

  await avaliar(`document.querySelector('#tipo-importacao').value='importar-playlist';document.querySelector('#url-video').value='https://youtube.com/playlist?list=PLteste';document.querySelector('#formulario-importacao').requestSubmit()`);
  await esperar(`document.querySelector('#resultado-validacao').textContent.includes('Importação concluída: 2 itens')`);
  const playlistId = await avaliar(`fetch('/api/trabalhos?raizes=1&limite=1').then(r=>r.json()).then(r=>r.dados.itens[0].id)`);
  const contou = await esperar(`document.querySelector('.trabalho[data-id="${playlistId}"]')?.textContent.includes('1 sem legenda')`);
  await avaliar(`document.querySelector('.trabalho[data-id="${playlistId}"] details').open=true`);
  const filhos = await esperar(`document.querySelectorAll('.trabalho[data-id="${playlistId}"] .trabalho').length===2`);
  registrar('playlist exibe filhos e ausência explícita de legenda', contou && filhos);

  falhasE2e.add('ccccccccccc');
  await avaliar(`document.querySelector('#tipo-importacao').value='importar-video';document.querySelector('#url-video').value='https://youtu.be/ccccccccccc';document.querySelector('#formulario-importacao').requestSubmit()`);
  await esperar(`document.querySelector('#resultado-validacao').dataset.tipo==='erro'`);
  const falhoId = await avaliar(`fetch('/api/trabalhos?raizes=1&limite=1').then(r=>r.json()).then(r=>r.dados.itens[0].id)`);
  registrar('falha de legenda aparece como falha recuperável na fila', await esperar(`document.querySelector('.trabalho[data-id="${falhoId}"]')?.textContent.includes('Falhou')`));
  await avaliar(`document.querySelector('.trabalho[data-id="${falhoId}"] [data-acao="repetir"]').click()`);
  registrar('retry após erro termina sem duplicar vídeo', await esperar(`document.querySelector('.trabalho[data-id="${falhoId}"]')?.textContent.includes('Concluído') && document.querySelector('.trabalho[data-id="${falhoId}"]')?.textContent.includes('tentativa 2')`));
  const totalFinal = await avaliar(`fetch('/api/biblioteca').then(r=>r.json()).then(r=>r.dados.total)`);
  registrar('biblioteca tem somente os quatro vídeos únicos', totalFinal === 4, String(totalFinal));
  const capturaF4 = await S('Page.captureScreenshot', { format: 'png' });
  writeFileSync(join(raiz,'testes','.tmp','interface-fila.png'),Buffer.from(capturaF4.data,'base64'));

  await exercitarBiblioteca({ app, base, avaliar, esperar, S, registrar, raiz });
  registrar('nenhuma exceção JavaScript durante todos os fluxos de navegador', errosJs.length === 0, errosJs.join('; '));
} catch (erro) {
  registrar('execução E2E sem exceção', false, erro.message);
} finally {
  try {
    ws.close();
  } catch {}
  navegador.kill('SIGKILL');
  await app.encerrar();
}

const falhas = resultados.filter((r) => !r.ok);
console.log(`\n${resultados.length - falhas.length}/${resultados.length} cenários OK`);
process.exit(falhas.length === 0 ? 0 : 1);
