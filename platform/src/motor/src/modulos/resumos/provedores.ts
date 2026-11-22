import { setTimeout as esperar } from 'node:timers/promises';
import { ErroDominio } from '../../nucleo/erros.ts';
import type { ConfigResumo } from './configuracao.ts';

export interface UsoIA { entrada: number; saida: number; chamadas: number; aproximado: boolean }
export const tokensConservadores = (texto: string) => Buffer.byteLength(texto, 'utf8');

async function lerJson(resposta: Response): Promise<any> {
  const leitor = resposta.body?.getReader();
  if (!leitor) throw new ErroDominio('resposta_invalida', 'O provedor devolveu uma resposta vazia.', 502);
  const partes: Uint8Array[] = [];
  let tamanho = 0;
  try {
    for (;;) {
      const { done, value } = await leitor.read();
      if (done) break;
      tamanho += value.length;
      if (tamanho > 32_000_000) throw new ErroDominio('resposta_invalida', 'Resposta do provedor acima do limite de segurança.', 502);
      partes.push(value);
    }
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
  } catch (e) {
    await leitor.cancel().catch(() => {});
    if (e instanceof ErroDominio) throw e;
    if (e instanceof SyntaxError) throw new ErroDominio('resposta_invalida', 'O provedor não devolveu JSON válido.', 502);
    throw e;
  }
}

export class ClienteProvedor {
  readonly http: typeof fetch;
  constructor(http: typeof fetch = fetch) { this.http = http; }

