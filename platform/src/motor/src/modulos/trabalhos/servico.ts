/**
 * Módulo `trabalhos`: fila persistente com estados, concorrência limitada,
 * cancelamento cooperativo e retry idempotente.
 *
 * F1 declara o contrato. A fila real entra na F4.
 */
import type { EstadoTrabalho, TipoTrabalho, Trabalho } from '@contextflow/compartilhado';
import { randomUUID } from 'node:crypto';
import { setTimeout as esperar } from 'node:timers/promises';
import { ErroDominio, ErroValidacao } from '../../nucleo/erros.ts';
import { normalizarUrlVideo, type ResultadoIngestao } from '../ingestao/servico.ts';
import type { ExecutorYtdlp } from '../../integracoes/ytdlp.ts';
import { RepositorioTrabalhos, type RegistroTrabalho } from '../../persistencia/repositorio-trabalhos.ts';
export interface ServicoTrabalhos {
    criar(tipo: TipoTrabalho, escopo: Record<string, unknown>): Promise<Trabalho>;
    obter(id: string): Promise<Trabalho | null>;
    listar(estado?: EstadoTrabalho): Promise<Trabalho[]>;
    cancelar(id: string): Promise<void>;
    repetir(id: string, chaveRequisicao: string): Promise<Trabalho>;
}
export interface EscopoImportacao {
    url?: string;
    urls?: string[];
    idiomas?: string[];
    posicao?: number;
    titulo?: string;
    indisponivel?: boolean;
}
export function validarIdiomas(entrada: unknown): string[] | undefined {
    if (entrada === undefined)
        return undefined;
    if (!Array.isArray(entrada) || entrada.length === 0 || entrada.length > 20 || !entrada.every(v => typeof v === 'string' && /^[A-Za-z]{2,8}(?:-[A-Za-z0-9]{1,8})*$/.test(v)))
        throw new ErroValidacao('Informe uma lista de idiomas válida, como pt-BR, pt, en.');
    return entrada as string[];
}
export function normalizarUrlPlaylist(entrada: string): string {
    let url: URL;
    try {
        url = new URL(entrada.trim());
    }
    catch {
        throw new ErroValidacao('URL de playlist inválida.');
    }
    if (!['https:', 'http:'].includes(url.protocol) || !['youtube.com', 'www.youtube.com', 'm.youtube.com'].includes(url.hostname))
        throw new ErroValidacao('Domínio não suportado: use URLs do YouTube');
    const id = url.searchParams.get('list');
    if (!id || !/^[A-Za-z0-9_-]{2,150}$/.test(id))
        throw new ErroValidacao('A URL não contém uma playlist válida.');
    return `https://www.youtube.com/playlist?list=${id}`;
}
export class FilaTrabalhos implements ServicoTrabalhos {
    readonly repositorio: RepositorioTrabalhos;
    readonly #executor: ExecutorYtdlp;
    readonly #processar: (r: RegistroTrabalho, escopo: EscopoImportacao, sinal: AbortSignal) => Promise<ResultadoIngestao>;
    readonly #registrarErro: (erro: unknown) => void;
    readonly #concorrencia: number;
    readonly #criarResumo?: (entrada: Record<string, unknown>) => Promise<Trabalho>;
    readonly #processarResumo?: (r: RegistroTrabalho, sinal: AbortSignal) => Promise<void>;
    readonly #falharResumo?: (r: RegistroTrabalho, erro: unknown) => void;
    readonly #dono = randomUUID();
    readonly #ativos = new Map<string, {
        controle: AbortController;
        promessa: Promise<void>;
    }>();
    #timer: ReturnType<typeof setInterval> | null = null;
    #parando = false;
    #proximaRenovacao = 0;
    constructor(op: {
        repositorio: RepositorioTrabalhos;
        executor: ExecutorYtdlp;
        processar: (r: RegistroTrabalho, escopo: EscopoImportacao, sinal: AbortSignal) => Promise<ResultadoIngestao>;
        concorrencia?: number;
        criarResumo?: (entrada: Record<string, unknown>) => Promise<Trabalho>;
        processarResumo?: (r: RegistroTrabalho, sinal: AbortSignal) => Promise<void>;
        falharResumo?: (r: RegistroTrabalho, erro: unknown) => void;
        registrarErro?: (erro: unknown) => void;
    }) {
        this.repositorio = op.repositorio;
        this.#executor = op.executor;
        this.#processar = op.processar;
        this.#registrarErro = op.registrarErro ?? (() => { });
        this.#concorrencia = op.concorrencia ?? 2;
        this.#criarResumo = op.criarResumo;
        this.#processarResumo = op.processarResumo;
        this.#falharResumo = op.falharResumo;
        if (!Number.isInteger(this.#concorrencia) || this.#concorrencia < 1)
            throw new ErroValidacao('Concorrência deve ser um inteiro positivo.');
    }
    async criar(tipo: TipoTrabalho, entrada: Record<string, unknown>): Promise<Trabalho> {
        if (tipo === 'gerar-resumo' && this.#criarResumo) return this.#criarResumo(entrada);
        if (!['importar-video', 'importar-playlist', 'importar-lote'].includes(tipo))
            throw new ErroDominio('indisponivel', 'Este tipo de trabalho ainda não está disponível.', 503);
        const idiomas = validarIdiomas(entrada.idiomas);
        const escopo: EscopoImportacao = { ...(idiomas ? { idiomas } : {}) };
        let youtubeId: string | null = null;
        if (tipo === 'importar-lote') {
            if (!Array.isArray(entrada.urls) || entrada.urls.length === 0 || !entrada.urls.every(u => typeof u === 'string'))
                throw new ErroValidacao('Informe URLs de vídeos, uma por linha.');
            const erros: string[] = [];
            const urls: string[] = [];
            entrada.urls.forEach((u, i) => { try {
                urls.push(normalizarUrlVideo(u as string).url);
            }
            catch (e) {
                erros.push(`Linha ${i + 1}: ${e instanceof Error ? e.message : 'URL inválida'}`);
            } });
            if (erros.length)
                throw new ErroValidacao(erros.join(' '));
            escopo.urls = [...new Set(urls)];
        }
        else {
            if (typeof entrada.url !== 'string')
                throw new ErroValidacao('Campo url obrigatório.');
            if (tipo === 'importar-video') {
                const v = normalizarUrlVideo(entrada.url);
                escopo.url = v.url;
                youtubeId = v.youtubeId;
            }
            else
                escopo.url = normalizarUrlPlaylist(entrada.url);
        }
        const id = this.repositorio.requisicao(String(entrada.chaveRequisicao ?? ''), 'criar', { tipo, escopo }, () => {
            const pai = this.repositorio.inserir(tipo, escopo as Record<string, unknown>, youtubeId);
            if (tipo === 'importar-lote')
                for (const [posicao, url] of escopo.urls!.entries())
                    this.repositorio.inserir('importar-video', { url, idiomas, posicao }, normalizarUrlVideo(url).youtubeId, pai);
            return pai;
        });
        return this.repositorio.detalhe(id);
    }
    async obter(id: string) { try {
        return this.repositorio.detalhe(id);
    }
    catch (e) {
        if (e instanceof ErroDominio && e.statusHttp === 404)
            return null;
        throw e;
    } }
    async listar(estado?: EstadoTrabalho) {
        const todos: Trabalho[] = [];
        let cursor: string | undefined;
        do {
            const p = this.repositorio.pagina({ estado, cursor, limite: 100 });
            todos.push(...p.itens);
            cursor = p.proximoCursor ?? undefined;
        } while (cursor);
        return todos;
    }
    async cancelar(id: string): Promise<void> { this.repositorio.cancelar(id); this.#abortarSolicitados(); }
    async repetir(id: string, chaveRequisicao: string) { return this.repositorio.detalhe(this.repositorio.repetir(id, chaveRequisicao)); }
    iniciar(): void {
        if (this.#timer)
            return;
        this.#parando = false;
        this.#timer = setInterval(() => this.#tickSeguro(), 100);
        this.#timer.unref();
        this.#tickSeguro();
    }
    async encerrar(): Promise<void> {
        this.#parando = true;
        if (this.#timer)
            clearInterval(this.#timer);
        this.#timer = null;
        for (const a of this.#ativos.values())
            a.controle.abort();
        await Promise.allSettled([...this.#ativos.values()].map(a => a.promessa));
        this.repositorio.liberarLease(this.#dono);
    }
    async aguardar(id: string): Promise<ResultadoIngestao> {
        for (;;) {
            const r = this.repositorio.detalhe(id);
            if (r.estado === 'concluido' || r.estado === 'falhou' && r.resultado)
                return r.resultado as ResultadoIngestao;
            if (r.estado === 'falhou' || r.estado === 'cancelado') {
                const codigo = r.erroCodigo ?? 'ingestao_falhou';
                throw new ErroDominio(codigo, r.erro ?? 'Importação falhou.', this.repositorio.registro(id).erro_http ?? (codigo === 'trabalho_cancelado' ? 409 : 502));
            }
            if (this.#parando)
                throw new ErroDominio('indisponivel', 'O aplicativo está encerrando; a tarefa será retomada.', 503);
            await esperar(40);
        }
    }
    #abortarSolicitados(): void {
        for (const [id, a] of this.#ativos)
            if (this.repositorio.registro(id).cancelamento)
                a.controle.abort();
    }
    #tickSeguro(): void { if (this.#parando)
        return; try {
        this.#tick();
    }
    catch (e) {
        this.#registrarErro(e);
    } }
    #tick(): void {
        const agora = Date.now();
        if (agora >= this.#proximaRenovacao) {
            this.repositorio.lease(this.#dono);
            this.#proximaRenovacao = agora + 5000;
        }
        if (!this.repositorio.possuiLease(this.#dono)) {
            for (const a of this.#ativos.values())
                a.controle.abort();
            return;
        }
        this.#abortarSolicitados();
        this.repositorio.agregar(this.#dono, new Set(this.#ativos.keys()));
        while (this.#ativos.size < this.#concorrencia) {
            const r = this.repositorio.claim(this.#dono);
            if (!r)
                break;
            const controle = new AbortController();
            const promessa = Promise.resolve().then(() => this.#executar(r, controle.signal)).catch(e => {
                if (!this.#parando)
                    this.repositorio.falhar(r, e, r.tipo === 'gerar-resumo' && this.#falharResumo ? () => this.#falharResumo!(r, e) : undefined);
            }).catch(e => this.#registrarErro(e)).finally(() => { this.#ativos.delete(r.id); });
            this.#ativos.set(r.id, { controle, promessa });
        }
    }
    async #executar(r: RegistroTrabalho, sinal: AbortSignal): Promise<void> {
        const escopo = JSON.parse(r.escopo) as EscopoImportacao;
        this.repositorio.conferir(r);
        if (r.tipo === 'gerar-resumo') {
            if (!this.#processarResumo) throw new ErroDominio('indisponivel', 'Geração de resumos indisponível.', 503);
            await this.#processarResumo(r, sinal);
            return;
        }
        if (r.tipo === 'importar-video') {
            if (escopo.indisponivel)
                throw new ErroDominio('video_indisponivel', 'Este item da playlist não está disponível.', 502);
            const resultado = await this.#processar(r, escopo, sinal);
            if (this.repositorio.registro(r.id).estado === 'executando') {
                const erro = resultado.transcricao.erroCodigo;
                this.repositorio.concluir(r, resultado, undefined, erro ? { codigo: erro, mensagem: resultado.transcricao.motivo ?? 'Não foi possível obter a legenda.', status: resultado.transcricao.erroHttp } : undefined);
            }
        }
        else if (!r.descoberto) {
            if (r.tipo === 'importar-playlist') {
                if (!this.#executor.descobrirPlaylist)
                    throw new ErroDominio('indisponivel', 'Descoberta de playlist não disponível.', 503);
                this.repositorio.fase(r, 'descobrindo');
                await this.#executor.descobrirPlaylist(escopo.url!, item => {
                    this.repositorio.conferirEGravar(r, () => {
                        if (item.playlistTitulo) this.repositorio.tituloPlaylist(r.id,item.playlistTitulo);
                        return this.repositorio.inserir('importar-video', {
                        ...(item.youtubeId ? { url: `https://www.youtube.com/watch?v=${item.youtubeId}` } : { indisponivel: true }),
                        idiomas: escopo.idiomas, posicao: item.posicao, titulo: item.titulo,
                    }, item.youtubeId, r.id);
                    });
                }, sinal);
            }
            this.repositorio.descoberto(r);
        }
    }
}
