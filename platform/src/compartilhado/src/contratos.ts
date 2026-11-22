/**
 * Contratos públicos compartilhados entre o motor (backend) e a interface (frontend).
 *
 * Regra do projeto: nenhum dos dois lados importa detalhes internos do outro.
 * Tudo o que atravessa a fronteira HTTP está declarado aqui.
 */

// ---------------------------------------------------------------------------
// Identidade e estados
// ---------------------------------------------------------------------------

/** Identificador interno imutável de um vídeo. Nunca é o ID do YouTube. */
export type IdVideo = string;

/** Estados de um item na biblioteca. */
export type EstadoVideo = 'novo' | 'importando' | 'pronto' | 'parcial' | 'erro';

/** Proveniência da transcrição — o usuário precisa saber o que está lendo. */
export type OrigemTranscricao = 'manual' | 'auto' | 'importado';

/** Estado da transcrição. `indisponivel` é explícito: não fingimos conclusão. */
export type EstadoTranscricao = 'pendente' | 'pronta' | 'indisponivel' | 'erro';

/** Estado de um resumo gerado por IA. */
export type EstadoResumo = 'pendente' | 'processando' | 'pronto' | 'erro';

// ---------------------------------------------------------------------------
// Entidades
// ---------------------------------------------------------------------------

export interface Video {
  id: IdVideo;
  youtubeId: string;
  titulo: string;
  canalId: string | null;
  canalNome: string | null;
  duracaoSegundos: number | null;
  url: string;
  miniaturaUrl: string | null;
  publicadoEm: string | null; // ISO-8601
  estado: EstadoVideo;
  criadoEm: string; // ISO-8601
  atualizadoEm: string; // ISO-8601
  /** F5: IDs das coleções às quais o vídeo pertence. */
  colecaoIds?: string[];
  playlistIds?: string[];
  /** F5: atalho para UI evitar join com tabela resumos. */
  temResumo?: boolean;
  /** F6: estado do resumo exibido, sem carregar seu texto na consulta. */
  estadoResumo?: EstadoResumo;
}

export interface SegmentoTranscricao {
  inicioMs: number;
  fimMs: number;
  texto: string;
}

export interface Transcricao {
  videoId: IdVideo;
  idioma: string; // BCP-47, ex.: 'pt-BR'
  origem: OrigemTranscricao;
  estado: EstadoTranscricao;
  segmentos: SegmentoTranscricao[];
  /** Mensagem legível quando não há legenda. Nunca vazio em `indisponivel`. */
  motivo: string | null;
  codigoMotivo?: string | null;
  atualizadoEm: string;
}

export interface Resumo {
  videoId: IdVideo;
  provedor: string;
  modelo: string;
  versaoPrompt: string;
  /** Revisão da transcrição usada; garante rastreabilidade do que foi resumido. */
  revisaoTranscricao: string;
  texto: string | null;
  estado: EstadoResumo;
  erro: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface Colecao {
  id: string;
  titulo: string;
  contagem: number;
}

/** F5: ações em lote disponíveis na Biblioteca. */
export type AcaoLote = 'reimportar' | 'remover' | 'colecao';

// ---------------------------------------------------------------------------
// Trabalhos (fila persistente)
// ---------------------------------------------------------------------------

export type TipoTrabalho = 'importar-video' | 'importar-playlist' | 'importar-lote' | 'gerar-resumo';
export type EstadoTrabalho = 'na-fila' | 'executando' | 'concluido' | 'falhou' | 'cancelado';

export interface Trabalho {
  id: string;
  tipo: TipoTrabalho;
  estado: EstadoTrabalho;
  /** 0..1, ou null quando indeterminado. */
  progresso: number | null;
  tentativas: number;
  erro: string | null;
  criadoEm: string;
  atualizadoEm: string;
}

export interface TrabalhoDetalhado extends Trabalho {
  titulo: string;
  fase: string;
  paiId: string | null;
  videoId: string | null;
  cancelamentoSolicitado: boolean;
  erroCodigo: string | null;
  resultado: unknown;
  iniciadoEm: string | null;
  finalizadoEm: string | null;
  contadores: { total: number; concluidos: number; falhos: number; cancelados: number; semLegenda: number };
}

// ---------------------------------------------------------------------------
// Configuração (preferências e segredos são separados de propósito)
// ---------------------------------------------------------------------------

export interface Preferencias {
  tema: 'grafite';
  pastaDados: string | null;
  provedorResumo: string | null;
  modeloResumo: string | null;
  promptResumo: string | null;
}

// ---------------------------------------------------------------------------
// Protocolo HTTP — envelope único de resposta
// ---------------------------------------------------------------------------

export interface RespostaOk<T> {
  ok: true;
  dados: T;
}

export interface RespostaErro {
  ok: false;
  erro: {
    /** Código estável para a interface tratar sem comparar texto. */
    codigo: string;
    mensagem: string;
  };
}

export type Resposta<T> = RespostaOk<T> | RespostaErro;
