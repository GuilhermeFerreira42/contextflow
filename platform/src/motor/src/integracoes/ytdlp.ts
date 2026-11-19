/**
 * Adaptador do yt-dlp: a única parte do sistema que executa um processo externo.
 *
 * Regras que a F3 estabelece e que **não** podem ser afrouxadas:
 *  - `spawn` com array de argumentos e `shell: false` — a URL nunca é
 *    concatenada numa linha de comando.
 *  - Timeout por operação com `kill` real do processo filho.
 *  - Todo arquivo temporário vive num diretório próprio criado com `mkdtemp` e
 *    é apagado no `finally`, inclusive quando dá erro.
 *  - Erro do yt-dlp é traduzido para erro de domínio; o texto cru fica no log.
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { ErroDominio, ErroIndisponivel } from '../nucleo/erros.ts';
import { normalizarLegenda } from './legendas.ts';
import type { SegmentoTranscricao } from '@contextflow/compartilhado';

// ------------------------------------------------------------------ tipos ----

export interface MetadadosYtdlp {
  id: string;
  titulo: string;
  canalId: string | null;
  canalNome: string | null;
  duracaoSegundos: number | null;
  miniaturaUrl: string | null;
  publicadoEm: string | null;
  legendasManuais: string[];
  legendasAutomaticas: string[];
}

export interface LegendaBaixada {
  idioma: string;
  origem: 'manual' | 'auto';
  segmentos: SegmentoTranscricao[];
}

export interface ExecutorYtdlp {
  disponivel(): Promise<{ disponivel: boolean; versao: string | null; caminho: string }>;
  inspecionar(url: string): Promise<MetadadosYtdlp>;
  baixarLegenda(url: string, idiomas: string[]): Promise<LegendaBaixada | null>;
}

export interface OpcoesYtdlp {
  binario?: string;
  timeoutMs?: number;
  /** Injetável nos testes: substitui a execução real do processo. */
  registrarErro?: (mensagem: string) => void;
}

// --------------------------------------------------------------- execução ----

interface ResultadoProcesso {
  codigo: number;
  stdout: string;
  stderr: string;
}

function executar(
  binario: string,
  args: string[],
  timeoutMs: number,
  aoErro: (mensagem: string) => void,
): Promise<ResultadoProcesso> {
  return new Promise((resolver, rejeitar) => {
    let finalizado = false;

    const filho = spawn(binario, args, { shell: false, windowsHide: true });

    const temporizador = setTimeout(() => {
      if (finalizado) return;
      finalizado = true;
      filho.kill('SIGKILL');
      rejeitar(
        new ErroDominio(
          'ytdlp_timeout',
          `O YouTube não respondeu em ${Math.round(timeoutMs / 1000)} s. Tente de novo.`,
          504,
        ),
      );
    }, timeoutMs);

    let stdout = '';
    let stderr = '';

    filho.stdout?.on('data', (pedaco: Buffer) => {
      stdout += pedaco.toString('utf8');
    });
    filho.stderr?.on('data', (pedaco: Buffer) => {
      stderr += pedaco.toString('utf8');
    });

    filho.on('error', (erro: NodeJS.ErrnoException) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(temporizador);

      if (erro.code === 'ENOENT') {
        rejeitar(
          new ErroIndisponivel(
            'O yt-dlp não está instalado ou não está no PATH. Instale com ' +
              '"pip install -U yt-dlp" ou defina CONTEXTFLOW_YTDLP com o caminho do executável.',
          ),
        );
        return;
      }
      rejeitar(new ErroIndisponivel(`Não foi possível executar o yt-dlp: ${erro.message}`));
    });

    filho.on('close', (codigo) => {
      if (finalizado) return;
      finalizado = true;
      clearTimeout(temporizador);

      if (stderr.trim().length > 0) aoErro(stderr.trim());
      resolver({ codigo: codigo ?? -1, stdout, stderr });
    });
  });
}

// ------------------------------------------------------------ tradução -------

/**
 * Traduz o erro do yt-dlp em erro de domínio. A ordem importa: as mensagens
 * mais específicas primeiro.
 */
