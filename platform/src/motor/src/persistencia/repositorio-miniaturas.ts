import type { Driver } from './banco.ts';

/**
 * Repositório do cache de miniaturas.
 *
 * Só metadados e o nome do arquivo: a imagem em si fica na pasta de dados
 * (`miniaturas/`), fora do banco e fora do Git. O banco guarda o índice para
 * que a busca seja feita uma vez, sem repetir a cada rolagem.
 */
export interface MiniaturaRegistro {
  videoId: string;
  arquivo: string | null;
  contentType: string | null;
  bytes: number | null;
  origem: string | null;
  buscadoEm: string | null;
  falha: string | null;
  tentativas: number;
  atualizadoEm: string;
}

export class RepositorioMiniaturas {
  readonly #db: Driver;

  constructor(db: Driver) {
    this.#db = db;
  }

  obter(videoId: string): MiniaturaRegistro | null {
    const linha = this.#db
      .prepare('SELECT video_id, arquivo, content_type, bytes, origem, buscado_em, falha, tentativas, atualizado_em FROM miniaturas WHERE video_id = ?')
      .get(videoId) as Record<string, unknown> | undefined;
    if (!linha) return null;
    return {
      videoId: String(linha.video_id),
      arquivo: (linha.arquivo as string | null) ?? null,
      contentType: (linha.content_type as string | null) ?? null,
      bytes: linha.bytes == null ? null : Number(linha.bytes),
      origem: (linha.origem as string | null) ?? null,
      buscadoEm: (linha.buscado_em as string | null) ?? null,
      falha: (linha.falha as string | null) ?? null,
      tentativas: Number(linha.tentativas ?? 0),
      atualizadoEm: String(linha.atualizado_em),
    };
  }

  /** Registra sucesso: o arquivo existe e pode ser servido. */
  registrarSucesso(videoId: string, dados: { arquivo: string; contentType: string; bytes: number; origem: string }): void {
    const agora = new Date().toISOString();
    this.#db.prepare(`
      INSERT INTO miniaturas (video_id, arquivo, content_type, bytes, origem, buscado_em, falha, tentativas, atualizado_em)
      VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?)
      ON CONFLICT(video_id) DO UPDATE SET
        arquivo = excluded.arquivo, content_type = excluded.content_type, bytes = excluded.bytes,
        origem = excluded.origem, buscado_em = excluded.buscado_em, falha = NULL,
        tentativas = 0, atualizado_em = excluded.atualizado_em
    `).run(videoId, dados.arquivo, dados.contentType, dados.bytes, dados.origem, agora, agora);
  }

  /**
   * Registra falha e **incrementa** as tentativas.
   *
   * O contador é o que impede o laço: a UI consulta antes de pedir de novo.
   */
  registrarFalha(videoId: string, motivo: string): void {
    const agora = new Date().toISOString();
    this.#db.prepare(`
      INSERT INTO miniaturas (video_id, arquivo, falha, tentativas, atualizado_em)
      VALUES (?, NULL, ?, 1, ?)
      ON CONFLICT(video_id) DO UPDATE SET
        falha = excluded.falha, tentativas = miniaturas.tentativas + 1,
        atualizado_em = excluded.atualizado_em
    `).run(videoId, motivo.slice(0, 300), agora);
  }

  /** Remove o registro (o arquivo é apagado pelo serviço). */
  remover(videoId: string): void {
    this.#db.prepare('DELETE FROM miniaturas WHERE video_id = ?').run(videoId);
  }
}
