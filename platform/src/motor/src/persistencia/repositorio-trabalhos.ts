import { createHash, randomUUID } from 'node:crypto';
import type { EstadoTrabalho, TipoTrabalho, TrabalhoDetalhado } from '@contextflow/compartilhado';
import { ErroDominio, ErroNaoEncontrado, ErroValidacao } from '../nucleo/erros.ts';
import type { Banco } from './banco.ts';
export interface RegistroTrabalho {
    id: string;
    tipo: TipoTrabalho;
    estado: EstadoTrabalho;
    escopo: string;
    youtube_id: string | null;
    pai_id: string | null;
    fase: string;
    tentativas: number;
    progresso: number | null;
    erro: string | null;
    erro_codigo: string | null;
    erro_http: number | null;
    resultado: string | null;
    cancelamento: number;
    descoberto: number;
    dono: string | null;
    geracao: number;
    criado_em: string;
    atualizado_em: string;
    iniciado_em: string | null;
    finalizado_em: string | null;
}
export const erroCancelado = () => new ErroDominio('trabalho_cancelado', 'Trabalho cancelado.', 409);
const terminais = new Set(['concluido', 'falhou', 'cancelado']);
export class RepositorioTrabalhos {
    readonly banco: Banco;
    constructor(banco: Banco) { this.banco = banco; }
    tituloPlaylist(id: string, titulo: string): void {
        this.banco.db.prepare("UPDATE trabalhos SET escopo=json_set(escopo,'$.titulo',?) WHERE id=?").run(titulo,id);
    }
    ativosDoVideo(youtubeId: string): string[] {
        return (this.banco.db.prepare("SELECT id FROM trabalhos WHERE youtube_id=? AND estado IN ('na-fila','executando')").all(youtubeId) as unknown as {id:string}[]).map(r => r.id);
    }
    ativos(): number {
        return Number(this.banco.db.prepare("SELECT COUNT(*) n FROM trabalhos WHERE pai_id IS NULL AND estado IN ('na-fila','executando')").get()!.n);
    }
    registro(id: string): RegistroTrabalho {
        const r = this.banco.db.prepare('SELECT * FROM trabalhos WHERE id=?').get(id) as unknown as RegistroTrabalho | undefined;
        if (!r)
            throw new ErroNaoEncontrado('Trabalho não encontrado.');
        return r;
    }
    detalhe(id: string): TrabalhoDetalhado {
        const r = this.registro(id);
        const filhos = this.banco.db.prepare(`SELECT COUNT(*) total,
      COALESCE(SUM(estado='concluido'),0) concluidos, COALESCE(SUM(estado='falhou'),0) falhos,
      COALESCE(SUM(estado='cancelado'),0) cancelados,
      COALESCE(SUM(estado='concluido' AND json_extract(resultado,'$.transcricao.estado')='indisponivel'),0) semLegenda FROM trabalhos WHERE pai_id=?`).get(id) as unknown as TrabalhoDetalhado['contadores'];
        const resultado = r.resultado ? JSON.parse(r.resultado) : null;
        const escopo = JSON.parse(r.escopo);
        return { id: r.id, tipo: r.tipo, estado: r.estado, progresso: r.progresso, tentativas: r.tentativas,
            erro: r.erro, criadoEm: r.criado_em, atualizadoEm: r.atualizado_em, fase: r.fase,
            titulo: resultado?.video?.titulo ?? escopo.titulo ?? escopo.url ?? 'Lote de vídeos',
            paiId: r.pai_id, videoId: resultado?.video?.id ?? resultado?.videoId ?? escopo.videoId ?? null, resultado,
            cancelamentoSolicitado: Boolean(r.cancelamento), erroCodigo: r.erro_codigo,
            iniciadoEm: r.iniciado_em, finalizadoEm: r.finalizado_em, contadores: { ...filhos } };
    }
    pagina(op: {
        estado?: string;
        ativos?: boolean;
        cursor?: string;
        limite?: number;
        paiId?: string;
        raizes?: boolean;
    } = {}) {
        const limite = op.limite ?? 50;
        if (!Number.isInteger(limite) || limite < 1 || limite > 100)
            throw new ErroValidacao('Limite deve estar entre 1 e 100.');
        const clausulas: string[] = [];
        const args: (string | number)[] = [];
        if (op.ativos)
            clausulas.push("estado IN ('na-fila','executando')");
        if (op.estado) {
            if (!['na-fila', 'executando', 'concluido', 'falhou', 'cancelado'].includes(op.estado))
                throw new ErroValidacao('Estado de trabalho inválido.');
            clausulas.push('estado=?');
            args.push(op.estado);
        }
        if (op.raizes)
            clausulas.push('pai_id IS NULL');
        if (op.paiId) {
            this.registro(op.paiId);
            clausulas.push('pai_id=?');
            args.push(op.paiId);
        }
        if (op.cursor) {
            const r = this.registro(op.cursor);
            clausulas.push('(criado_em<? OR (criado_em=? AND id<?))');
            args.push(r.criado_em, r.criado_em, r.id);
        }
        const ids = this.banco.db.prepare(`SELECT id FROM trabalhos ${clausulas.length ? 'WHERE ' + clausulas.join(' AND ') : ''}
      ORDER BY criado_em DESC,id DESC LIMIT ?`).all(...args, limite + 1) as unknown as {
            id: string;
        }[];
        return { itens: ids.slice(0, limite).map(r => this.detalhe(r.id)), proximoCursor: ids.length > limite ? ids[limite - 1]!.id : null };
    }
    inserir(tipo: TipoTrabalho, escopo: Record<string, unknown>, youtubeId: string | null = null, paiId: string | null = null): string {
        if (paiId && youtubeId) {
            const existe = this.banco.db.prepare('SELECT id FROM trabalhos WHERE pai_id=? AND youtube_id=?').get(paiId, youtubeId) as {
                id: string;
            } | undefined;
            if (existe)
                return existe.id;
        }
        if (paiId && !youtubeId && escopo.posicao !== undefined) {
            const existe = this.banco.db.prepare("SELECT id FROM trabalhos WHERE pai_id=? AND youtube_id IS NULL AND json_extract(escopo,'$.posicao')=?").get(paiId, Number(escopo.posicao)) as {
                id: string;
            } | undefined;
            if (existe)
                return existe.id;
        }
        const id = randomUUID(), agora = new Date().toISOString();
        this.banco.db.prepare(`INSERT INTO trabalhos(id,tipo,estado,escopo,youtube_id,pai_id,criado_em,atualizado_em)
      VALUES(?,?,'na-fila',?,?,?,?,?)`).run(id, tipo, JSON.stringify(escopo), youtubeId, paiId, agora, agora);
        return id;
    }
    requisicao(chave: string, operacao: string, corpo: unknown, acao: () => string): string {
        if (!/^[A-Za-z0-9_-]{1,150}$/.test(chave))
            throw new ErroValidacao('Informe chaveRequisicao válida (1 a 150 letras, números, hífen ou sublinhado).');
        const hash = createHash('sha256').update(JSON.stringify(corpo)).digest('hex');
        return this.banco.executarTransacao(() => {
            const r = this.banco.db.prepare('SELECT * FROM requisicoes_trabalho WHERE chave=?').get(chave) as {
                operacao: string;
                corpo_hash: string;
                trabalho_id: string;
            } | undefined;
            if (r) {
                if (r.operacao !== operacao || r.corpo_hash !== hash)
                    throw new ErroDominio('chave_conflitante', 'Esta chave já foi usada para outra solicitação.', 409);
                return r.trabalho_id;
            }
            const id = acao();
            this.banco.db.prepare('INSERT INTO requisicoes_trabalho VALUES(?,?,?,?)').run(chave, operacao, hash, id);
            return id;
        });
    }
    lease(dono: string, duracao = 30000, agora = Date.now()): boolean {
        return this.banco.executarTransacao(() => {
            const atual = this.banco.db.prepare('SELECT dono,expira FROM executor_fila WHERE id=1').get() as {
                dono: string;
                expira: number;
            } | undefined;
            if (atual && atual.dono !== dono && atual.expira > agora)
                return false;
            if (!atual || atual.dono !== dono) {
                const data = new Date(agora).toISOString();
                this.banco.db.prepare(`UPDATE tentativas_trabalho SET finalizado_em=?,estado='interrompido',erro='Execução interrompida.'
          WHERE finalizado_em IS NULL`).run(data);
                this.banco.db.prepare(`UPDATE trabalhos SET estado=CASE cancelamento WHEN 1 THEN 'cancelado' ELSE 'na-fila' END,
          dono=NULL,geracao=geracao+1,fase='aguardando',atualizado_em=? WHERE estado='executando'`).run(data);
            }
            this.banco.db.prepare(`INSERT INTO executor_fila VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET dono=excluded.dono,expira=excluded.expira`).run(dono, agora + duracao);
            return true;
        });
    }
    liberarLease(dono: string): void { this.banco.db.prepare('DELETE FROM executor_fila WHERE dono=?').run(dono); }
    possuiLease(dono: string): boolean {
        return Boolean(this.banco.db.prepare('SELECT id FROM executor_fila WHERE dono=? AND expira>?').get(dono, Date.now()));
    }
    claim(dono: string): RegistroTrabalho | null {
        return this.banco.executarTransacao(() => {
            if (!this.possuiLease(dono))
                return null;
            const r = this.banco.db.prepare(`SELECT * FROM trabalhos j WHERE estado='na-fila' AND cancelamento=0
        AND (youtube_id IS NULL OR NOT EXISTS(SELECT 1 FROM trabalhos a WHERE a.estado='executando'
          AND a.youtube_id=j.youtube_id AND a.id<>j.id))
        ORDER BY criado_em,id LIMIT 1`).get() as unknown as RegistroTrabalho | undefined;
            if (!r)
                return null;
            const agora = new Date().toISOString();
            this.banco.db.prepare(`UPDATE trabalhos SET estado='executando',dono=?,geracao=geracao+1,tentativas=tentativas+1,
        iniciado_em=?,atualizado_em=?,erro=NULL,erro_codigo=NULL WHERE id=? AND estado='na-fila'`).run(dono, agora, agora, r.id);
            const atual = this.registro(r.id);
            this.banco.db.prepare('INSERT INTO tentativas_trabalho(trabalho_id,numero,iniciado_em) VALUES(?,?,?)').run(r.id, atual.tentativas, agora);
            return atual;
        });
    }
    conferir(r: RegistroTrabalho): void {
        const atual = this.registro(r.id);
        if (atual.cancelamento)
            throw erroCancelado();
        if (atual.estado !== 'executando' || atual.geracao !== r.geracao || atual.dono !== r.dono || !this.possuiLease(r.dono!))
            throw new ErroDominio('execucao_obsoleta', 'Execução substituída por outra instância.', 409);
    }
    fase(r: RegistroTrabalho, fase: string): void {
        this.conferirEGravar(r, () => this.banco.db.prepare('UPDATE trabalhos SET fase=?,atualizado_em=? WHERE id=?').run(fase, new Date().toISOString(), r.id));
    }
    conferirEGravar(r: RegistroTrabalho, gravar: () => void): void {
        this.banco.executarTransacao(() => { this.conferir(r); gravar(); });
    }
    concluir(r: RegistroTrabalho, resultado: unknown, gravar?: () => void, falha?: {
        codigo: string;
        mensagem: string;
        status?: number;
    }): void {
        this.banco.executarTransacao(() => { this.conferir(r); gravar?.(); this.#terminal(r.id, falha ? 'falhou' : 'concluido', falha?.mensagem ?? null, falha?.codigo ?? null, resultado, falha?.status ?? null); });
    }
    #terminal(id: string, estado: EstadoTrabalho, erro: string | null = null, codigo: string | null = null, resultado?: unknown, erroHttp: number | null = null): void {
        const r = this.registro(id), agora = new Date().toISOString();
        if (terminais.has(r.estado))
            return;
        this.banco.db.prepare(`UPDATE trabalhos SET estado=?,fase='finalizado',erro=?,erro_codigo=?,erro_http=?,
      resultado=COALESCE(?,resultado),progresso=CASE WHEN ?='concluido' THEN 1 ELSE progresso END,
      atualizado_em=?,finalizado_em=? WHERE id=?`).run(estado, erro, codigo, erroHttp, resultado === undefined ? null : JSON.stringify(resultado), estado, agora, agora, id);
        this.banco.db.prepare('UPDATE tentativas_trabalho SET finalizado_em=?,estado=?,erro=? WHERE trabalho_id=? AND numero=?').run(agora, estado, erro, id, r.tentativas);
    }
    falhar(r: RegistroTrabalho, erro: unknown, gravar?: () => void): void {
        this.banco.executarTransacao(() => {
            const atual = this.registro(r.id);
            if (atual.estado !== 'executando' || atual.geracao !== r.geracao || atual.dono !== r.dono || !this.possuiLease(r.dono!))
                return;
            gravar?.();
            const cancelado = atual.cancelamento || (erro instanceof ErroDominio && erro.codigo === 'trabalho_cancelado');
            this.#terminal(r.id, cancelado ? 'cancelado' : 'falhou', cancelado ? 'Trabalho cancelado.' : erro instanceof ErroDominio ? erro.message : 'Falha interna no trabalho.', cancelado ? 'trabalho_cancelado' : erro instanceof ErroDominio ? erro.codigo : 'erro_interno', undefined, cancelado ? 409 : erro instanceof ErroDominio ? erro.statusHttp : 500);
        });
    }
    cancelar(id: string): void {
        this.registro(id);
        this.banco.executarTransacao(() => {
            const filhos = this.banco.db.prepare(`WITH RECURSIVE arvore(id) AS (SELECT ? UNION ALL SELECT t.id FROM trabalhos t JOIN arvore a ON t.pai_id=a.id)
        SELECT id FROM arvore`).all(id) as unknown as {
                id: string;
            }[];
            for (const f of filhos) {
                const r = this.registro(f.id);
                if (terminais.has(r.estado))
                    continue;
                this.banco.db.prepare('UPDATE trabalhos SET cancelamento=1,atualizado_em=? WHERE id=?').run(new Date().toISOString(), f.id);
                if (r.estado === 'na-fila')
                    this.#terminal(f.id, 'cancelado', 'Trabalho cancelado.', 'trabalho_cancelado');
            }
        });
    }
    repetir(id: string, chave: string): string {
        return this.requisicao(chave, 'repetir', { id }, () => {
            const r = this.registro(id);
            if (!['falhou', 'cancelado'].includes(r.estado))
                return id;
            const ids = this.banco.db.prepare('SELECT id FROM trabalhos WHERE pai_id=? AND estado IN (\'falhou\',\'cancelado\')').all(id) as unknown as {
                id: string;
            }[];
            for (const f of [...ids, { id }])
                this.banco.db.prepare(`UPDATE trabalhos SET estado='na-fila',cancelamento=0,
        fase='aguardando',erro=NULL,erro_codigo=NULL,erro_http=NULL,resultado=NULL,finalizado_em=NULL,progresso=NULL,atualizado_em=? WHERE id=?`).run(new Date().toISOString(), f.id);
            return id;
        });
    }
    descoberto(r: RegistroTrabalho): void {
        this.conferirEGravar(r, () => this.banco.db.prepare("UPDATE trabalhos SET descoberto=1,fase='aguardando-itens' WHERE id=?").run(r.id));
    }
    agregar(dono: string, ativos: ReadonlySet<string> = new Set()): void {
        this.banco.executarTransacao(() => {
            if (!this.possuiLease(dono))
                return;
            const pais = this.banco.db.prepare("SELECT id FROM trabalhos WHERE estado='executando' AND tipo IN ('importar-playlist','importar-lote')").all() as unknown as {
                id: string;
            }[];
            for (const p of pais) {
                if (ativos.has(p.id))
                    continue;
                const r = this.registro(p.id);
                const d = this.detalhe(p.id), c = d.contadores;
                if (!r.descoberto && !r.cancelamento)
                    continue;
                const terminados = c.concluidos + c.falhos + c.cancelados;
                this.banco.db.prepare('UPDATE trabalhos SET progresso=? WHERE id=?').run(r.descoberto ? (c.total ? terminados / c.total : 1) : null, p.id);
                if (terminados === c.total)
                    this.#terminal(p.id, r.cancelamento ? 'cancelado' : c.falhos || c.cancelados ? 'falhou' : 'concluido', c.falhos ? 'Alguns itens falharam.' : null, c.falhos ? 'itens_falharam' : null);
            }
        });
    }
    /**
     * Contagens do histórico por categoria — o que a limpeza oferece.
     *
     * "Falha" e "cancelado" são estados do trabalho. "Repetido" é derivado:
     * uma raiz com mais de uma tentativa registrada em `tentativas_trabalho`
     * significa que a mesma importação foi refeita; nenhuma linha é
     * considerada "excluída", porque esse estado não existe no domínio.
     */
    historicoResumo(): {
        total: number; concluido: number; falhou: number; cancelado: number; ativo: number;
        repetido: number; comFilhos: number;
    } {
        const contagem = this.banco.db.prepare(`
          SELECT estado, COUNT(*) n FROM trabalhos WHERE pai_id IS NULL GROUP BY estado
        `).all() as unknown as { estado: string; n: number }[];
        const por = (estado: string) => Number(contagem.find(c => c.estado === estado)?.n ?? 0);
        const repetido = Number((this.banco.db.prepare(`
          SELECT COUNT(*) n FROM (
            SELECT pai_id, youtube_id FROM trabalhos
            WHERE pai_id IS NOT NULL AND youtube_id IS NOT NULL
            GROUP BY pai_id, youtube_id HAVING COUNT(*) > 1
          )
        `).get() as { n: number }).n);
        const comFilhos = Number((this.banco.db.prepare(`
          SELECT COUNT(*) n FROM trabalhos p WHERE p.pai_id IS NULL
            AND EXISTS(SELECT 1 FROM trabalhos f WHERE f.pai_id = p.id)
        `).get() as { n: number }).n);
        return {
          total: por('concluido') + por('falhou') + por('cancelado'),
          concluido: por('concluido'), falhou: por('falhou'), cancelado: por('cancelado'),
          ativo: por('na-fila') + por('executando'),
          repetido, comFilhos,
        };
    }

    /**
     * Remove entradas do histórico.
     *
     * Só trabalhos TERMINAIS e raízes. Trabalho ativo é recusado — apagar um
     * trabalho em execução deixaria o executor tentando gravar num id que não
     * existe. O que é apagado é a entrada de fila (mais tentativas e chaves de
     * requisição); vídeo, transcrição, resumo e coleções ficam intactos:
     * `videos` não tem FK daqui, e `biblioteca.remover` é outro caminho.
     *
     * Devolve quantos saíram e quais estados, para a UI confirmar.
     */
    /**
     * Apaga as linhas de trabalho dadas (raízes + filhos) e seus dependentes.
     *
     * Existe como método próprio porque DUAS operações precisam da mesma
     * limpeza: a limpeza por categoria e a remoção individual. Duplicar a
     * ordem de DELETE é como se cria órfão de FK.
     *
     * `requisicoes_trabalho` sai junto: sem isso, repetir a mesma
     * `chaveRequisicao` encontraria uma chave apontando para um trabalho
     * inexistente e devolveria 404 em vez de criar a operação.
     */
    #apagarTrabalhos(ids: string[]): void {
        if (!ids.length) return;
        const marcas = ids.map(() => '?').join(',');
        this.banco.db.prepare(`DELETE FROM tentativas_trabalho WHERE trabalho_id IN (
          SELECT id FROM trabalhos WHERE pai_id IN (${marcas}) OR id IN (${marcas})
        )`).run(...ids, ...ids);
        this.banco.db.prepare(`DELETE FROM resumos_execucoes WHERE trabalho_id IN (
          SELECT id FROM trabalhos WHERE pai_id IN (${marcas}) OR id IN (${marcas})
        )`).run(...ids, ...ids);
        this.banco.db.prepare(`DELETE FROM requisicoes_trabalho WHERE trabalho_id IN (
          SELECT id FROM trabalhos WHERE pai_id IN (${marcas}) OR id IN (${marcas})
        )`).run(...ids, ...ids);
        this.banco.db.prepare(`DELETE FROM trabalhos WHERE pai_id IN (${marcas})`).run(...ids);
        this.banco.db.prepare(`DELETE FROM trabalhos WHERE id IN (${marcas})`).run(...ids);
    }

