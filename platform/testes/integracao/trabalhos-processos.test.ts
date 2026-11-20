import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { mkdtemp, rm } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { setTimeout as dormir } from 'node:timers/promises';
import { Banco } from '../../src/motor/src/persistencia/banco.ts';
import type { TrabalhoDetalhado } from '@contextflow/compartilhado';
const limpezas = new Map<string, Set<() => Promise<void>>>();

test('intenção aceita sobrevive sem iniciar execução e é consumida por outro processo', async t => {
    const p = await pasta(t);
    const primeiro = await iniciar(t, p, 'fila');
    const j = await criar(primeiro.base);
    assert.equal(j.estado, 'na-fila');
    assert.equal(j.tentativas, 0);
    await primeiro.matar();
    const segundo = await iniciar(t, p);
    await esperar(async () => (await segundo.obter(j.id)).estado === 'concluido');
    assert.equal((await segundo.obter(j.id)).tentativas, 1);
});
async function esperar(acao: () => Promise<boolean> | boolean) {
    for (let i = 0; i < 750; i++) {
        if (await acao())
            return;
        await dormir(20);
    }
    throw new Error('Processo não atingiu o estado esperado.');
}
async function pasta(t: TestContext) {
    const p = await mkdtemp(join(tmpdir(), 'contextflow-processos-'));
    limpezas.set(p, new Set());
    t.after(async () => {
        await Promise.allSettled([...limpezas.get(p)!].map(matar => matar()));
        limpezas.delete(p);
        assert.equal(resolve(dirname(p)), resolve(tmpdir()));
        await rm(p, { recursive: true, force: true });
    });
    return p;
}
async function iniciar(t: TestContext, p: string, bloquear = '') {
    const filho = spawn(process.execPath, ['--experimental-sqlite', '--experimental-strip-types', '--disable-warning=ExperimentalWarning', fileURLToPath(new URL('../fixtures/motor-fila.ts', import.meta.url))], {
        env: { ...process.env, CONTEXTFLOW_DADOS: p, F4_BLOQUEAR: bloquear }, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let saida = '', erros = '';
    filho.stdout.on('data', d => { saida += d.toString(); });
    filho.stderr.on('data', d => { erros += d.toString(); });
    const matar = async () => { if (filho.exitCode !== null || filho.signalCode)
        return; const terminou = once(filho, 'exit'); filho.kill('SIGKILL'); await terminou; };
    limpezas.get(p)!.add(matar);
    await esperar(() => { if (filho.exitCode !== null)
        throw new Error(erros || saida); return /PRONTO \d+/.test(saida); });
    const base = `http://127.0.0.1:${saida.match(/PRONTO (\d+)/)![1]}`;
    return { filho, matar, base, saida: () => saida, obter: async (id: string) => (await (await fetch(base + '/api/trabalhos/' + id)).json() as {
            dados: TrabalhoDetalhado;
        }).dados };
}
async function criar(base: string, tipo = 'importar-video', chave = randomUUID()) {
    const resposta = await fetch(base + '/api/trabalhos', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ tipo, escopo: { url: tipo === 'importar-playlist' ? 'https://youtube.com/playlist?list=PLteste' : 'https://youtube.com/watch?v=aaaaaaaaaaa', chaveRequisicao: chave } }) });
    assert.equal(resposta.status, 202);
    return (await resposta.json() as {
        dados: TrabalhoDetalhado;
    }).dados;
}
function expirarLease(p: string) {
    const banco = Banco.abrir({ arquivo: join(p, 'contextflow.db') });
    try {
        banco.db.exec('UPDATE executor_fila SET expira=0');
    }
    finally {
        banco.fechar();
    }
}
for (const fase of ['metadados', 'legenda', 'descoberta'])
    test(`SIGKILL durante ${fase}: outro processo retoma sem duplicar`, async (t) => {
        const p = await pasta(t);
        const primeiro = await iniciar(t, p, fase);
        const j = await criar(primeiro.base, fase === 'descoberta' ? 'importar-playlist' : 'importar-video');
        await esperar(() => primeiro.saida().includes(fase === 'metadados' ? 'METADADOS ' : fase === 'legenda' ? 'LEGENDA' : 'DESCOBERTA'));
        await primeiro.matar();
        expirarLease(p);
        const segundo = await iniciar(t, p);
        let final: TrabalhoDetalhado;
        await esperar(async () => { final = await segundo.obter(j.id); return final.estado === 'concluido'; });
        assert.equal(final!.tentativas, 2);
        assert.equal(final!.progresso, 1);
        await segundo.matar();
        const banco = Banco.abrir({ arquivo: join(p, 'contextflow.db') });
        try {
            const total = fase === 'descoberta' ? 2 : 1;
            assert.equal(banco.db.prepare('SELECT COUNT(*) n FROM videos').get()!.n, total);
            assert.equal(banco.db.prepare('SELECT COUNT(*) n FROM segmentos').get()!.n, total);
            assert.ok(Number(banco.db.prepare("SELECT COUNT(*) n FROM tentativas_trabalho WHERE estado='interrompido'").get()!.n) >= 1);
        }
        finally {
            banco.fechar();
        }
    });
