import { createHash } from 'node:crypto';
import { setTimeout as esperar } from 'node:timers/promises';
import type { Resumo, Transcricao, Video } from '@contextflow/compartilhado';
import type { Banco } from '../../persistencia/banco.ts';
import { RepositorioTrabalhos, type RegistroTrabalho } from '../../persistencia/repositorio-trabalhos.ts';
import { ErroDominio, ErroNaoEncontrado, ErroValidacao } from '../../nucleo/erros.ts';
import { ConfiguracaoResumos, type ConfigResumo } from './configuracao.ts';
import { ClienteProvedor, dividirTexto, tokensConservadores, type UsoIA } from './provedores.ts';

const hash = (v: unknown) => createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const revisaoTranscricao = (t: Transcricao) => hash({ idioma: t.idioma, origem: t.origem, segmentos: t.segmentos });
interface Snapshot {
  config: ConfigResumo; video: Pick<Video, 'id' | 'titulo' | 'canalNome' | 'duracaoSegundos'>;
  transcricao: Transcricao; revisao: string; versao: string; assinatura: string; limiteChamadas: number;
}
interface ItemEstimativa {
  videoId: string; titulo: string; elegivel: boolean; motivo: string | null; existente: boolean;
  tokensEntrada: number; tokensSaida: number; partes: number; chamadasMaximas: number; custoEstimado: number | null;
}
const fonte = (s: Snapshot) => s.transcricao.segmentos.map(t => `[${(t.inicioMs / 1000).toFixed(1)}s] ${t.texto}`).join('\n');
const prompt = (s: Snapshot, texto: string) => s.config.prompt.replace(/\{(transcricao|titulo|canal|duracao)\}/g,
  (_, nome: string) => ({ transcricao: texto, titulo: s.video.titulo, canal: s.video.canalNome ?? '', duracao: String(s.video.duracaoSegundos ?? '') })[nome]!);
const limiteParte = (s: Snapshot) => s.config.contexto - s.config.maxSaida - tokensConservadores(prompt(s, '')) - 512;
const chaveResumo = (s: Snapshot) => [s.video.id, s.config.provedor, s.config.modelo, s.versao, s.revisao];

