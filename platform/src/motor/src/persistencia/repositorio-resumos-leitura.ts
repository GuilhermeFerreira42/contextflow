/**
 * Leitura de resumos para a interface.
 *
 * A F6 é quem ESCREVE resumo. Aqui só se lê, porque a Biblioteca precisa exibir
 * o que já existe sem inventar nada. Quando não há resumo, devolve `null` — a
 * interface mostra estado explícito, nunca um vazio mudo.
 */
import type { Resumo } from '@contextflow/compartilhado';
import type { Driver } from './banco.ts';

interface LinhaResumo {
  video_id: string;
  provedor: string;
  modelo: string;
  versao_prompt: string;
  revisao_transcricao: string;
  texto: string | null;
  estado: Resumo['estado'];
  erro: string | null;
  criado_em: string;
  atualizado_em: string;
}

export interface RepositorioResumosLeitura {
  /** Melhor resumo do vídeo: pronto tem prioridade; senão o mais recente. */
  porVideo(videoId: string): Promise<Resumo | null>;
  /** Texto curto para a linha da Biblioteca, sem carregar o texto inteiro. */
  previaPorVideo(videoIds: string[]): Promise<Map<string, string>>;
}

export class RepositorioResumosLeituraSqlite implements RepositorioResumosLeitura {
  readonly #db: Driver;

  constructor(db: Driver) {
    this.#db = db;
  }

  async porVideo(videoId: string): Promise<Resumo | null> {
    const linha = this.#db
      .prepare(
        `SELECT video_id, provedor, modelo, versao_prompt, revisao_transcricao,
                texto, estado, erro, criado_em, atualizado_em
           FROM resumos
          WHERE video_id = ?
          ORDER BY CASE estado WHEN 'pronto' THEN 0 WHEN 'processando' THEN 1 ELSE 2 END,
                   atualizado_em DESC
          LIMIT 1`,
      )
      .get(videoId) as unknown as LinhaResumo | undefined;

    if (!linha) return null;

    return {
      videoId: linha.video_id,
      provedor: linha.provedor,
      modelo: linha.modelo,
      versaoPrompt: linha.versao_prompt,
      revisaoTranscricao: linha.revisao_transcricao,
      texto: linha.texto,
      estado: linha.estado,
      erro: linha.erro,
      criadoEm: linha.criado_em,
      atualizadoEm: linha.atualizado_em,
    };
  }

  /**
   * Prévia em lote: uma consulta para N vídeos, em vez de N consultas.
   * Corta em 400 caracteres: a linha mostra pouco, e não vale trafegar texto
   * inteiro para 500 linhas.
   */
  async previaPorVideo(videoIds: string[]): Promise<Map<string, string>> {
    const mapa = new Map<string, string>();
    if (videoIds.length === 0) return mapa;

    const marcadores = videoIds.map(() => '?').join(',');
    const linhas = this.#db
      .prepare(
        `SELECT video_id, substr(texto, 1, 400) AS texto
           FROM resumos
          WHERE estado = 'pronto' AND texto IS NOT NULL AND video_id IN (${marcadores})`,
      )
      .all(...videoIds) as unknown as Array<{ video_id: string; texto: string }>;

    for (const linha of linhas) mapa.set(linha.video_id, linha.texto);
    return mapa;
  }
}
