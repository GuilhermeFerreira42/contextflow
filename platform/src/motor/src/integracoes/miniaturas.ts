/**
 * Cópia local das miniaturas.
 *
 * O yt-dlp é chamado com `--skip-download`: o projeto não guarda vídeo. A
 * consequência é que a capa fica sendo uma URL do CDN do YouTube, e essas URLs
 * expiram/respondem 403 — foi o que deixou linhas sem imagem na Biblioteca.
 *
 * Aqui baixamos só a **capa** (uma imagem pequena), guardamos em
 * `<dados>/miniaturas/` e servimos pela própria origem. Isso resolve três
 * coisas de uma vez:
 *  - funciona offline depois da primeira busca;
 *  - a Biblioteca nunca depende de o CDN liberar a origem;
 *  - o navegador não faz requisição a terceiros ao abrir a lista.
 *
 * Limites deliberados: timeout curto, tamanho máximo, só `image/*`, só
 * `http(s)`, e uma tentativa por pedido — falha vira `registrarFalha` e o
 * cliente não fica insistindo.
 */
import { createHash } from 'node:crypto';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RepositorioMiniaturas } from '../persistencia/repositorio-miniaturas.ts';

const TIMEOUT_MS = 6000;
const TAMANHO_MAXIMO = 4 * 1024 * 1024; // 4 MB — capa de vídeo não passa disso
const TIPOS = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** Nome estável e seguro: hash do id, extensão pelo content-type. */
function nomeArquivo(videoId: string, contentType: string): string {
  const extensao = contentType === 'image/png' ? 'png'
    : contentType === 'image/webp' ? 'webp'
      : contentType === 'image/gif' ? 'gif' : 'jpg';
  const hash = createHash('sha1').update(videoId).digest('hex').slice(0, 16);
  return `${hash}.${extensao}`;
}

export function pastaMiniaturas(pastaDados: string): string {
  return join(pastaDados, 'miniaturas');
}

/** Busca o arquivo local, se houver. Lê em memória: são poucos KB. */
export async function lerMiniaturaLocal(pastaDados: string, arquivo: string): Promise<Buffer | null> {
  if (!/^[a-f0-9]{8,64}\.(jpg|png|webp|gif)$/.test(arquivo)) return null;
  try {
    return await readFile(join(pastaMiniaturas(pastaDados), arquivo));
  } catch {
    return null;
  }
}

export async function apagarMiniaturaLocal(pastaDados: string, arquivo: string | null): Promise<void> {
  if (!arquivo || !/^[a-f0-9]{8,64}\.(jpg|png|webp|gif)$/.test(arquivo)) return;
  await rm(join(pastaMiniaturas(pastaDados), arquivo), { force: true });
}

/**
 * Baixa `url` e grava como capa do vídeo.
 *
 * Devolve o registro gravado, ou o motivo da falha. Nunca lança: miniatura
 * ausente é um estado esperado, não um erro de fluxo.
 */
export async function baixarMiniatura(
  pastaDados: string,
  repositorio: RepositorioMiniaturas,
  videoId: string,
  url: string,
): Promise<{ ok: true; arquivo: string; contentType: string } | { ok: false; motivo: string }> {
  let destino: URL;
  try {
    destino = new URL(url);
  } catch {
    repositorio.registrarFalha(videoId, 'URL de miniatura inválida');
    return { ok: false, motivo: 'URL inválida' };
  }
  if (!/^https?:$/.test(destino.protocol)) {
    repositorio.registrarFalha(videoId, 'protocolo não permitido');
    return { ok: false, motivo: 'protocolo não permitido' };
  }

  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), TIMEOUT_MS);
  try {
    const resposta = await fetch(destino, {
      signal: controle.signal,
      redirect: 'follow',
      headers: { accept: 'image/avif,image/webp,image/*;q=0.9,*/*;q=0.5' },
    });
    if (!resposta.ok) {
      repositorio.registrarFalha(videoId, `HTTP ${resposta.status}`);
      return { ok: false, motivo: `HTTP ${resposta.status}` };
    }
    const tipo = (resposta.headers.get('content-type') ?? '').split(';')[0]?.trim().toLowerCase() || '';
    if (!TIPOS.has(tipo)) {
      repositorio.registrarFalha(videoId, `tipo não suportado: ${tipo || 'desconhecido'}`);
      return { ok: false, motivo: 'tipo não suportado' };
    }
    const tamanho = Number(resposta.headers.get('content-length') ?? '0');
    if (tamanho > TAMANHO_MAXIMO) {
      repositorio.registrarFalha(videoId, 'imagem grande demais');
      return { ok: false, motivo: 'imagem grande demais' };
    }
    const bytes = Buffer.from(await resposta.arrayBuffer());
    if (!bytes.length) {
      repositorio.registrarFalha(videoId, 'imagem vazia');
      return { ok: false, motivo: 'imagem vazia' };
    }
    if (bytes.length > TAMANHO_MAXIMO) {
      repositorio.registrarFalha(videoId, 'imagem grande demais');
      return { ok: false, motivo: 'imagem grande demais' };
    }

    const arquivo = nomeArquivo(videoId, tipo);
    await mkdir(pastaMiniaturas(pastaDados), { recursive: true });
    await writeFile(join(pastaMiniaturas(pastaDados), arquivo), bytes);
    repositorio.registrarSucesso(videoId, {
      arquivo, contentType: tipo, bytes: bytes.length, origem: destino.origin,
    });
    return { ok: true, arquivo, contentType: tipo };
  } catch (erro) {
    const motivo = erro instanceof Error && erro.name === 'AbortError'
      ? 'tempo esgotado'
      : erro instanceof Error ? erro.message : 'falha de rede';
    repositorio.registrarFalha(videoId, motivo);
    return { ok: false, motivo };
  } finally {
    clearTimeout(relogio);
  }
}
