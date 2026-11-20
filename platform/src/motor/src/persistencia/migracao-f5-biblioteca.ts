import type { Migracao } from './banco.ts';

export const MIGRACAO_F5_BIBLIOTECA: Migracao = {
  versao: 3,
  descricao: 'campos tem_resumo e colecao_ids em videos; indices para filtros',
  aplicar(db) {
    db.exec(`
      ALTER TABLE videos ADD COLUMN tem_resumo INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE videos ADD COLUMN colecao_ids TEXT NOT NULL DEFAULT '[]';
      CREATE INDEX idx_videos_tem_resumo ON videos(tem_resumo);
      CREATE INDEX idx_videos_colecao_ids ON videos(colecao_ids);
    `);
  },
  reverter(db) {
    db.exec(`
      DROP INDEX IF EXISTS idx_videos_colecao_ids;
      DROP INDEX IF EXISTS idx_videos_tem_resumo;
      ALTER TABLE videos DROP COLUMN colecao_ids;
      ALTER TABLE videos DROP COLUMN tem_resumo;
    `);
  },
};