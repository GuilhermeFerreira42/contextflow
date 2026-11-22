import type { Driver, Migracao } from './banco.ts';

function trocarTabela(db: Driver, revisoes: boolean): void {
  db.exec(`
    DROP TRIGGER biblioteca_resumo_inserido;
    DROP TRIGGER biblioteca_resumo_removido;
    DROP TRIGGER biblioteca_resumo_alterado;
    CREATE TABLE resumos_novos (
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      provedor TEXT NOT NULL, modelo TEXT NOT NULL, versao_prompt TEXT NOT NULL,
      revisao_transcricao TEXT NOT NULL, texto TEXT,
      estado TEXT NOT NULL CHECK(estado IN ('pendente','processando','pronto','erro')),
      erro TEXT, criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL,
      PRIMARY KEY(video_id,provedor,modelo,versao_prompt${revisoes ? ',revisao_transcricao' : ''})
    );
    INSERT INTO resumos_novos SELECT * FROM resumos;
    DROP TABLE resumos;
    ALTER TABLE resumos_novos RENAME TO resumos;
  `);
  const atualizar = (id: string) => `UPDATE videos SET tem_resumo=EXISTS(SELECT 1 FROM resumos WHERE video_id=${id} AND estado='pronto') WHERE id=${id};`;
  db.exec(`
    CREATE TRIGGER biblioteca_resumo_inserido AFTER INSERT ON resumos BEGIN ${atualizar('NEW.video_id')} END;
    CREATE TRIGGER biblioteca_resumo_removido AFTER DELETE ON resumos BEGIN ${atualizar('OLD.video_id')} END;
    CREATE TRIGGER biblioteca_resumo_alterado AFTER UPDATE ON resumos BEGIN ${atualizar('OLD.video_id')} ${atualizar('NEW.video_id')} END;
  `);
}

export const MIGRACAO_F6_RESUMOS: Migracao = {
  versao: 5, descricao: 'historico de resumos por revisao e snapshots duraveis de geracao',
  aplicar(db) {
    trocarTabela(db, true);
    db.exec(`CREATE TABLE resumos_execucoes (
      trabalho_id TEXT PRIMARY KEY REFERENCES trabalhos(id),
      video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
      snapshot TEXT NOT NULL, uso TEXT, criado_em TEXT NOT NULL
    );`);
  },
  reverter(db) {
    if (db.prepare("SELECT 1 FROM trabalhos WHERE tipo='gerar-resumo' LIMIT 1").get()
      || db.prepare('SELECT 1 FROM resumos GROUP BY video_id,provedor,modelo,versao_prompt HAVING COUNT(*)>1').get()) {
      throw new Error('Reversão perderia histórico F6. Restaure o backup anterior à migração.');
    }
    db.exec('DROP TABLE resumos_execucoes');
    trocarTabela(db, false);
  },
};