export function traduzirErroYtdlp(stderr: string): ErroDominio {
  const texto = stderr.toLowerCase();

  // ORDEM IMPORTA. Problemas de rede/TLS vêm primeiro: o texto de um erro de
  // rede costuma conter "unable to download", e o de restrição de idade contém
  // "age" em qualquer frase. Classificar antes de olhar a condição específica
  // produz diagnóstico errado — o usuário recebe "restrição de idade" quando o
  // problema é a conexão.
  const rede =
    texto.includes('ssl') ||
    texto.includes('tls') ||
    texto.includes('connection reset') ||
    texto.includes('connection refused') ||
    texto.includes('connection has been closed') ||
    texto.includes('timed out') ||
    texto.includes('getaddrinfo') ||
    texto.includes('name or service not known') ||
    texto.includes('temporary failure in name resolution');

  if (rede) {
    return new ErroIndisponivel(
      'Não foi possível alcançar o YouTube: a conexão foi recusada ou encerrada. ' +
        'Verifique sua internet, proxy ou firewall.',
    );
  }

  // Restrição de idade: só quando a mensagem fala explicitamente em confirmar
  // idade. `age` sozinho aparece em mensagens irrelevantes.
  if (
    texto.includes('sign in to confirm your age') ||
    texto.includes('confirm your age') ||
    texto.includes('age-restricted') ||
    texto.includes('inappropriate for some users')
  ) {
    return new ErroDominio('video_indisponivel', 'Este vídeo tem restrição de idade.', 502);
  }

  if (texto.includes('private video')) {
    return new ErroDominio('video_indisponivel', 'Este vídeo é privado.', 502);
  }
  if (texto.includes('members-only') || texto.includes('join this channel')) {
    return new ErroDominio('video_indisponivel', 'Este vídeo é exclusivo para membros do canal.', 502);
  }
  if (
    texto.includes('video unavailable') ||
    texto.includes('this video is unavailable') ||
    texto.includes('has been removed') ||
    texto.includes('does not exist') ||
    texto.includes('no longer available')
  ) {
    return new ErroDominio('video_indisponivel', 'Este vídeo não está mais disponível.', 502);
  }
  if (texto.includes('unable to download') || texto.includes('http error')) {
    return new ErroIndisponivel('O YouTube não entregou os dados. Tente de novo em instantes.');
  }
  if (texto.includes('sign in') || texto.includes('cookies')) {
    return new ErroDominio(
      'video_indisponivel',
      'O YouTube pediu autenticação (vídeo privado, de membros ou com verificação).',
      502,
    );
  }
  return new ErroDominio('ingestao_falhou', 'A ingestão falhou. Veja o log para o detalhe.', 502);
}

// ------------------------------------------------------------- adaptador -----

interface JsonYtdlp {
  id?: string;
  title?: string;
  channel_id?: string;
  channel?: string;
  uploader_id?: string;
  uploader?: string;
  duration?: number;
  thumbnail?: string;
  upload_date?: string;
  subtitles?: Record<string, unknown>;
  automatic_captions?: Record<string, unknown>;
}

export class Ytdlp implements ExecutorYtdlp {
  readonly #binario: string;
  readonly #timeoutMs: number;
  readonly #aoErro: (mensagem: string) => void;

  constructor(opcoes: OpcoesYtdlp = {}) {
    this.#binario = opcoes.binario ?? process.env.CONTEXTFLOW_YTDLP ?? 'yt-dlp';
    this.#timeoutMs = opcoes.timeoutMs ?? Number(process.env.CONTEXTFLOW_YTDLP_TIMEOUT ?? 60_000);
    this.#aoErro = opcoes.registrarErro ?? (() => {});
  }

