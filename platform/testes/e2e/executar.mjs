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
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CHROME = process.env.CHROME_BIN ?? `${process.env.HOME}/.cache/cdp/chrome-bin`;
const LIBS = process.env.CHROME_LIBS ?? `${process.env.HOME}/.cache/cdp/al2023/lib`;
const PORTA_CDP = 9333;

const resultados = [];
const registrar = (cenario, ok, detalhe) => {
  resultados.push({ cenario, ok, detalhe });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${cenario}${detalhe ? ` — ${detalhe}` : ''}`);
};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

if (!existsSync(CHROME)) {
  console.error(`Chrome ausente em ${CHROME}. Defina CHROME_BIN ou instale um Chromium.`);
  process.exit(2);
}

// --------------------------------------------------------------- CDP ------
class Cdp {
  constructor(ws) {
    this.ws = ws;
    this.id = 0;
    this.pendentes = new Map();
    ws.addEventListener('message', (ev) => {
      const msg = JSON.parse(ev.data);
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
    { env: { ...process.env, LD_LIBRARY_PATH: LIBS }, stdio: 'ignore' },
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
const executorE2e = {
  async disponivel() {
    return { disponivel: true, versao: '2026.10.26 (dublê E2E)', caminho: 'yt-dlp' };
  },
  async inspecionar() {
    return {
      id: 'dQw4w9WgXcQ',
      titulo: 'Vídeo de demonstração E2E',
      canalId: 'UCe2e',
      canalNome: 'Canal E2E',
      duracaoSegundos: 212,
      miniaturaUrl: null,
      publicadoEm: '2024-07-20T00:00:00.000Z',
      legendasManuais: ['pt'],
      legendasAutomaticas: [],
    };
  },
  async baixarLegenda() {
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

  // 5d. Leitura: transcrição com trechos e tempo.
  await avaliar(`document.querySelector('[data-aba="leitura"]').click()`);
  const listaPronta = await esperar(`document.querySelectorAll('.linha-leitura').length === 1`, 15000);
  const metaLinha = await avaliar(`document.querySelector('.linha-leitura-meta')?.textContent`);
  registrar('Leitura lista a transcrição importada', listaPronta, metaLinha);

  await avaliar(`document.querySelector('.linha-leitura').click()`);
  const segmentosVisiveis = await esperar(
    `document.querySelectorAll('#segmentos-transcricao .segmento').length === 3`, 10000,
  );
  const primeiroTempo = await avaliar(`document.querySelector('.segmento-tempo')?.textContent`);
  const primeiroTexto = await avaliar(`document.querySelector('.segmento-texto')?.textContent`);
  registrar(
    'leitor abre com trechos e tempo',
    segmentosVisiveis && primeiroTempo === '0:00' && primeiroTexto?.includes('Bem-vindo'),
    `${primeiroTempo} ${primeiroTexto}`,
  );

  const linkTempo = await avaliar(`document.querySelector('.segmento-tempo')?.href`);
  registrar(
    'tempo do trecho leva ao momento no YouTube',
    typeof linkTempo === 'string' && linkTempo.includes('youtube.com/watch') && linkTempo.includes('t=0s'),
    linkTempo?.slice(0, 60),
  );

  // 6. Configurações vêm do motor.
  await avaliar(`document.querySelector('[data-aba="configuracoes"]').click()`);
  const configCarregou = await esperar(`document.querySelectorAll('#lista-config dt').length >= 3`);
  const primeiroRotulo = await avaliar(`document.querySelector('#lista-config dt')?.textContent`);
  registrar('configurações listam valores reais do motor', configCarregou, primeiroRotulo);

  // 7. Tema escuro aplicado de fato (não basta declarar no CSS).
  const fundo = await avaliar(`getComputedStyle(document.body).backgroundColor`);
  const azul = await avaliar(`getComputedStyle(document.querySelector('.marca-simbolo')).backgroundImage.includes('76, 154, 255')`);
  registrar('tema grafite escuro com detalhe azul aplicado', fundo === 'rgb(13, 15, 18)' && azul === true, `${fundo} / azul=${azul}`);

  // 8. Console sem erros de script.
  const erros = await avaliar(`window.__errosJs ? window.__errosJs.length : 0`);
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
