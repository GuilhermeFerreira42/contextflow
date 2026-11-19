/**
 * Ponto de entrada do motor.
 *
 * Executado por `scripts/dev.mjs` (desenvolvimento) e `scripts/start.mjs` (build).
 * Falha de forma explícita e com código de saída diferente de zero.
 */
import { carregarConfig } from './nucleo/configuracao.ts';
import { criarAplicacao } from './aplicacao.ts';

export async function iniciar(args: { porta?: number; host?: string } = {}) {
  const config = carregarConfig();
  if (args.porta !== undefined) config.porta = args.porta;
  if (args.host !== undefined) config.host = args.host;

  const aplicacao = criarAplicacao(config);

  await new Promise<void>((ok, falhou) => {
    aplicacao.servidor.once('error', falhou);
    aplicacao.servidor.listen(config.porta, config.host, () => ok());
  });

  const endereco = aplicacao.servidor.address();
  const portaReal = typeof endereco === 'object' && endereco ? endereco.port : config.porta;
  aplicacao.registrador.info('motor pronto', {
    url: `http://${config.host}:${portaReal}`,
    ambiente: config.ambiente,
    pastaDados: config.pastaDados,
  });

  return { ...aplicacao, porta: portaReal };
}

// Execução direta: `node src/motor/src/principal.ts`
if (import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  iniciar()
    .then((app) => {
      const encerrar = async () => {
        await app.encerrar();
        process.exit(0);
      };
      process.on('SIGINT', encerrar);
      process.on('SIGTERM', encerrar);
    })
    .catch((erro: unknown) => {
      process.stderr.write(`falha ao iniciar o motor: ${erro instanceof Error ? erro.message : String(erro)}\n`);
      process.exit(1);
    });
}
