/**
 * Reparo em lote de miniaturas (F6-B, item 5 / parte D-2).
 *
 * Contexto: a F6-A corrigiu a recuperação caso a caso (`POST
 * /api/miniaturas/:id/buscar`) e a spec `f6a-recuperacao-miniaturas` deixou
 * claro que o problema real foi uma URL localizada que respondia 404 embora
 * a versão padrão existisse. Vídeos importados antes da correção continuam
 * sem capa até alguém clicar em cada um — é isso que esta peça resolve.
 *
 * Regras que o serviço respeita:
 *
 *  - **Não cria dados novos.** Não há tabela: o estado do reparo é calculado
 *    a partir do repositório de miniaturas que já existe.
 *  - **Um vídeo por vez, com limite de tentativas.** O serviço de miniaturas
 *    já impõe `MAXIMO_TENTATIVAS` e deduplica buscas simultâneas; aqui só se
 *    orquestra em série, porque a origem é o YouTube e paralelismo alto é
 *    bloqueio garantido.
 *  - **Falha é informação.** Um vídeo sem capa disponível fica com `falha`
 *    registrada e placeholder na UI; o relatório devolve os motivos em vez de
 *    fingir sucesso.
 *  - **Progresso sem fila paralela.** O chamador atualiza um trabalho do
 *    repositório de trabalhos (o mesmo do resto do app) com contadores e
 *    progresso; este módulo devolve apenas números por vídeo.
 */

export interface ResultadoReparoVideo {
  videoId: string;
  ok: boolean;
  motivo?: string;
}

export interface ResultadoReparo {
  total: number;
  recuperados: number;
  falhas: ResultadoReparoVideo[];
}

export interface DependenciasReparo {
  /** Ids de vídeos que existem na biblioteca (paginado pelo chamador). */
  listarVideoIds(pagina: { cursor?: string | null; limite: number }):
    Promise<{ ids: string[]; proximoCursor: string | null }>;
  /** Serviço de miniaturas existente — nada é reimplementado aqui. */
  garantir(videoId: string, opcoes: { forcar: boolean }): Promise<{ ok: boolean; motivo?: string }>;
  /** Já existe cópia local? Evita baixar de novo o que está bom. */
  temCopiaLocal(videoId: string): boolean;
  /** Só quando o vídeo tem origem YouTube; sem isso não se inventa URL. */
  podeTentar(videoId: string): boolean | Promise<boolean>;
  aoProgredir?(estado: { feitos: number; total: number; recuperados: number; falhas: number }): void | Promise<void>;
}

export class ServicoReparoMiniaturas {
  #deps: DependenciasReparo;

  constructor(deps: DependenciasReparo) {
    this.#deps = deps;
  }

  /**
   * Percorre a biblioteca e tenta recuperar cada vídeo sem capa.
   *
   * `apenasFaltantes` (padrão) poupa quem já tem imagem: o reparo é para o que
   * está quebrado, não para reescrever tudo. `forcar` existe para o caso de a
   * origem ter mudado a arte — decisão explícita do usuário, nunca padrão.
   */
  async reparar({ forcar = false, limite = 10000 } = {}): Promise<ResultadoReparo> {
    // 1. Descobrir o universo de trabalho antes de gastar rede: o total é o que
    //    permite mostrar percentual confiável no acompanhamento.
    const ids: string[] = [];
    let cursor: string | null = null;
    do {
      const pagina = await this.#deps.listarVideoIds({ cursor, limite: 200 });
      ids.push(...pagina.ids);
      cursor = pagina.proximoCursor;
    } while (cursor && ids.length < limite);

    const alvos = ids.filter((id) => forcar || !this.#deps.temCopiaLocal(id));
    const resultado: ResultadoReparo = { total: alvos.length, recuperados: 0, falhas: [] };

    for (const [indice, videoId] of alvos.entries()) {
      if (!(await this.#deps.podeTentar(videoId))) {
        // Fonte arbitrária (não YouTube): não há candidato a inferir. Fica
        // registrado como falha com motivo, em vez de sumir do relatório.
        resultado.falhas.push({
          videoId,
          ok: false,
          motivo: 'Origem sem candidatos conhecidos para a capa.',
        });
      } else {
        try {
          const buscado = await this.#deps.garantir(videoId, { forcar });
          if (buscado.ok) resultado.recuperados += 1;
          else resultado.falhas.push({ videoId, ok: false, motivo: buscado.motivo ?? 'indisponível' });
        } catch (erro) {
          resultado.falhas.push({
            videoId,
            ok: false,
            motivo: erro instanceof Error ? erro.message : 'falha desconhecida',
          });
        }
      }
      await this.#deps.aoProgredir?.({
        feitos: indice + 1,
        total: alvos.length,
        recuperados: resultado.recuperados,
        falhas: resultado.falhas.length,
      });
    }

    return resultado;
  }
}
