/**
 * Conexão com o banco e motor de migrações.
 *
 * Este é o ÚNICO ponto que conhece o driver. Todo o resto fala por repositório.
 * Migrações são append-only, aplicadas em transação e idempotentes.
 */
import { DatabaseSync } from 'node:sqlite';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { randomUUID } from 'node:crypto';
import { MIGRACAO_TRABALHOS } from './migracao-trabalhos.ts';
import { MIGRACAO_F5_BIBLIOTECA } from './migracao-f5-biblioteca.ts';
import { MIGRACAO_F5_PROJECOES } from './migracao-f5-projecoes.ts';
import { MIGRACAO_F6_RESUMOS } from './migracao-f6-resumos.ts';

/**
 * Tipo mínimo do driver, para os repositórios não dependerem do pacote do Node.
 * `node:sqlite` expõe `prepare/exec/close`; o restante é usado via adaptador.
 */
export type Driver = DatabaseSync;

export interface Migracao {
  versao: number;
  descricao: string;
  aplicar(db: Driver): void;
  reverter(db: Driver): void;
}

/**
 * Migração 1: schema inicial da biblioteca.
 *
 * Identidade interna (`videos.id`) é imutável e independente do YouTube.
 * `youtube_id` é UNIQUE: é o que garante deduplicação na importação.
 */
const MIGRACAO_1: Migracao = {
  versao: 1,
  descricao: 'schema inicial: videos, transcricoes, segmentos, resumos, colecoes',
  aplicar(db) {
    db.exec(`
      CREATE TABLE videos (
        id                 TEXT PRIMARY KEY,
        youtube_id         TEXT NOT NULL UNIQUE,
        titulo             TEXT NOT NULL,
        canal_id           TEXT,
        canal_nome         TEXT,
        duracao_segundos   INTEGER,
        url                TEXT NOT NULL,
        miniatura_url      TEXT,
        publicado_em       TEXT,
        estado             TEXT NOT NULL CHECK (estado IN ('novo','importando','pronto','parcial','erro')),
        criado_em          TEXT NOT NULL,
        atualizado_em      TEXT NOT NULL
      );

      CREATE INDEX idx_videos_criado ON videos(criado_em DESC);
      CREATE INDEX idx_videos_estado ON videos(estado);
      CREATE INDEX idx_videos_canal  ON videos(canal_id);

      CREATE TABLE transcricoes (
        id            TEXT PRIMARY KEY,
        video_id      TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        idioma        TEXT NOT NULL,
        origem        TEXT NOT NULL CHECK (origem IN ('manual','auto','importado')),
        estado        TEXT NOT NULL CHECK (estado IN ('pendente','pronta','indisponivel','erro')),
        motivo        TEXT,
        atualizado_em TEXT NOT NULL,
        UNIQUE (video_id, idioma)
      );

      CREATE TABLE segmentos (
        transcricao_id TEXT NOT NULL REFERENCES transcricoes(id) ON DELETE CASCADE,
        ordem          INTEGER NOT NULL,
        inicio_ms      INTEGER NOT NULL,
        fim_ms         INTEGER NOT NULL,
        texto          TEXT NOT NULL,
        PRIMARY KEY (transcricao_id, ordem),
        CHECK (fim_ms >= inicio_ms)
      );

      CREATE TABLE resumos (
        video_id             TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        provedor             TEXT NOT NULL,
        modelo               TEXT NOT NULL,
        versao_prompt        TEXT NOT NULL,
        revisao_transcricao  TEXT NOT NULL,
        texto                TEXT,
        estado               TEXT NOT NULL CHECK (estado IN ('pendente','processando','pronto','erro')),
        erro                 TEXT,
        criado_em            TEXT NOT NULL,
        atualizado_em        TEXT NOT NULL,
        PRIMARY KEY (video_id, provedor, modelo, versao_prompt)
      );

      CREATE TABLE colecoes (
        id     TEXT PRIMARY KEY,
        titulo TEXT NOT NULL
      );

      CREATE TABLE colecao_videos (
        colecao_id TEXT NOT NULL REFERENCES colecoes(id) ON DELETE CASCADE,
        video_id   TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
        PRIMARY KEY (colecao_id, video_id)
      );
    `);
  },
  reverter(db) {
    db.exec(`
      DROP TABLE IF EXISTS colecao_videos;
      DROP TABLE IF EXISTS colecoes;
      DROP TABLE IF EXISTS resumos;
      DROP TABLE IF EXISTS segmentos;
      DROP TABLE IF EXISTS transcricoes;
      DROP TABLE IF EXISTS videos;
    `);
  },
};

