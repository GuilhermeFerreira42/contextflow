/**
 * Repositório de transcrições e segmentos.
 *
 * A transcrição pertence ao vídeo e é identificada por (video_id, idioma).
 * O estado `indisponivel` é um resultado legítimo, não um erro: fica gravado
 * com motivo, para o usuário saber que já se tentou e por quê.
 */
import type { Transcricao } from '@contextflow/compartilhado';
import type { Driver } from './banco.ts';

interface LinhaTranscricao {
  id: string;
  video_id: string;
  idioma: string;
  origem: Transcricao['origem'];
  estado: Transcricao['estado'];
  motivo: string | null;
  codigo_motivo: string | null;
  atualizado_em: string;
}

interface LinhaSegmento {
  ordem: number;
  inicio_ms: number;
  fim_ms: number;
  texto: string;
}

export interface TranscricaoGravavel {
  videoId: string;
  idioma: string;
  origem: Transcricao['origem'];
  estado: Transcricao['estado'];
  motivo?: string | null;
  codigoMotivo?: string | null;
  segmentos: Transcricao['segmentos'];
  atualizadoEm: string;
}

export interface RepositorioTranscricoes {
  /** Grava transcrição + segmentos substituindo o que houver para o mesmo vídeo/idioma. */
  salvar(transcricao: TranscricaoGravavel): Promise<void>;
  porVideo(videoId: string, idioma?: string): Promise<Transcricao | null>;
  removerDoVideo(videoId: string): Promise<void>;
}

export class RepositorioTranscricoesSqlite implements RepositorioTranscricoes {
  readonly #db: Driver;

  constructor(db: Driver) {
    this.#db = db;
  }

  async salvar(t: TranscricaoGravavel): Promise<void> {
    this.#db.exec('SAVEPOINT salvar_transcricao');
    try {
      this.salvarSincrono(t);
      this.#db.exec('RELEASE salvar_transcricao');
    } catch (erro) {
      this.#db.exec('ROLLBACK TO salvar_transcricao');
      this.#db.exec('RELEASE salvar_transcricao');
      throw erro;
    }
  }

  /** Usado pela unidade de persistencia em transacao sincrona. */
  salvarSincrono(t: TranscricaoGravavel): void {
    const existente = this.#db
      .prepare('SELECT id FROM transcricoes WHERE video_id = ? AND idioma = ?')
      .get(t.videoId, t.idioma) as { id: string } | undefined;

    const id = existente?.id ?? crypto.randomUUID();

    if (existente) {
      this.#db
        .prepare(
          `UPDATE transcricoes
             SET origem = ?, estado = ?, motivo = ?, atualizado_em = ?, codigo_motivo = ?
           WHERE id = ?`,
        )
        .run(t.origem, t.estado, t.motivo ?? null, t.atualizadoEm, t.codigoMotivo ?? null, id);
      // Reescrita completa dos segmentos: uma legenda nova substitui a antiga
      // por inteiro, senão sobrariam tempos de uma versão anterior.
      this.#db.prepare('DELETE FROM segmentos WHERE transcricao_id = ?').run(id);
    } else {
      this.#db
        .prepare(
          `INSERT INTO transcricoes (id, video_id, idioma, origem, estado, motivo, atualizado_em, codigo_motivo)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(id, t.videoId, t.idioma, t.origem, t.estado, t.motivo ?? null, t.atualizadoEm, t.codigoMotivo ?? null);
    }

    if (t.segmentos.length > 0) {
      const inserir = this.#db.prepare(
        `INSERT INTO segmentos (transcricao_id, ordem, inicio_ms, fim_ms, texto)
         VALUES (?, ?, ?, ?, ?)`,
      );
      t.segmentos.forEach((segmento, ordem) => {
        inserir.run(id, ordem, segmento.inicioMs, segmento.fimMs, segmento.texto);
      });
    }
  }

  async porVideo(videoId: string, idioma?: string): Promise<Transcricao | null> {
    const linha = (
      idioma
        ? this.#db
            .prepare(
              `SELECT id, video_id, idioma, origem, estado, motivo, atualizado_em, codigo_motivo
                 FROM transcricoes WHERE video_id = ? AND idioma = ?`,
            )
            .get(videoId, idioma)
        : this.#db
            .prepare(
              `SELECT id, video_id, idioma, origem, estado, motivo, atualizado_em, codigo_motivo
                 FROM transcricoes WHERE video_id = ?
                 ORDER BY CASE estado WHEN 'pronta' THEN 0 ELSE 1 END,
                          CASE origem WHEN 'manual' THEN 0 WHEN 'auto' THEN 1 ELSE 2 END
                 LIMIT 1`,
            )
            .get(videoId)
    ) as unknown as LinhaTranscricao | undefined;

    if (!linha) return null;

    const segmentos =
      linha.estado === 'pronta'
        ? (
            this.#db
              .prepare(
                `SELECT ordem, inicio_ms, fim_ms, texto FROM segmentos
                  WHERE transcricao_id = ? ORDER BY ordem ASC`,
              )
              .all(linha.id) as unknown as LinhaSegmento[]
          ).map((s) => ({
            inicioMs: s.inicio_ms,
            fimMs: s.fim_ms,
            texto: s.texto,
          }))
        : [];

    return {
      videoId: linha.video_id,
      idioma: linha.idioma,
      origem: linha.origem,
      estado: linha.estado,
      segmentos,
      motivo: linha.motivo,
      ...(linha.codigo_motivo ? { codigoMotivo: linha.codigo_motivo } : {}),
      atualizadoEm: linha.atualizado_em,
    };
  }

  async removerDoVideo(videoId: string): Promise<void> {
    this.#db.prepare('DELETE FROM transcricoes WHERE video_id = ?').run(videoId);
  }
}

/** Versão em memória para testes de serviços que não exercitam SQL. */
export class RepositorioTranscricoesMemoria implements RepositorioTranscricoes {
  readonly #mapa = new Map<string, Transcricao>();

  async salvar(t: TranscricaoGravavel): Promise<void> {
    const chave = `${t.videoId}::${t.idioma}`;
    this.#mapa.set(chave, {
      videoId: t.videoId,
      idioma: t.idioma,
      origem: t.origem,
      estado: t.estado,
      segmentos: t.segmentos.map((s) => ({ ...s })),
      motivo: t.motivo ?? null,
      ...(t.codigoMotivo ? { codigoMotivo: t.codigoMotivo } : {}),
      atualizadoEm: t.atualizadoEm,
    });
  }

  async porVideo(videoId: string, idioma?: string): Promise<Transcricao | null> {
    for (const [chave, transcricao] of this.#mapa) {
      if (!chave.startsWith(`${videoId}::`)) continue;
      if (idioma && transcricao.idioma !== idioma) continue;
      return { ...transcricao, segmentos: transcricao.segmentos.map((s) => ({ ...s })) };
    }
    return null;
  }

  async removerDoVideo(videoId: string): Promise<void> {
    for (const chave of [...this.#mapa.keys()]) {
      if (chave.startsWith(`${videoId}::`)) this.#mapa.delete(chave);
    }
  }
}
