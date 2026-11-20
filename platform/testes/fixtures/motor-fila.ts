/** Processo descartável para provas de queda/lease. Nunca importado pelo produto. */
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import type { ExecutorYtdlp } from '../../src/motor/src/integracoes/ytdlp.ts';
import { ErroDominio } from '../../src/motor/src/nucleo/erros.ts';
import { setTimeout as dormir } from 'node:timers/promises';
const executor: ExecutorYtdlp = {
    async disponivel() { return { disponivel: true, versao: 'fixture-processo', caminho: 'dublê' }; },
    async inspecionar(url, sinal) {
        console.log('METADADOS ' + url);
        while (process.env.F4_BLOQUEAR === 'metadados') {
            if (sinal?.aborted)
                throw new ErroDominio('trabalho_cancelado', 'Cancelado.', 409);
            await dormir(20);
        }
        return { id: new URL(url).searchParams.get('v')!, titulo: 'Título persistido por outro processo',
            canalId: 'canal', canalNome: 'Canal entre processos', duracaoSegundos: 10, miniaturaUrl: null, publicadoEm: null,
            legendasManuais: ['pt'], legendasAutomaticas: [] };
    },
    async baixarLegenda(_url, _idiomas, sinal) {
        console.log('LEGENDA');
        while (process.env.F4_BLOQUEAR === 'legenda') {
            if (sinal?.aborted)
                throw new ErroDominio('trabalho_cancelado', 'Cancelado.', 409);
            await dormir(20);
        }
        return { idioma: 'pt', origem: 'manual', segmentos: [{ inicioMs: 0, fimMs: 1000, texto: 'Sobrevive ao reinício.' }] };
    },
    async descobrirPlaylist(_url, aoItem, sinal) {
        aoItem({ youtubeId: 'aaaaaaaaaaa', titulo: 'Primeiro', posicao: 0 });
        console.log('DESCOBERTA');
        while (process.env.F4_BLOQUEAR === 'descoberta') {
            if (sinal?.aborted)
                throw new ErroDominio('trabalho_cancelado', 'Cancelado.', 409);
            await dormir(20);
        }
        aoItem({ youtubeId: 'bbbbbbbbbbb', titulo: 'Segundo', posicao: 1 });
    },
};
const config = carregarConfig({ ...process.env, CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste' });
const app = criarAplicacao(config, { executorYtdlp: executor });
app.iniciarPersistencia();
if (process.env.F4_BLOQUEAR === 'fila') await app.trabalhos.encerrar();
await new Promise<void>(ok => app.servidor.listen(0, '127.0.0.1', ok));
const endereco = app.servidor.address();
if (endereco && typeof endereco === 'object')
    console.log('PRONTO ' + endereco.port);
process.on('SIGTERM', () => { void app.encerrar().then(() => process.exit(0)); });