export class ServicoResumos {
  readonly configuracao: ConfiguracaoResumos;
  readonly cliente: ClienteProvedor;
  readonly #banco: Banco;
  readonly #trabalhos: RepositorioTrabalhos;
  readonly #videos: { porId(id: string): Promise<Video | null> };
  readonly #transcricoes: { porVideo(id: string): Promise<Transcricao | null> };
  readonly #ativos = new Map<string, number>();
  constructor(op: { banco: Banco; trabalhos: RepositorioTrabalhos; configuracao: ConfiguracaoResumos; cliente?: ClienteProvedor;
    videos: { porId(id: string): Promise<Video | null> }; transcricoes: { porVideo(id: string): Promise<Transcricao | null> } }) {
    this.#banco = op.banco; this.#trabalhos = op.trabalhos; this.configuracao = op.configuracao;
    this.cliente = op.cliente ?? new ClienteProvedor();
    this.#videos = op.videos;
    this.#transcricoes = op.transcricoes;
  }
  async #config(): Promise<ConfigResumo> {
    const c = await this.configuracao.obter();
    if (!c) throw new ErroDominio('provedor_nao_configurado', 'Configure o provedor de resumos em Configurações antes de continuar.', 412);
    return c;
  }
  async testar() {
    const c = await this.#config();
    return this.cliente.testar(c, await this.configuracao.chave(c));
  }
  #existente(s: Snapshot) {
    return this.#banco.db.prepare(`SELECT 1 FROM resumos WHERE video_id=? AND provedor=? AND modelo=? AND versao_prompt=? AND revisao_transcricao=? AND estado='pronto'`).get(...chaveResumo(s));
  }
  #snapshotDaFonte(c: ConfigResumo, video: Video, t: Transcricao) {
    const revisao = revisaoTranscricao(t);
    const metadados = { id: video.id, titulo: video.titulo, canalNome: video.canalNome, duracaoSegundos: video.duracaoSegundos };
    const versao = `${c.versaoPrompt}:${hash({ provedor: c.provedor, modelo: c.modelo, baseUrl: c.baseUrl, prompt: c.prompt, contexto: c.contexto, maxSaida: c.maxSaida, metadados }).slice(0, 16)}`;
    const snapshot: Snapshot = { config: c, video: metadados, transcricao: t, revisao, versao,
      assinatura: hash({ id: video.id, revisao, versao }), limiteChamadas: 1 };
    const partes = dividirTexto(fonte(snapshot), limiteParte(snapshot));
    snapshot.limiteChamadas = partes.length === 1 ? 1 : Math.min(100, partes.length * 2 + 4);
    return { snapshot, partes };
  }
  #enfileirar(s: Snapshot, youtubeId: string): string {
    const ativo = this.#banco.db.prepare("SELECT id FROM trabalhos WHERE tipo='gerar-resumo' AND estado IN ('na-fila','executando') AND json_extract(escopo,'$.assinatura')=? LIMIT 1").get(s.assinatura) as { id: string } | undefined;
    if (ativo) return ativo.id;
    const id = this.#trabalhos.inserir('gerar-resumo', { videoId: s.video.id, titulo: `Resumo: ${s.video.titulo}`, assinatura: s.assinatura }, youtubeId);
    this.#banco.db.prepare('INSERT INTO resumos_execucoes VALUES(?,?,?,NULL,?)').run(id, s.video.id, JSON.stringify(s), new Date().toISOString());
    return id;
  }
  async configurarAoImportar(): Promise<ConfigResumo> {
    const c = await this.#config();
    if (['openai', 'anthropic'].includes(c.provedor) && !await this.configuracao.chave(c)) {
      throw new ErroDominio('chave_ausente', 'Configure a chave do provedor ou desmarque a geração ao importar.', 412);
    }
    return c;
  }
  /** Chamado dentro da transação que conclui a importação. */
  enfileirarAoImportar(c: ConfigResumo, video: Video, t: Transcricao | null): { trabalhoId?: string; mensagem?: string } {
    if (!t || t.estado !== 'pronta' || !t.segmentos.length) return { mensagem: 'Resumo não gerado: vídeo sem transcrição disponível.' };
    let s: Snapshot;
    try {
      s = this.#snapshotDaFonte(c, video, t).snapshot;
    } catch (e) {
      if (!(e instanceof ErroDominio)) throw e;
      return { mensagem: e.message };
    }
    if (this.#existente(s)) return { mensagem: 'O resumo desta versão já está pronto.' };
    return { trabalhoId: this.#enfileirar(s, video.youtubeId) };
  }
  async #preparar(entrada: unknown) {
    if (!entrada || typeof entrada !== 'object') throw new ErroValidacao('Informe videoIds.');
    const ids = (entrada as { videoIds?: unknown }).videoIds;
    if (!Array.isArray(ids) || !ids.length || ids.length > 100 || ids.some(v => typeof v !== 'string' || !v || v.length > 200)) throw new ErroValidacao('Selecione de 1 a 100 vídeos válidos.');
    const c = await this.#config();
    const itens: ItemEstimativa[] = [], snapshots: Snapshot[] = [], identidades: unknown[] = [];
    for (const id of [...new Set(ids as string[])]) {
      const video = await this.#videos.porId(id);
      const t = await this.#transcricoes.porVideo(id);
      if (!video) throw new ErroNaoEncontrado('Um dos vídeos selecionados não existe mais. Atualize a Biblioteca.');
      const item: ItemEstimativa = { videoId: id, titulo: video.titulo, elegivel: false, motivo: null, existente: false, tokensEntrada: 0, tokensSaida: 0, partes: 0, chamadasMaximas: 0, custoEstimado: null };
      if (!t || t.estado !== 'pronta' || !t.segmentos.length) {
        item.motivo = 'Este vídeo não tem transcrição disponível.';
        identidades.push({ id, motivo: item.motivo }); itens.push(item); continue;
      }
      const revisao = revisaoTranscricao(t);
      try {
        const { snapshot: s, partes } = this.#snapshotDaFonte(c, video, t);
        item.elegivel = true; item.existente = Boolean(this.#existente(s)); item.partes = partes.length;
        item.chamadasMaximas = item.existente ? 0 : s.limiteChamadas * 3;
        item.tokensEntrada = item.existente ? 0 : 3 * (partes.length === 1 ? tokensConservadores(prompt(s, partes[0]!)) + 256 : c.contexto * s.limiteChamadas);
        item.tokensSaida = item.existente ? 0 : 3 * c.maxSaida * s.limiteChamadas;
        item.custoEstimado = item.existente ? 0 : c.precoEntrada === null || c.precoSaida === null ? null
          : (item.tokensEntrada * c.precoEntrada + item.tokensSaida * c.precoSaida) / 1_000_000;
        snapshots.push(s); identidades.push({ id, revisao, versao: s.versao, existente: item.existente });
      } catch (e) {
        if (!(e instanceof ErroDominio)) throw e;
        item.motivo = e.message; identidades.push({ id, revisao, erro: e.codigo });
      }
      itens.push(item);
    }
    const totalCusto = itens.some(i => i.elegivel && i.custoEstimado === null) ? null : itens.reduce((n, i) => n + (i.custoEstimado ?? 0), 0);
    return { publica: { itens, totalCusto, moeda: 'USD', assinaturaEstimativa: hash({ config: c, identidades }),
      aviso: 'Estimativa conservadora por bytes UTF-8 e preços informados, incluindo até três tentativas HTTP. Não é cobrança exata. Reexecução após interrupção pode repetir chamadas ao provedor.' }, snapshots };
  }
  async estimar(entrada: unknown) { return (await this.#preparar(entrada)).publica; }

  async gerar(entrada: unknown) {
    const e = entrada as Record<string, unknown> | null;
    if (!e || e.confirmarCusto !== true || typeof e.assinaturaEstimativa !== 'string') throw new ErroValidacao('Confira e confirme a estimativa antes de gerar.');
    const chave = e.chaveRequisicao;
    if (typeof chave !== 'string' || !/^[\w-]{1,100}$/.test(chave)) throw new ErroValidacao('Informe chaveRequisicao válida (até 100 caracteres).');
    const { publica, snapshots } = await this.#preparar(entrada);
    const trabalhos: Array<{ id: string; videoId: string }> = [], reutilizados: string[] = [];
    const repetida = snapshots.length > 0 && snapshots.every(s => this.#banco.db.prepare('SELECT 1 FROM requisicoes_trabalho WHERE chave=?').get(`${chave}_${hash(s.video.id).slice(0, 16)}`));
    if (e.assinaturaEstimativa !== publica.assinaturaEstimativa && !repetida) throw new ErroDominio('estimativa_alterada', 'A configuração ou o conteúdo mudou. Confira uma nova estimativa antes de gerar.', 409);
    if (!snapshots.length) throw new ErroValidacao('Nenhum vídeo selecionado tem transcrição que possa ser resumida.');
    const c = snapshots[0]!.config;
    if (snapshots.some(s => !this.#existente(s)) && ['openai', 'anthropic'].includes(c.provedor) && !await this.configuracao.chave(c)) throw new ErroDominio('chave_ausente', 'Configure a chave deste provedor antes de gerar.', 412);
    for (const s of snapshots) {
      const chaveItem = `${chave}_${hash(s.video.id).slice(0, 16)}`;
      const jaSolicitado = this.#banco.db.prepare('SELECT 1 FROM requisicoes_trabalho WHERE chave=?').get(chaveItem);
      if (this.#existente(s) && !jaSolicitado) { reutilizados.push(s.video.id); continue; }
      const id = this.#trabalhos.requisicao(chaveItem, 'gerar-resumo', { assinatura: s.assinatura }, () => {
        const video = this.#banco.db.prepare('SELECT youtube_id FROM videos WHERE id=?').get(s.video.id) as { youtube_id: string };
        return this.#enfileirar(s, video.youtube_id);
      });
      trabalhos.push({ id, videoId: s.video.id });
    }
    return { trabalhos, reutilizados, ignorados: publica.itens.filter(i => !i.elegivel).map(i => ({ videoId: i.videoId, motivo: i.motivo })) };
  }

  #snapshot(id: string): Snapshot {
    const linha = this.#banco.db.prepare('SELECT snapshot FROM resumos_execucoes WHERE trabalho_id=?').get(id) as { snapshot: string } | undefined;
    if (!linha) throw new ErroDominio('snapshot_ausente', 'A fonte desta geração não está mais disponível.', 409);
    return JSON.parse(linha.snapshot) as Snapshot;
  }
  #gravar(s: Snapshot, estado: Resumo['estado'], texto: string | null, erro: string | null) {
    const agora = new Date().toISOString();
    this.#banco.db.prepare(`INSERT INTO resumos VALUES(?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(video_id,provedor,modelo,versao_prompt,revisao_transcricao)
      DO UPDATE SET texto=excluded.texto,estado=excluded.estado,erro=excluded.erro,atualizado_em=excluded.atualizado_em
      WHERE resumos.estado<>'pronto'`).run(...chaveResumo(s), texto, estado, erro, agora, agora);
  }
  marcarErro(r: RegistroTrabalho, erro: unknown) {
    try {
      const s = this.#snapshot(r.id);
      const mensagem = this.#trabalhos.registro(r.id).cancelamento ? 'Geração cancelada.' : erro instanceof ErroDominio ? erro.message : 'Falha interna na geração.';
      this.#gravar(s, 'erro', null, mensagem);
    } catch (e) { if (!(e instanceof ErroDominio && e.codigo === 'snapshot_ausente')) throw e; }
  }

  async processar(r: RegistroTrabalho, sinal: AbortSignal) {
    const s = this.#snapshot(r.id), c = s.config;
    if (this.#existente(s)) { this.#trabalhos.concluir(r, { videoId: s.video.id, reutilizado: true }); return; }
    const grupo = `${c.provedor}:${c.baseUrl}`;
    while ((this.#ativos.get(grupo) ?? 0) >= c.concorrencia) {
      this.#trabalhos.fase(r, 'Aguardando capacidade do provedor');
      await esperar(50, undefined, { signal: sinal });
    }
    this.#ativos.set(grupo, (this.#ativos.get(grupo) ?? 0) + 1);
    try {
      const chave = await this.configuracao.chave(c);
      this.#trabalhos.conferirEGravar(r, () => this.#gravar(s, 'processando', null, null));
      const uso: UsoIA = { entrada: 0, saida: 0, chamadas: 0, aproximado: false };
      let chamadas = 0;
      const completar = async (texto: string, fase: string) => {
        if (++chamadas > s.limiteChamadas) throw new ErroDominio('contexto_excedido', 'A redução excederia as chamadas aprovadas. Reveja contexto e limite de saída.', 422);
        this.#trabalhos.conferir(r);
        const resultado = await this.cliente.completar(c, chave, prompt(s, texto), sinal,
          detalhe => this.#trabalhos.fase(r, `${fase} · ${detalhe}`));
        uso.entrada += resultado.uso.entrada; uso.saida += resultado.uso.saida;
        uso.chamadas += resultado.uso.chamadas; uso.aproximado ||= resultado.uso.aproximado;
        this.#trabalhos.conferirEGravar(r, () => {
          this.#banco.db.prepare('UPDATE resumos_execucoes SET uso=? WHERE trabalho_id=?').run(JSON.stringify(uso), r.id);
          this.#banco.db.prepare('UPDATE trabalhos SET progresso=? WHERE id=?').run(Math.min(0.95, chamadas / s.limiteChamadas), r.id);
        });
        return resultado.texto;
      };
      let texto = fonte(s), rodada = 0;
      const limite = limiteParte(s);
      while (tokensConservadores(texto) > limite) {
        const partes = dividirTexto(texto, limite), parciais: string[] = [];
        for (let i = 0; i < partes.length; i++) parciais.push(await completar(partes[i]!, `Resumindo parte ${i + 1}/${partes.length}`));
        const reduzido = parciais.join('\n\n');
        if (tokensConservadores(reduzido) >= tokensConservadores(texto) || ++rodada > 8) throw new ErroDominio('contexto_excedido', 'As respostas parciais não reduziram o texto. Ajuste prompt, contexto e saída.', 422);
        texto = reduzido;
      }
      const final = await completar(texto, rodada ? 'Consolidando resumo' : 'Gerando resumo');
      this.#trabalhos.concluir(r, { videoId: s.video.id, provedor: c.provedor, modelo: c.modelo, uso }, () => this.#gravar(s, 'pronto', final, null));
    } finally { this.#ativos.set(grupo, Math.max(0, (this.#ativos.get(grupo) ?? 1) - 1)); }
  }

  async historico(videoId: string) {
    if (!await this.#videos.porId(videoId)) throw new ErroNaoEncontrado('Vídeo não encontrado.');
    const atual = await this.#transcricoes.porVideo(videoId);
    const revisaoAtual = atual ? revisaoTranscricao(atual) : null;
    const linhas = this.#banco.db.prepare('SELECT * FROM resumos WHERE video_id=? ORDER BY atualizado_em DESC LIMIT 100').all(videoId) as unknown as Array<Record<string, string | null>>;
    const itens = linhas.map(l => ({ videoId: l.video_id, provedor: l.provedor, modelo: l.modelo, versaoPrompt: l.versao_prompt,
      revisaoTranscricao: l.revisao_transcricao, texto: l.texto, estado: l.estado, erro: l.erro,
      criadoEm: l.criado_em, atualizadoEm: l.atualizado_em, desatualizado: revisaoAtual !== l.revisao_transcricao }));
    const execucoes = this.#banco.db.prepare('SELECT trabalho_id,uso,criado_em FROM resumos_execucoes WHERE video_id=? ORDER BY criado_em DESC LIMIT 100').all(videoId) as unknown as Array<{ trabalho_id: string; uso: string | null; criado_em: string }>;
    return { itens, execucoes: execucoes.map(e => ({ trabalhoId: e.trabalho_id, uso: e.uso ? JSON.parse(e.uso) : null, criadoEm: e.criado_em })) };
  }
}