export const MIGRACOES: readonly Migracao[] = [MIGRACAO_1, MIGRACAO_TRABALHOS, MIGRACAO_F5_BIBLIOTECA, MIGRACAO_F5_PROJECOES, MIGRACAO_F6_RESUMOS];

export interface OpcoesBanco {
  /** Caminho do arquivo. `:memory:` é aceito para testes. */
  arquivo: string;
}

export class Banco {
  readonly db: Driver;
  readonly #arquivo: string;

  private constructor(db: Driver, arquivo: string) {
    this.db = db;
    this.#arquivo = arquivo;
  }

  static abrir(opcoes: OpcoesBanco): Banco {
    if (opcoes.arquivo !== ':memory:') {
      const pasta = dirname(opcoes.arquivo);
      if (!existsSync(pasta)) mkdirSync(pasta, { recursive: true, mode: 0o700 });
    }

    const db = new DatabaseSync(opcoes.arquivo);
    // WAL: leitura concorrente com escrita. synchronous NORMAL: durável o suficiente
    // para app local, sem o custo de fsync completo a cada transação.
    if (opcoes.arquivo !== ':memory:') db.exec('PRAGMA journal_mode = WAL');
    db.exec('PRAGMA synchronous = NORMAL');
    db.exec('PRAGMA foreign_keys = ON');
    db.exec('PRAGMA busy_timeout = 5000');

    return new Banco(db, opcoes.arquivo);
  }

  /** Caminho padrão do banco dentro da pasta de dados. */
  static arquivoPadrao(pastaDados: string): string {
    return join(pastaDados, 'contextflow.db');
  }

  /** Aplica migrações pendentes. Idempotente: chamar duas vezes não reaplica nada. */
  migrar(migracoes: readonly Migracao[] = MIGRACOES): number {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS _migracoes (
        versao      INTEGER PRIMARY KEY,
        descricao   TEXT NOT NULL,
        aplicada_em TEXT NOT NULL
      );
    `);

    const atual = this.versaoAtual();
    const pendentes = [...migracoes].filter((m) => m.versao > atual).sort((a, b) => a.versao - b.versao);

    // Snapshot consistente pelo próprio SQLite, incluindo o WAL, antes de alterar uma base existente.
    // Se o backup falhar, não iniciar nenhuma migração. Banco novo/em memória não precisa de cópia.
    if (atual > 0 && pendentes.length > 0 && this.#arquivo !== ':memory:') {
      const pasta = join(dirname(this.#arquivo), 'backups');
      mkdirSync(pasta, { recursive: true, mode: 0o700 });
      const destino = join(pasta, `schema-${atual}-${randomUUID()}.db`);
      this.db.prepare('VACUUM INTO ?').run(destino);
    }

    let aplicadas = 0;
    for (const migracao of pendentes) {
      // Cada migração é atômica: schema + registro na mesma transação.
      const aplicada = this.executarTransacao(() => {
        if (this.versaoAtual() >= migracao.versao) return false;
        migracao.aplicar(this.db);
        this.db
          .prepare('INSERT INTO _migracoes (versao, descricao, aplicada_em) VALUES (?, ?, ?)')
          .run(migracao.versao, migracao.descricao, new Date().toISOString());
        return true;
      });
      if (aplicada) aplicadas++;
    }
    return aplicadas;
  }

  versaoAtual(): number {
    const existe = this.db
      .prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='_migracoes'")
      .get();
    if (!existe) return 0;
    const linha = this.db.prepare('SELECT MAX(versao) AS v FROM _migracoes').get() as { v: number | null };
    return linha.v ?? 0;
  }

  /** Reverte até a versão alvo. Usado em teste e no rollback documentado. */
  reverterPara(alvo: number, migracoes: readonly Migracao[] = MIGRACOES): void {
    const atuais = [...migracoes].filter((m) => m.versao > alvo).sort((a, b) => b.versao - a.versao);
    for (const migracao of atuais) {
      this.executarTransacao(() => {
        migracao.reverter(this.db);
        this.db.prepare('DELETE FROM _migracoes WHERE versao = ?').run(migracao.versao);
      });
    }
  }

  /** Transação explícita — o driver nativo não tem helper, então controlamos aqui. */
  executarTransacao<T>(fn: () => T): T {
    this.db.exec('BEGIN IMMEDIATE');
    try {
      const resultado = fn();
      this.db.exec('COMMIT');
      return resultado;
    } catch (erro) {
      try {
        this.db.exec('ROLLBACK');
      } catch {
        // rollback já aplicado pelo driver
      }
      throw erro;
    }
  }

  fechar(): void {
    this.db.close();
  }
}
