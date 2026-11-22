/**
 * Tipos dos módulos da interface que os testes importam diretamente.
 *
 * Por que existe: `tsconfig.json` tem `allowJs: false` e exclui
 * `src/interface/publico`, então `tsc` não consegue inferir os tipos — sem
 * isto, importar `markdown.js` num teste quebra o `npm run build`.
 *
 * Manter os tipos declarados aqui (e não soltos no teste) tem um efeito
 * colateral útil: o contrato do módulo fica explícito num só lugar.
 */

declare module '*/interface/publico/js/markdown.js' {
  /** Renderiza Markdown em `alvo` e devolve o texto puro resultante. */
  export function renderizarMarkdown(texto: string, alvo: HTMLElementLike): string;
  /** URL absoluta permitida (http/https/mailto) ou `null`. */
  export function urlSegura(bruta: unknown): string | null;

  /** Só o que o renderizador usa do elemento — não é o DOM completo. */
  export interface HTMLElementLike {
    replaceChildren(...nos: unknown[]): void;
    append(...nos: unknown[]): void;
    textContent: string;
  }
}

declare module '*/interface/publico/js/preferencias-leitura.js' {
  export const CHAVE_VISUAL: string;
  export const LEITURA_PADRAO: Readonly<{ mostrarTempos: boolean; textoCorrido: boolean }>;
  export const FONTE_RESUMO: Readonly<{ minima: number; maxima: number; padrao: number; passo: number }>;
  export function lerVisual(): Record<string, unknown>;
  export function mesclarVisual(campos: Record<string, unknown>): boolean;
  export function lerLeitura(): { mostrarTempos: boolean; textoCorrido: boolean };
  export function salvarLeitura(leitura: { mostrarTempos?: boolean; textoCorrido?: boolean }): boolean;
  export function lerFonteResumo(): number;
  export function salvarFonteResumo(px: number): boolean;
}
