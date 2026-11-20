import type { Migracao } from './banco.ts';

const colecoes = (id: string) => `UPDATE videos SET colecao_ids = (
  SELECT json_group_array(colecao_id) FROM (
    SELECT colecao_id FROM colecao_videos WHERE video_id = ${id} ORDER BY colecao_id
  )) WHERE id = ${id};`;
const resumos = (id: string) => `UPDATE videos SET tem_resumo = EXISTS(
  SELECT 1 FROM resumos WHERE video_id = ${id} AND estado = 'pronto'
) WHERE id = ${id};`;

export const MIGRACAO_F5_PROJECOES: Migracao = {
  versao: 4,
  descricao: 'reconcilia projecoes da Biblioteca a partir de vinculos e resumos canonicos',
  aplicar(db) {
    db.exec(`
      CREATE INDEX idx_trabalhos_youtube ON trabalhos(youtube_id);
      UPDATE videos SET colecao_ids = (SELECT json_group_array(colecao_id) FROM (
        SELECT colecao_id FROM colecao_videos WHERE video_id=videos.id ORDER BY colecao_id
      )), tem_resumo = EXISTS(SELECT 1 FROM resumos WHERE video_id=videos.id AND estado='pronto');
      CREATE TRIGGER biblioteca_colecao_inserida AFTER INSERT ON colecao_videos BEGIN ${colecoes('NEW.video_id')} END;
      CREATE TRIGGER biblioteca_colecao_removida AFTER DELETE ON colecao_videos BEGIN ${colecoes('OLD.video_id')} END;
      CREATE TRIGGER biblioteca_colecao_alterada AFTER UPDATE ON colecao_videos BEGIN ${colecoes('OLD.video_id')} ${colecoes('NEW.video_id')} END;
      CREATE TRIGGER biblioteca_resumo_inserido AFTER INSERT ON resumos BEGIN ${resumos('NEW.video_id')} END;
      CREATE TRIGGER biblioteca_resumo_removido AFTER DELETE ON resumos BEGIN ${resumos('OLD.video_id')} END;
      CREATE TRIGGER biblioteca_resumo_alterado AFTER UPDATE ON resumos BEGIN ${resumos('OLD.video_id')} ${resumos('NEW.video_id')} END;
    `);
  },
  reverter(db) {
    db.exec(`DROP INDEX idx_trabalhos_youtube;
      DROP TRIGGER biblioteca_colecao_inserida; DROP TRIGGER biblioteca_colecao_removida;
      DROP TRIGGER biblioteca_colecao_alterada; DROP TRIGGER biblioteca_resumo_inserido;
      DROP TRIGGER biblioteca_resumo_removido; DROP TRIGGER biblioteca_resumo_alterado;`);
  },
};