  async disponivel(): Promise<{ disponivel: boolean; versao: string | null; caminho: string }> {
    try {
      const resultado = await executar(this.#binario, ['--version'], 10_000, this.#aoErro);
      const versao = resultado.stdout.trim().split('\n')[0] ?? null;
      return { disponivel: resultado.codigo === 0, versao, caminho: this.#binario };
    } catch {
      return { disponivel: false, versao: null, caminho: this.#binario };
    }
  }

  async inspecionar(url: string): Promise<MetadadosYtdlp> {
    const args = [
      '--dump-single-json',
      '--skip-download',
      '--no-warnings',
      '--no-playlist',
      '--no-progress',
      url,
    ];

    const resultado = await executar(this.#binario, args, this.#timeoutMs, this.#aoErro);
    if (resultado.codigo !== 0) throw traduzirErroYtdlp(resultado.stderr);

    let dados: JsonYtdlp;
    try {
      dados = JSON.parse(resultado.stdout) as JsonYtdlp;
    } catch {
      throw new ErroDominio('ingestao_falhou', 'O yt-dlp devolveu dados ilegíveis.', 502);
    }

    if (typeof dados.id !== 'string' || typeof dados.title !== 'string') {
      throw new ErroDominio('ingestao_falhou', 'O yt-dlp não devolveu os metadados esperados.', 502);
    }

    return {
      id: dados.id,
      titulo: dados.title,
      canalId: dados.channel_id ?? dados.uploader_id ?? null,
      canalNome: dados.channel ?? dados.uploader ?? null,
      duracaoSegundos: typeof dados.duration === 'number' ? Math.round(dados.duration) : null,
      miniaturaUrl: dados.thumbnail ?? null,
      publicadoEm: normalizarDataPublicacao(dados.upload_date) ?? null,
      legendasManuais: Object.keys(dados.subtitles ?? {}),
      legendasAutomaticas: Object.keys(dados.automatic_captions ?? {}),
    };
  }

  /**
   * Baixa a legenda no primeiro idioma que existir. Manual tem prioridade:
   * legendas automáticas são piores e o usuário precisa saber qual está lendo.
   */
  async baixarLegenda(url: string, idiomas: string[]): Promise<LegendaBaixada | null> {
    const metadados = await this.inspecionar(url);

    const manual = escolherIdioma(metadados.legendasManuais, idiomas);
    const origem: 'manual' | 'auto' = manual ? 'manual' : 'auto';
    const automatica = manual ? null : escolherIdioma(metadados.legendasAutomaticas, idiomas);

    const idioma = manual ?? automatica;
    if (!idioma) return null;

    const pasta = await mkdtemp(join(tmpdir(), 'contextflow-legenda-'));

    try {
      const args = [
        '--skip-download',
        origem === 'manual' ? '--write-subs' : '--write-auto-subs',
        '--sub-langs',
        idioma,
        '--sub-format',
        'vtt/json3',
        '--no-warnings',
        '--no-playlist',
        '--no-progress',
        '-o',
        join(pasta, '%(id)s.%(ext)s'),
        url,
      ];

      const resultado = await executar(this.#binario, args, this.#timeoutMs, this.#aoErro);
      if (resultado.codigo !== 0) throw traduzirErroYtdlp(resultado.stderr);

      const arquivos = await readdir(pasta);
      if (arquivos.length === 0) {
        throw new ErroDominio(
          'ingestao_falhou',
          'O yt-dlp não gravou o arquivo de legenda.',
          502,
        );
      }

      const nome = arquivos.find((a) => a.endsWith('.json3')) ?? arquivos.find((a) => a.endsWith('.vtt'));
      if (!nome) {
        throw new ErroDominio('ingestao_falhou', 'Formato de legenda não reconhecido.', 502);
      }

      const conteudo = await readFile(join(pasta, nome), 'utf8');
      const formato = nome.endsWith('.json3') ? 'json3' : 'vtt';
      const segmentos = normalizarLegenda(conteudo, formato);

      if (segmentos.length === 0) {
        throw new ErroDominio(
          'ingestao_falhou',
          'A legenda veio vazia depois da normalização.',
          502,
        );
      }

      return { idioma, origem, segmentos };
    } finally {
      await rm(pasta, { recursive: true, force: true }).catch(() => {});
    }
  }
}

// --------------------------------------------------------------- auxiliares --

function escolherIdioma(disponiveis: string[], preferidos: string[]): string | null {
  for (const preferido of preferidos) {
    const exato = disponiveis.find((d) => d.toLowerCase() === preferido.toLowerCase());
    if (exato) return exato;
  }
  for (const preferido of preferidos) {
    const base = preferido.split('-')[0]!.toLowerCase();
    const parcial = disponiveis.find((d) => d.toLowerCase().split('-')[0] === base);
    if (parcial) return parcial;
  }
  // Sem correspondência exata: usar o primeiro disponível, mas só se houver
  if (disponiveis.length > 0) return disponiveis[0]!;
  return null;
}

/** `20240115` → `2024-01-15T00:00:00.000Z`; vazio/ inválido → null. */
export function normalizarDataPublicacao(bruta: string | undefined): string | null {
  if (!bruta || !/^\d{8}$/.test(bruta)) return null;
  const ano = Number(bruta.slice(0, 4));
  const mes = Number(bruta.slice(4, 6));
  const dia = Number(bruta.slice(6, 8));
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null;
  const data = new Date(Date.UTC(ano, mes - 1, dia));
  if (Number.isNaN(data.getTime())) return null;
  return data.toISOString();
}
