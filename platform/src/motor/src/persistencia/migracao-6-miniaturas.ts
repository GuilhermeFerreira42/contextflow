import type { Driver, Migracao } from './banco.ts';

/**
 * Migração 6: cache local das miniaturas.
 *
 * Por que existe: o motor roda o yt-dlp com `--skip-download`, então nunca
 * guarda mídia — `videos.miniatura_url` é a URL remota do CDN. Quando ela
 * expira, o vídeo fica privado ou a rede bloqueia o `i.ytimg.com`, a imagem
 * não carrega e a linha fica com o substituto. Esta tabela guarda uma cópia
 * pequena (uma imagem por vídeo), já redimensionada pelo próprio CDN, para
 * que a Biblioteca abra com miniatura mesmo sem rede depois da primeira vez.
 *
 * O que NÃO entra aqui: vídeo, áudio, transcrição. Só a capa.
 *
 * `falha`/`tentativas` evitam laço: se o CDN recusou a imagem, a UI não fica
 * pedindo de novo a cada rolagem; ela volta a tentar só depois de um intervalo
 * (ou quando o usuário reimportar o vídeo, que troca `origem`).
 */
export const MIGRACAO_6_MINIATURAS: Migracao = {
  versao: 6,
  descricao: 'cache local das miniaturas para a biblioteca abrir sem depender do CDN',
  aplicar(db) {
    db.exec(`
      CREATE TABLE miniaturas (
        video_id TEXT PRIMARY KEY REFERENCES videos(id) ON DELETE CASCADE,
        arquivo TEXT,
        content_type TEXT,
        bytes INTEGER,
        origem TEXT,
        buscado_em TEXT,
        falha TEXT,
        tentativas INTEGER NOT NULL DEFAULT 0,
        atualizado_em TEXT NOT NULL
      );
      CREATE INDEX miniaturas_pendentes ON miniaturas(buscado_em);
    `);
  },
  reverter(db) {
    // Nada de dado do usuário aqui: só cache. Descartar é seguro e o próximo
    // acesso baixa de novo.
    db.exec('DROP INDEX IF EXISTS miniaturas_pendentes; DROP TABLE IF EXISTS miniaturas;');
  },
};