  async #pedir(c: ConfigResumo, chave: string | null, caminho: string, corpo: unknown, sinal: AbortSignal, fase: (f: string) => void, retentar: boolean) {
    if (['openai', 'anthropic'].includes(c.provedor) && !chave) throw new ErroDominio('chave_ausente', 'Configure a chave deste provedor e endpoint em Configurações.', 412);
    const cabecalhos: Record<string, string> = { 'content-type': 'application/json' };
    if (c.provedor === 'anthropic') {
      cabecalhos['x-api-key'] = chave!;
      cabecalhos['anthropic-version'] = '2023-06-01';
    } else if (chave) cabecalhos.authorization = `Bearer ${chave}`;
    const maximo = retentar ? 3 : 1;
    for (let tentativa = 1; tentativa <= maximo; tentativa++) {
      if (sinal.aborted) throw new ErroDominio('trabalho_cancelado', 'Geração cancelada.', 409);
      let retryAfter = 0;
      try {
        fase(`Consultando provedor — tentativa ${tentativa}/${maximo}`);
        const timeout = AbortSignal.timeout(c.timeoutSegundos * 1000);
        const resposta = await this.http(`${c.baseUrl}${caminho}`, {
          method: corpo === undefined ? 'GET' : 'POST', headers: cabecalhos,
          body: corpo === undefined ? undefined : JSON.stringify(corpo),
          signal: AbortSignal.any([sinal, timeout]), redirect: 'error',
        });
        if (!resposta.ok) {
          const segundos = Number(resposta.headers.get('retry-after'));
          retryAfter = Number.isFinite(segundos) ? Math.min(30000, Math.max(0, segundos * 1000)) : 0;
          await resposta.body?.cancel();
          const status = resposta.status;
          if (status === 401 || status === 403) throw new ErroDominio('auth_invalido', 'O provedor recusou a autenticação. Confira a chave e as permissões.', status);
          if (status === 429) throw new ErroDominio('rate_limit', 'O provedor limitou as solicitações. Aguarde antes de repetir.', 429);
          if (status >= 500) throw new ErroDominio('provedor_indisponivel', 'O provedor está indisponível. Tente novamente mais tarde.', 502);
          throw new ErroDominio('requisicao_provedor_invalida', 'O provedor recusou o pedido. Confira modelo, contexto e limites de saída.', 422);
        }
        return await lerJson(resposta);
      } catch (erro) {
        if (sinal.aborted) throw new ErroDominio('trabalho_cancelado', 'Geração cancelada.', 409);
        const falha = erro instanceof ErroDominio ? erro
          : erro instanceof Error && ['TimeoutError', 'AbortError'].includes(erro.name)
            ? new ErroDominio('timeout_provedor', 'O provedor excedeu o tempo limite.', 504)
            : new ErroDominio('rede_provedor', 'Não foi possível conectar ao provedor. Confira endpoint e conexão.', 503);
        if (!['rate_limit', 'provedor_indisponivel', 'timeout_provedor', 'rede_provedor'].includes(falha.codigo) || tentativa === maximo) throw falha;
        fase(`Aguardando nova tentativa do provedor (${tentativa + 1}/${maximo})`);
        try { await esperar(Math.max(retryAfter, 250 * 2 ** (tentativa - 1)), undefined, { signal: sinal }); }
        catch { throw new ErroDominio('trabalho_cancelado', 'Geração cancelada.', 409); }
      }
    }
    throw new Error('Número de tentativas inválido.');
  }

  async testar(c: ConfigResumo, chave: string | null) {
    const caminho = c.provedor === 'ollama' ? '/api/tags' : '/models';
    const resposta = await this.#pedir(c, chave, caminho, undefined, AbortSignal.timeout(15000), () => {}, false);
    const lista = c.provedor === 'ollama' ? resposta?.models : resposta?.data;
    const modelos: string[] = Array.isArray(lista) ? [...new Set<string>(lista.map(m => m?.id ?? m?.name).filter((m): m is string => typeof m === 'string' && m.length > 0 && m.length <= 200))].slice(0, 200) : [];
    const encontrado = modelos.includes(c.modelo);
    return { disponivel: true, modelos, modeloListado: encontrado,
      mensagem: `Conexão aceita pelo endpoint. Nenhum resumo foi solicitado.${modelos.length ? ` Modelos: ${modelos.join(', ')}.${encontrado ? '' : ' O modelo informado não consta nessa lista; confira o identificador.'}` : ' O endpoint não informou modelos; confira o identificador antes de gerar.'}` };
  }

  async completar(c: ConfigResumo, chave: string | null, prompt: string, sinal: AbortSignal, fase: (f: string) => void): Promise<{ texto: string; uso: UsoIA }> {
    const messages = [{ role: 'user', content: prompt }];
    const corpo = c.provedor === 'ollama'
      ? { model: c.modelo, messages, stream: false, options: { num_ctx: c.contexto, num_predict: c.maxSaida } }
      : c.provedor === 'anthropic'
        ? { model: c.modelo, max_tokens: c.maxSaida, messages }
        : { model: c.modelo, messages, stream: false, [c.provedor === 'openai' ? 'max_completion_tokens' : 'max_tokens']: c.maxSaida };
    const caminho = c.provedor === 'ollama' ? '/api/chat' : c.provedor === 'anthropic' ? '/messages' : '/chat/completions';
    const resposta = await this.#pedir(c, chave, caminho, corpo, sinal, fase, true);
    if (!resposta || typeof resposta !== 'object') throw new ErroDominio('resposta_invalida', 'O provedor não devolveu um objeto de resumo.', 502);
    const escolha = resposta?.choices?.[0];
    const final = c.provedor === 'ollama' ? resposta.done_reason : c.provedor === 'anthropic' ? resposta.stop_reason : escolha?.finish_reason;
    if (['length', 'max_tokens'].includes(final)) throw new ErroDominio('saida_incompleta', 'O limite de saída interrompeu o resumo. Aumente esse limite e confirme uma nova estimativa.', 422);
    const texto = c.provedor === 'ollama' ? resposta?.message?.content
      : c.provedor === 'anthropic' ? (Array.isArray(resposta.content) ? resposta.content.filter((b: any) => b?.type === 'text' && typeof b.text === 'string').map((b: any) => b.text).join('\n') : null)
        : escolha?.message?.content;
    if (typeof texto !== 'string' || !texto.trim()) throw new ErroDominio('resposta_invalida', 'O provedor não devolveu texto de resumo.', 502);
    const entrada = c.provedor === 'ollama' ? resposta.prompt_eval_count : c.provedor === 'anthropic' ? resposta.usage?.input_tokens : resposta.usage?.prompt_tokens;
    const saida = c.provedor === 'ollama' ? resposta.eval_count : c.provedor === 'anthropic' ? resposta.usage?.output_tokens : resposta.usage?.completion_tokens;
    const valido = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
    return { texto: texto.trim(), uso: { entrada: valido(entrada) ? entrada : tokensConservadores(prompt),
      saida: valido(saida) ? saida : tokensConservadores(texto), chamadas: 1, aproximado: !valido(entrada) || !valido(saida) } };
  }
}

export function dividirTexto(texto: string, limite: number): string[] {
  if (limite < 128) throw new ErroDominio('contexto_excedido', 'O prompt deixa pouco contexto para a transcrição. Reduza o prompt ou aumente o contexto.', 422);
  const partes: string[] = [];
  let trecho: string[] = [], bytes = 0;
  for (const caractere of texto) {
    const n = Buffer.byteLength(caractere);
    if (bytes + n > limite) { partes.push(trecho.join('')); trecho = []; bytes = 0; }
    trecho.push(caractere); bytes += n;
  }
  if (trecho.length) partes.push(trecho.join(''));
  if (partes.length > 100) throw new ErroDominio('contexto_excedido', 'Este texto exigiria mais de 100 partes. Aumente o contexto antes de gerar.', 422);
  return partes;
}
