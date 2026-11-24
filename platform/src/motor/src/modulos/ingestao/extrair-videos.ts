import { ErroValidacao } from '../../nucleo/erros.ts';
import { normalizarUrlVideo } from './servico.ts';

export function extrairVideos(entrada: unknown) {
  if (typeof entrada !== 'string' || !entrada.trim()) {
    throw new ErroValidacao('Cole uma lista ou um texto com links de vídeos do YouTube.');
  }
  const urls = new Set<string>();
  let linhasIgnoradas = 0;
  let duplicatas = 0;
  for (const linha of entrada.split(/\r\n?|\n/)) {
    if (!linha.trim()) continue;
    let temVideo = false;
    for (const [trecho] of linha.matchAll(/https?:\/\/[^\s<>"'|()[\]{}\x60]+/gi)) {
      let normalizada: string;
      try {
        const candidata = new URL(trecho.replace(/[.,;!?]+$/u, ''));
        if (candidata.username || candidata.password || candidata.port) continue;
        normalizada = normalizarUrlVideo(candidata.href).url;
      } catch (erro) {
        if (!(erro instanceof TypeError || erro instanceof ErroValidacao)) throw erro;
        continue;
      }
      temVideo = true;
      if (urls.has(normalizada)) duplicatas++;
      else urls.add(normalizada);
    }
    if (!temVideo) linhasIgnoradas++;
  }
  if (!urls.size) throw new ErroValidacao('Nenhum link de vídeo do YouTube foi encontrado no texto.');
  return { urls: [...urls], lote: { videos: urls.size, linhasIgnoradas, duplicatas } };
}
