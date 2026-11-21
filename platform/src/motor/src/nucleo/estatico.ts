/**
 * Servidor de arquivos estáticos da interface.
 *
 * Segurança: resolve o caminho e confirma que ele continua dentro da pasta pública.
 * Qualquer tentativa de sair com `..` resulta em 404, não em leitura arbitrária.
 */
import { createReadStream, statSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import type { ServerResponse } from 'node:http';
import { extname, join, normalize, resolve, sep } from 'node:path';

const TIPOS: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
};

export interface ResultadoEstatico {
  /** Caminho absoluto resolvido, ou null se inexistente/fora da raiz. */
  arquivo: string | null;
}

export function resolverArquivoPublico(raiz: string, caminhoUrl: string): ResultadoEstatico {
  const limpo = normalize(decodeURIComponent(caminhoUrl)).replace(/^(\.\.[/\\])+/, '');
  const relativo = limpo === '/' || limpo === '.' ? 'index.html' : limpo.replace(/^[/\\]+/, '');

  const base = resolve(raiz);
  const alvo = resolve(join(base, relativo));

  // Confirma contenção: o alvo precisa estar dentro da raiz pública.
  if (alvo !== base && !alvo.startsWith(base + sep)) return { arquivo: null };

  try {
    const info = statSync(alvo);
    if (info.isDirectory()) {
      const indice = join(alvo, 'index.html');
      statSync(indice);
      return { arquivo: indice };
    }
    return { arquivo: alvo };
  } catch {
    return { arquivo: null };
  }
}

export async function servirEstatico(
  raiz: string,
  caminhoUrl: string,
  res: ServerResponse,
  fallbackHtml?: () => Promise<string>,
): Promise<boolean> {
  const { arquivo } = resolverArquivoPublico(raiz, caminhoUrl);
  if (!arquivo) return false;

  const tipo = TIPOS[extname(arquivo).toLowerCase()] ?? 'application/octet-stream';
  // `no-cache` obriga a revalidar, mas o navegador ainda pode reusar uma
  // resposta de outra sessão do preview. Para a interface (HTML/CSS/JS), que
  // não é asset imutável, `no-store` é o cabeçalho honesto: cada abertura
  // recebe o arquivo atual. Foi um CSS antigo em cache que fez uma correção
  // já publicada continuar aparecendo com o defeito.
  const imutavel = /\.(png|svg|woff2|ico)$/i.test(arquivo);
  res.writeHead(200, {
    'content-type': tipo,
    'cache-control': imutavel ? 'public, max-age=86400' : 'no-store',
  });

  if (fallbackHtml && extname(arquivo) === '.html') {
    res.end(await fallbackHtml());
    return true;
  }

  await new Promise<void>((ok, falhou) => {
    const fluxo = createReadStream(arquivo);
    fluxo.on('error', (e) => falhou(e));
    fluxo.on('end', () => ok());
    fluxo.pipe(res);
  });
  return true;
}

/** Lê um arquivo de texto da interface (usado no fallback de SPA). */
export async function lerArquivoPublico(raiz: string, relativo: string): Promise<string> {
  const { arquivo } = resolverArquivoPublico(raiz, relativo);
  if (!arquivo) throw new Error(`arquivo público ausente: ${relativo}`);
  return readFile(arquivo, 'utf8');
}
