/**
 * Camada HTTP mínima sobre `node:http`.
 *
 * Não traz framework: o V1 é um aplicativo local, e o conjunto de rotas é pequeno
 * e conhecido. Menos dependência = menos superfície e instalação mais simples nos
 * dois SOs.
 */
import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import type { Resposta } from '@contextflow/compartilhado';
import { ErroDominio } from './erros.ts';
import type { Registrador } from './registro.ts';

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface Requisicao {
  metodo: Metodo;
  caminho: string;
  consulta: URLSearchParams;
  corpo: unknown;
}

export interface ContextoRequisicao {
  requisicao: Requisicao;
  registrador: Registrador;
}

export type Manipulador = (ctx: ContextoRequisicao) => Promise<unknown> | unknown;

export class ResultadoHttp {
  dados: unknown;
  status: number;
  cabecalhos: Record<string, string>;
  constructor(dados: unknown, status=200, cabecalhos: Record<string,string>={}) {
    this.dados=dados; this.status=status; this.cabecalhos=cabecalhos;
  }
}

interface Rota {
  metodo: Metodo;
  segmentos: string[];
  manipulador: Manipulador;
}

const LIMITE_CORPO_BYTES = 1_000_000;

export class Roteador {
  private rotas: Rota[] = [];

  adicionar(metodo: Metodo, caminho: string, manipulador: Manipulador): this {
    this.rotas.push({ metodo, segmentos: caminho.split('/').filter(Boolean), manipulador });
    return this;
  }

  obter(caminho: string, manipulador: Manipulador): this {
    return this.adicionar('GET', caminho, manipulador);
  }

  postar(caminho: string, manipulador: Manipulador): this {
    return this.adicionar('POST', caminho, manipulador);
  }

  remover(caminho: string, manipulador: Manipulador): this {
    return this.adicionar('DELETE', caminho, manipulador);
  }

  /** Casa `:param` com qualquer segmento e devolve os parâmetros capturados. */
  casar(metodo: string, caminho: string): { manipulador: Manipulador; params: Record<string, string> } | null {
    const partes = caminho.split('/').filter(Boolean);
    for (const rota of this.rotas) {
      if (rota.metodo !== metodo) continue;
      if (rota.segmentos.length !== partes.length) continue;

      const params: Record<string, string> = {};
      let casa = true;
      for (let i = 0; i < rota.segmentos.length; i++) {
        const definido = rota.segmentos[i]!;
        const recebido = partes[i]!;
        if (definido.startsWith(':')) {
          params[definido.slice(1)] = decodeURIComponent(recebido);
        } else if (definido !== recebido) {
          casa = false;
          break;
        }
      }
      if (casa) return { manipulador: rota.manipulador, params };
    }
    return null;
  }
}

async function lerCorpo(req: IncomingMessage): Promise<unknown> {
  const partes: Buffer[] = [];
  let total = 0;
  for await (const bloco of req) {
    const buf = Buffer.isBuffer(bloco) ? bloco : Buffer.from(bloco as string);
    total += buf.length;
    if (total > LIMITE_CORPO_BYTES) {
      throw new ErroDominio('corpo_grande', 'Corpo da requisição excede o limite', 413);
    }
    partes.push(buf);
  }
  if (total === 0) return undefined;
  const texto = Buffer.concat(partes).toString('utf8');
  try {
    return JSON.parse(texto);
  } catch {
    throw new ErroDominio('json_invalido', 'Corpo da requisição não é JSON válido', 400);
  }
}

function responder(res: ServerResponse, status: number, corpo: Resposta<unknown>): void {
  const json = JSON.stringify(corpo);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(json),
    // Aplicação local: nenhum recurso externo deve consumir esta API.
    'cache-control': 'no-store',
  });
  res.end(json);
}

export function criarServidorApi(roteador: Roteador, registrador: Registrador): Server {
  return createServer(async (req, res) => {
    const inicio = Date.now();
    try {
      const url = new URL(req.url ?? '/', 'http://localhost');
      const caminho = url.pathname;

      if (caminho.startsWith('/api/')) {
        const resultado = roteador.casar(req.method ?? 'GET', caminho);
        if (!resultado) {
          responder(res, 404, { ok: false, erro: { codigo: 'rota_desconhecida', mensagem: `Rota não encontrada: ${req.method} ${caminho}` } });
          return;
        }

        const requisicao: Requisicao = {
          metodo: (req.method ?? 'GET') as Metodo,
          caminho,
          consulta: url.searchParams,
          corpo: await lerCorpo(req),
        };
        const dados = await resultado.manipulador({ requisicao, registrador });
        if (dados instanceof ResultadoHttp) {
          for (const [nome, valor] of Object.entries(dados.cabecalhos)) res.setHeader(nome, valor);
          responder(res, dados.status, { ok: true, dados: dados.dados });
        } else responder(res, 200, { ok: true, dados });
        return;
      }

      responder(res, 404, { ok: false, erro: { codigo: 'rota_desconhecida', mensagem: `Rota não encontrada: ${caminho}` } });
    } catch (erro) {
      if (erro instanceof ErroDominio) {
        responder(res, erro.statusHttp, { ok: false, erro: { codigo: erro.codigo, mensagem: erro.message } });
        return;
      }
      registrador.erro('falha não tratada no servidor', {
        erro: erro instanceof Error ? erro.message : String(erro),
      });
      responder(res, 500, {
        ok: false,
        erro: { codigo: 'erro_interno', mensagem: 'Falha interna do motor. Consulte o registro.' },
      });
    } finally {
      registrador.debug('requisição processada', { caminho: req.url, ms: Date.now() - inicio });
    }
  });
}