    /**
     * Remove UM trabalho do histórico.
     *
     * Só trabalho terminal: apagar um trabalho em execução deixaria o executor
     * gravando num id que não existe. Recusa com 409 (conflito de estado, não
     * erro de entrada) — o cliente deve cancelar antes.
     *
     * Não toca em `videos`: remover do histórico ≠ remover da biblioteca.
     */
    removerDoHistorico(id: string): { removido: true; filhos: number } {
        const registro = this.registro(id);
        if (registro.estado === 'na-fila' || registro.estado === 'executando') {
            throw new ErroDominio('trabalho_ativo',
                'Este trabalho ainda está em andamento. Cancele antes de remover do histórico.', 409);
        }
        return this.banco.executarTransacao(() => {
            const filhos = Number((this.banco.db
                .prepare('SELECT COUNT(*) n FROM trabalhos WHERE pai_id=?')
                .get(id) as { n: number }).n);
            this.#apagarTrabalhos([id]);
            return { removido: true as const, filhos };
        });
    }

    limparHistorico(estados: string[]): { removidos: number; estados: string[]; preservados: number } {
        const permitidos = ['concluido', 'falhou', 'cancelado'];
        const pedidos = estados.filter(e => permitidos.includes(e));
        if (!pedidos.length) throw new ErroValidacao('Escolha ao menos uma categoria: concluido, falhou ou cancelado.');
        const marcadores = pedidos.map(() => '?').join(',');
        return this.banco.executarTransacao(() => {
          const alvos = this.banco.db
            .prepare(`SELECT id FROM trabalhos WHERE pai_id IS NULL AND estado IN (${marcadores})`)
            .all(...pedidos) as unknown as { id: string }[];
          // Ativos nunca entram: estão fora dos estados pedidos por construção,
          // mas a contagem é explícita para a resposta dizer o que sobrou.
          const preservados = Number((this.banco.db
            .prepare("SELECT COUNT(*) n FROM trabalhos WHERE pai_id IS NULL AND estado IN ('na-fila','executando')")
            .get() as { n: number }).n);
          if (!alvos.length) return { removidos: 0, estados: pedidos, preservados };
          const ids = alvos.map(a => a.id);
          this.#apagarTrabalhos(ids);
          return { removidos: ids.length, estados: pedidos, preservados };
        });
    }

}