test('duas instâncias: só o dono executa e cancelamento pedido pela segunda chega à primeira', async (t) => {
    const p = await pasta(t);
    const primeiro = await iniciar(t, p, 'metadados');
    const segundo = await iniciar(t, p);
    const j = await criar(segundo.base);
    await esperar(() => primeiro.saida().includes('METADADOS '));
    assert.ok(!segundo.saida().includes('METADADOS '));
    const r = await fetch(segundo.base + `/api/trabalhos/${j.id}/cancelar`, { method: 'POST' });
    assert.equal(r.status, 202);
    await esperar(async () => (await segundo.obter(j.id)).estado === 'cancelado');
    assert.ok(!segundo.saida().includes('METADADOS '));
});
test('queda após conclusão preserva conteúdo completo e não reexecuta a tarefa', async (t) => {
    const p = await pasta(t);
    const primeiro = await iniciar(t, p);
    const j = await criar(primeiro.base);
    await esperar(async () => (await primeiro.obter(j.id)).estado === 'concluido');
    const antes = await primeiro.obter(j.id);
    await primeiro.matar();
    expirarLease(p);
    const segundo = await iniciar(t, p);
    assert.deepEqual(await segundo.obter(j.id), antes);
    assert.ok(!segundo.saida().includes('METADADOS '));
});
test('posse expirada com executor antigo vivo: somente a nova geração grava conteúdo', async (t) => {
    const p = await pasta(t);
    const primeiro = await iniciar(t, p, 'metadados');
    const j = await criar(primeiro.base);
    await esperar(() => primeiro.saida().includes('METADADOS '));
    expirarLease(p);
    const segundo = await iniciar(t, p);
    await esperar(async () => (await segundo.obter(j.id)).estado === 'concluido');
    const fim = await segundo.obter(j.id);
    assert.equal(fim.tentativas, 2);
    await dormir(200);
    assert.deepEqual(await primeiro.obter(j.id), fim);
});
test('cancelamento persistido sobrevive a queda e não volta a executar após reinício', async (t) => {
    const p = await pasta(t);
    const primeiro = await iniciar(t, p, 'metadados');
    const j = await criar(primeiro.base);
    await esperar(() => primeiro.saida().includes('METADADOS '));
    await fetch(primeiro.base + `/api/trabalhos/${j.id}/cancelar`, { method: 'POST' });
    await primeiro.matar();
    expirarLease(p);
    const segundo = await iniciar(t, p);
    await esperar(async () => (await segundo.obter(j.id)).estado === 'cancelado');
    assert.ok(!segundo.saida().includes('METADADOS '));
});

test('duas instancias repetindo a mesma chave simultaneamente criam um unico trabalho', async t => {
    const p = await pasta(t);
    const primeiro = await iniciar(t, p, 'metadados');
    const segundo = await iniciar(t, p);
    const chave = randomUUID();
    const [a, b] = await Promise.all([criar(primeiro.base, 'importar-video', chave), criar(segundo.base, 'importar-video', chave)]);
    assert.equal(a.id, b.id);
    const pagina = await (await fetch(segundo.base + '/api/trabalhos')).json() as {dados:{itens:unknown[]}};
    assert.equal(pagina.dados.itens.length, 1);
});
