import type { Migracao } from './banco.ts';
export const MIGRACAO_TRABALHOS: Migracao = {
    versao: 2,
    descricao: 'fila persistente, tentativas, idempotencia e lease',
    aplicar(db) {
        db.exec(`
      ALTER TABLE transcricoes ADD COLUMN codigo_motivo TEXT;
      CREATE TABLE trabalhos (
        id TEXT PRIMARY KEY, tipo TEXT NOT NULL,
        estado TEXT NOT NULL CHECK(estado IN ('na-fila','executando','concluido','falhou','cancelado')),
        escopo TEXT NOT NULL, youtube_id TEXT, pai_id TEXT REFERENCES trabalhos(id),
        fase TEXT NOT NULL DEFAULT 'aguardando', tentativas INTEGER NOT NULL DEFAULT 0,
        progresso REAL, erro TEXT, erro_codigo TEXT, erro_http INTEGER, resultado TEXT,
        cancelamento INTEGER NOT NULL DEFAULT 0, descoberto INTEGER NOT NULL DEFAULT 0,
        dono TEXT, geracao INTEGER NOT NULL DEFAULT 0,
        criado_em TEXT NOT NULL, atualizado_em TEXT NOT NULL,
        iniciado_em TEXT, finalizado_em TEXT
      );
      CREATE INDEX idx_fila ON trabalhos(estado,criado_em,id);
      CREATE INDEX idx_trabalhos_pai ON trabalhos(pai_id);
      CREATE UNIQUE INDEX idx_filho_video ON trabalhos(pai_id,youtube_id) WHERE pai_id IS NOT NULL AND youtube_id IS NOT NULL;
      CREATE TABLE tentativas_trabalho (
        trabalho_id TEXT NOT NULL REFERENCES trabalhos(id), numero INTEGER NOT NULL,
        iniciado_em TEXT NOT NULL, finalizado_em TEXT, estado TEXT, erro TEXT,
        PRIMARY KEY(trabalho_id,numero)
      );
      CREATE TABLE requisicoes_trabalho (
        chave TEXT PRIMARY KEY, operacao TEXT NOT NULL, corpo_hash TEXT NOT NULL,
        trabalho_id TEXT NOT NULL REFERENCES trabalhos(id)
      );
      CREATE TABLE executor_fila (id INTEGER PRIMARY KEY CHECK(id=1), dono TEXT NOT NULL, expira INTEGER NOT NULL);
    `);
    },
    reverter(db) {
        db.exec(`DROP TABLE requisicoes_trabalho; DROP TABLE tentativas_trabalho;
      DROP TABLE executor_fila; DROP TABLE trabalhos;
      ALTER TABLE transcricoes DROP COLUMN codigo_motivo;`);
    },
};
