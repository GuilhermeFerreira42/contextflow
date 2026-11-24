import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, rm, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import { setTimeout as dormir } from 'node:timers/promises';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { ErroDominio } from '../../src/motor/src/nucleo/erros.ts';
import { Banco, MIGRACOES } from '../../src/motor/src/persistencia/banco.ts';
import { RepositorioTrabalhos } from '../../src/motor/src/persistencia/repositorio-trabalhos.ts';
import { executarProcesso, type ExecutorYtdlp, type ItemPlaylist } from '../../src/motor/src/integracoes/ytdlp.ts';
import type { TrabalhoDetalhado } from '@contextflow/compartilhado';
const url = (id = 'aaaaaaaaaaa') => `https://www.youtube.com/watch?v=${id}`;
const tempoLimite = 15000;
async function ate<T>(ler: () => T | Promise<T>, aceitar: (valor: T) => boolean, limite = tempoLimite): Promise<T> {
    const fim = Date.now() + limite;
    while (Date.now() < fim) {
        const valor = await ler();
        if (aceitar(valor))
            return valor;
        await dormir(20);
    }
    throw new Error('Condição não foi atingida antes do limite.');
}
class ExecutorTeste implements ExecutorYtdlp {
    bloquear = false;
    ativos = 0;
    maximo = 0;
    chamadas: string[] = [];
    abortos = 0;
    falharLegenda = false;
    falharMetadados = false;
    semLegenda = new Set<string>();
    playlist: ItemPlaylist[] = [];
    falharDescoberta = false;
    async disponivel() { return { disponivel: true, versao: 'teste-f4', caminho: 'dublê' }; }
    async inspecionar(entrada: string, sinal?: AbortSignal) {
        if (this.falharMetadados) throw new ErroDominio('indisponivel', 'Rede indisponível.', 503);
        this.chamadas.push(entrada);
        this.ativos++;
        this.maximo = Math.max(this.maximo, this.ativos);
        try {
            while (this.bloquear) {
                if (sinal?.aborted) {
                    this.abortos++;
                    throw new ErroDominio('trabalho_cancelado', 'Cancelado.', 409);
                }
                await dormir(10);
            }
            const id = new URL(entrada).searchParams.get('v')!;
            return { id, titulo: `Vídeo ${id}`, canalId: 'canal', canalNome: 'Canal F4', duracaoSegundos: 30,
                miniaturaUrl: null, publicadoEm: null, legendasManuais: ['pt'], legendasAutomaticas: [] };
        }
        finally {
            this.ativos--;
        }
    }
    async baixarLegenda(entrada: string) {
        if (this.falharLegenda) {
            this.falharLegenda = false;
            throw new ErroDominio('limite_youtube', 'O YouTube limitou as solicitações.', 503);
        }
        if (this.semLegenda.has(new URL(entrada).searchParams.get('v')!))
            return null;
        return { idioma: 'pt', origem: 'manual' as const, segmentos: [{ inicioMs: 0, fimMs: 1000, texto: 'Conteúdo preservado.' }] };
    }
    async descobrirPlaylist(_url: string, aoItem: (item: ItemPlaylist) => void, sinal?: AbortSignal) {
        for (const item of this.playlist) {
            if (sinal?.aborted)
                throw new ErroDominio('trabalho_cancelado', 'Cancelado.', 409);
            aoItem(item);
        }
        if (this.falharDescoberta)
            throw new ErroDominio('indisponivel', 'Rede interrompida na descoberta.', 503);
    }
}
async function ambiente(t: TestContext, concorrencia = 2) {
    const pasta = await mkdtemp(join(tmpdir(), 'contextflow-f4-'));
    const executor = new ExecutorTeste();
    const app = criarAplicacao(carregarConfig({ CONTEXTFLOW_PORTA: '0', CONTEXTFLOW_AMBIENTE: 'teste', CONTEXTFLOW_DADOS: pasta }), { executorYtdlp: executor, concorrencia });
    app.iniciarPersistencia();
    await new Promise<void>(ok => app.servidor.listen(0, '127.0.0.1', ok));
    const endereco = app.servidor.address();
    assert.ok(endereco && typeof endereco === 'object');
    const base = `http://127.0.0.1:${endereco.port}`;
    t.after(async () => { await app.encerrar(); assert.equal(resolve(dirname(pasta)), resolve(tmpdir())); await rm(pasta, { recursive: true, force: true }); });
    const post = async (caminho: string, corpo: unknown) => {
        const resposta = await fetch(base + caminho, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
        return { resposta, corpo: await resposta.json() as {
                ok: boolean;
                dados: TrabalhoDetalhado;
                erro?: {
                    codigo: string;
                    mensagem: string;
                };
            } };
    };
    const criar = async (id = 'aaaaaaaaaaa', chave = randomUUID()) => {
        const r = await post('/api/trabalhos', { tipo: 'importar-video', escopo: { url: url(id), chaveRequisicao: chave } });
        assert.equal(r.resposta.status, 202);
        return r.corpo.dados;
    };
    const obter = (id: string) => app.trabalhos.repositorio.detalhe(id);
    const terminal = (id: string) => ate(() => obter(id), r => ['concluido', 'falhou', 'cancelado'].includes(r.estado));
    return { app, executor, post, criar, obter, terminal, base, pasta };
}
test('202 persiste intenção antes da rede, fase indeterminada e navegação permanece disponível', async (t) => {
    const a = await ambiente(t);
    a.executor.bloquear = true;
    let intencaoPersistida: string | null = null;
    const inspecionar = a.executor.inspecionar.bind(a.executor);
    a.executor.inspecionar = async (entrada, sinal) => {
        // Verificar no instante da chamada externa. O executor pode começar
        // antes de o cliente consumir o 202, sem violar a persistência da intenção.
        const registro = a.app.banco.db.prepare("SELECT id,estado FROM trabalhos WHERE tipo='importar-video'").get();
        if (registro?.estado === 'executando') intencaoPersistida = String(registro.id);
        return inspecionar(entrada, sinal);
    };
    const j = await a.criar();
    assert.equal(j.estado, 'na-fila');
    assert.equal(j.tentativas, 0);
    const executando = await ate(() => a.obter(j.id), r => r.fase === 'metadados' && a.executor.chamadas.length > 0);
    assert.equal(intencaoPersistida, j.id);
    assert.equal(executando.progresso, null);
    assert.equal(executando.tentativas, 1);
    assert.equal((await fetch(a.base + '/api/saude')).status, 200);
    assert.equal((await fetch(a.base)).status, 200);
    a.executor.bloquear = false;
    assert.equal((await a.terminal(j.id)).estado, 'concluido');
});
test('idempotência retorna o mesmo trabalho e rejeita reutilizar chave para outro corpo', async (t) => {
    const a = await ambiente(t);
    const chave = randomUUID();
    const j = await a.criar('aaaaaaaaaaa', chave);
    assert.equal((await a.criar('aaaaaaaaaaa', chave)).id, j.id);
    const conflito = await a.post('/api/trabalhos', { tipo: 'importar-video', escopo: { url: url('bbbbbbbbbbb'), chaveRequisicao: chave } });
    assert.equal(conflito.resposta.status, 409);
    assert.equal(conflito.corpo.erro?.codigo, 'chave_conflitante');
    assert.equal(a.app.trabalhos.repositorio.pagina().itens.length, 1);
});
test('concorrência limitada e dois trabalhos para mesmo vídeo nunca executam em paralelo', async (t) => {
    const a = await ambiente(t);
    a.executor.bloquear = true;
    const um = await a.criar();
    const duplicado = await a.criar();
    const dois = await a.criar('bbbbbbbbbbb');
    const tres = await a.criar('ccccccccccc');
    await ate(() => a.executor.ativos, n => n === 2);
    assert.equal(a.executor.chamadas.filter(v => v === url()).length, 1);
    assert.ok(a.executor.maximo <= 2);
    a.executor.bloquear = false;
    for (const j of [um, duplicado, dois, tres])
        assert.equal((await a.terminal(j.id)).estado, 'concluido');
    assert.equal(a.executor.chamadas.filter(v => v === url()).length, 1, 'duplicata pronta não usa rede');
    assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM videos').get()!.n, 3);
});
test('cancelar na fila é idempotente, não chama o executor e não deixa vídeo Importando', async (t) => {
    const a = await ambiente(t);
    const j = await a.criar();
    await a.app.trabalhos.cancelar(j.id);
    await a.app.trabalhos.cancelar(j.id);
    assert.equal(a.obter(j.id).estado, 'cancelado');
    assert.equal(a.executor.chamadas.length, 0);
    assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM videos').get()!.n, 0);
});
test('cancelar execução propaga abort e aguarda a operação terminar', async (t) => {
    const a = await ambiente(t);
    a.executor.bloquear = true;
    const j = await a.criar();
    await ate(() => a.executor.ativos, n => n === 1);
    await a.app.trabalhos.cancelar(j.id);
    assert.equal(a.obter(j.id).estado, 'executando', 'não termina antes do executor observar o aborto');
    assert.equal((await a.terminal(j.id)).estado, 'cancelado');
    assert.equal(a.executor.abortos, 1);
    assert.equal(a.executor.ativos, 0);
});
test('cancelar após conclusão preserva conteúdo e resultado', async (t) => {
    const a = await ambiente(t);
    const j = await a.criar();
    const antes = await a.terminal(j.id);
    await a.app.trabalhos.cancelar(j.id);
    assert.deepEqual(a.obter(j.id), antes);
    assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM segmentos').get()!.n, 1);
});
test('falha de legenda preserva metadados e retry explícito mantém vídeo e identidade', async (t) => {
    const a = await ambiente(t);
    a.executor.falharLegenda = true;
    const j = await a.criar();
    const falho = await a.terminal(j.id);
    assert.equal(falho.estado, 'falhou');
    assert.equal(falho.erroCodigo, 'limite_youtube');
    assert.ok(falho.videoId);
    assert.equal(a.app.banco.db.prepare('SELECT estado FROM videos').get()!.estado, 'parcial');
    assert.equal(a.app.banco.db.prepare('SELECT codigo_motivo FROM transcricoes').get()!.codigo_motivo, 'limite_youtube');
    const chave = randomUUID();
    await a.app.trabalhos.repetir(j.id, chave);
    await a.app.trabalhos.repetir(j.id, chave);
    const pronto = await a.terminal(j.id);
    assert.equal(pronto.estado, 'concluido');
    assert.equal(pronto.tentativas, 2);
    assert.equal(pronto.videoId, falho.videoId);
    await a.app.trabalhos.repetir(j.id, chave);
    assert.equal(a.obter(j.id).tentativas, 2);
    assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM videos').get()!.n, 1);
    assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM segmentos').get()!.n, 1);
    assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM tentativas_trabalho').get()!.n, 2);
});
test('retry com nova falha de metadados não devolve resultado antigo como se fosse da nova tentativa', async t => {
    const a = await ambiente(t);
    a.executor.falharLegenda = true;
    const j = await a.criar();
    assert.ok((await a.terminal(j.id)).resultado);
    a.executor.falharMetadados = true;
    await a.app.trabalhos.repetir(j.id, randomUUID());
    const fim = await a.terminal(j.id);
    assert.equal(fim.estado, 'falhou');
    assert.equal(fim.erroCodigo, 'indisponivel');
    assert.equal(fim.resultado, null);
    assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM videos').get()!.n, 1);
});

test('sem legenda é conclusão Parcial legítima, sem loop ou retry implícito', async (t) => {
    const a = await ambiente(t);
    a.executor.semLegenda.add('aaaaaaaaaaa');
    const j = await a.criar();
    const pronto = await a.terminal(j.id);
    assert.equal(pronto.estado, 'concluido');
    assert.equal(pronto.tentativas, 1);
    assert.equal(a.app.banco.db.prepare('SELECT estado FROM videos').get()!.estado, 'parcial');
    await a.app.trabalhos.repetir(j.id, randomUUID());
    assert.equal(a.obter(j.id).tentativas, 1);
});
test('lote valida todas as linhas e não grava grupo parcialmente', async (t) => {
    const a = await ambiente(t);
    const r = await a.post('/api/ingestao/lote', { urls: [url(), 'https://vimeo.com/1'], chaveRequisicao: randomUUID() });
    assert.equal(r.resposta.status, 422);
    assert.match(r.corpo.erro!.mensagem, /Linha 2/);
    assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM trabalhos').get()!.n, 0);
});
test('lote de texto extrai vídeos em ordem, ignora sujeira e não persiste texto bruto', async (t) => {
    const a = await ambiente(t, 1);
    const texto = [
        `${url()} | Título não enviado ao executor`,
        'Notas de contexto',
        '[Segundo](https://youtu.be/bbbbbbbbbbb?t=3), https://m.youtube.com/shorts/ccccccccccc.',
        'https://www.youtube.com/@canal',
        'https://www.youtube.com.evil.example/watch?v=ddddddddddd',
        'https://youtu.be/aaaaaaaaaaa',
    ].join('\r\n');
    const r = await a.post('/api/ingestao/lote', { texto, chaveRequisicao: randomUUID() });
    assert.equal(r.resposta.status, 202);
    assert.deepEqual((r.corpo.dados as TrabalhoDetalhado & { lote: unknown }).lote,
        { videos: 3, linhasIgnoradas: 3, duplicatas: 1 });
    const fim = await a.terminal(r.corpo.dados.id);
    assert.equal(fim.contadores.concluidos, 3);
    const esperadas = ['aaaaaaaaaaa', 'bbbbbbbbbbb', 'ccccccccccc'].map(url);
    assert.deepEqual([...a.executor.chamadas].sort(), esperadas);
    const escopo = a.app.trabalhos.repositorio.registro(fim.id).escopo;
    assert.deepEqual(JSON.parse(escopo).urls, esperadas);
    assert.doesNotMatch(escopo, /Título|Notas|evil/);
});
test('lote sem vídeo no texto rejeita sem gravar trabalho', async (t) => {
    const a = await ambiente(t);
    const r = await a.post('/api/ingestao/lote', {
        texto: 'Notas\nhttps://youtube.com/playlist?list=PLteste\nhttps://example.org',
        chaveRequisicao: randomUUID(),
    });
    assert.equal(r.resposta.status, 422);
    assert.match(r.corpo.erro!.mensagem, /Nenhum link de vídeo/);
    assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM trabalhos').get()!.n, 0);
});
test('lote deduplica filhos, termina com concorrência 1 e agrega ausência de legenda', async (t) => {
    const a = await ambiente(t, 1);
    a.executor.semLegenda.add('bbbbbbbbbbb');
    const r = await a.post('/api/ingestao/lote', { urls: [url(), url(), url('bbbbbbbbbbb')], chaveRequisicao: randomUUID() });
    assert.equal(r.resposta.status, 202);
    const fim = await a.terminal(r.corpo.dados.id);
    assert.equal(fim.estado, 'concluido');
    assert.deepEqual(fim.contadores, { total: 2, concluidos: 2, falhos: 0, cancelados: 0, semLegenda: 1 });
});
test('playlist reconcilia duplicatas, mantém indisponível por item e retry não redescobre manifesto fechado', async (t) => {
    const a = await ambiente(t);
    a.executor.playlist = [
        { youtubeId: 'aaaaaaaaaaa', titulo: 'Um', posicao: 0 }, { youtubeId: 'aaaaaaaaaaa', titulo: 'Repetido', posicao: 1 },
        { youtubeId: null, titulo: 'Privado', posicao: 2 }, { youtubeId: 'bbbbbbbbbbb', titulo: 'Dois', posicao: 3 },
    ];
    const j = await a.app.trabalhos.criar('importar-playlist', { url: 'https://youtube.com/playlist?list=PLteste', chaveRequisicao: randomUUID() });
    const fim = await a.terminal(j.id);
    assert.equal(fim.estado, 'falhou');
    assert.equal(fim.contadores.total, 3);
    assert.equal(fim.contadores.falhos, 1);
    a.executor.playlist = [{ youtubeId: 'ccccccccccc', titulo: 'Novo remoto', posicao: 0 }];
    await a.app.trabalhos.repetir(j.id, randomUUID());
    await a.terminal(j.id);
    assert.equal(a.obter(j.id).contadores.total, 3);
    assert.equal(a.app.banco.db.prepare("SELECT COUNT(*) n FROM videos WHERE youtube_id='ccccccccccc'").get()!.n, 0);
});
test('descoberta interrompida reconcilia IDs e entradas sem ID ao repetir', async (t) => {
    const a = await ambiente(t);
    a.executor.falharDescoberta = true;
    a.executor.playlist = [{ youtubeId: 'aaaaaaaaaaa', titulo: 'Um', posicao: 0 }, { youtubeId: null, titulo: 'Sem ID', posicao: 1 }];
    const j = await a.app.trabalhos.criar('importar-playlist', { url: 'https://youtube.com/playlist?list=PLteste', chaveRequisicao: randomUUID() });
    await a.terminal(j.id);
    a.executor.falharDescoberta = false;
    a.executor.playlist.push({ youtubeId: 'bbbbbbbbbbb', titulo: 'Dois', posicao: 2 });
    await a.app.trabalhos.repetir(j.id, randomUUID());
    const fim = await a.terminal(j.id);
    assert.equal(fim.contadores.total, 3, 'repetir não duplica item sem ID');
});
test('cancelar pai não cancela outro grupo e preserva filhos já concluídos', async (t) => {
    const a = await ambiente(t, 1);
    a.executor.bloquear = true;
    const r = await a.post('/api/ingestao/lote', { urls: [url(), url('bbbbbbbbbbb')], chaveRequisicao: randomUUID() });
    const pai = r.corpo.dados;
    await ate(() => a.executor.ativos, n => n === 1);
    const outro = await a.criar('ccccccccccc');
    await a.app.trabalhos.cancelar(pai.id);
    assert.equal((await a.terminal(pai.id)).estado, 'cancelado');
    a.executor.bloquear = false;
    assert.equal((await a.terminal(outro.id)).estado, 'concluido');
});
test('requisições inválidas, tipo futuro, paginação e status de cancelamento são reais', async (t) => {
    const a = await ambiente(t);
    for (const escopo of [{ url: url(), idiomas: ['--exec'], chaveRequisicao: randomUUID() }, { url: 'https://vimeo.com/1', chaveRequisicao: randomUUID() }])
        assert.equal((await a.post('/api/trabalhos', { tipo: 'importar-video', escopo })).resposta.status, 422);
    assert.equal((await a.post('/api/trabalhos', { tipo: 'gerar-resumo', escopo: {} })).resposta.status, 422);
    assert.equal((await fetch(a.base + '/api/trabalhos/inexistente')).status, 404);
    assert.equal((await fetch(a.base + '/api/trabalhos?limite=0')).status, 422);
    const j = await a.criar();
    const cancelado = await a.post(`/api/trabalhos/${j.id}/cancelar`, {});
    assert.equal(cancelado.resposta.status, 200);
    const detalhe = await (await fetch(a.base + `/api/trabalhos/${j.id}`)).json() as {
        dados: Record<string, unknown>;
    };
    assert.ok(!('escopo' in detalhe.dados));
});
test('fencing rejeita executor antigo e rollback protege conteúdo junto com conclusão', () => {
    const banco = Banco.abrir({ arquivo: ':memory:' });
    banco.migrar();
    const repo = new RepositorioTrabalhos(banco);
    try {
        repo.lease('primeiro');
        const id = repo.inserir('importar-video', { url: url() }, 'aaaaaaaaaaa');
        const tentativa = repo.claim('primeiro')!;
        assert.equal(repo.lease('segundo'), false);
        assert.throws(() => repo.concluir(tentativa, { ok: true }, () => { banco.db.exec("INSERT INTO colecoes VALUES('colecao','Preservar')"); throw new Error('Falha de disco simulada.'); }));
        assert.equal(banco.db.prepare('SELECT COUNT(*) n FROM colecoes').get()!.n, 0);
        assert.equal(repo.detalhe(id).estado, 'executando');
        repo.lease('segundo', 30000, Date.now() + 31000);
        assert.throws(() => repo.concluir(tentativa, { ok: true }), /substituída/);
        assert.equal(repo.detalhe(id).estado, 'na-fila');
        assert.equal(repo.claim('segundo')!.tentativas, 2);
        assert.equal(banco.db.prepare('SELECT estado FROM tentativas_trabalho WHERE numero=1').get()!.estado, 'interrompido');
    }
    finally {
        banco.fechar();
    }
});

test('cancelamento persistido antes do commit impede qualquer escrita de conteúdo', () => {
    const banco = Banco.abrir({ arquivo: ':memory:' }); banco.migrar();
    const repo = new RepositorioTrabalhos(banco);
    try {
        repo.lease('executor');
        const id = repo.inserir('importar-video', { url: url() }, 'aaaaaaaaaaa');
        const tentativa = repo.claim('executor')!;
        repo.cancelar(id);
        assert.throws(() => repo.concluir(tentativa, {}, () => banco.db.exec("INSERT INTO colecoes VALUES('nao','Não gravar')")),
            (erro: unknown) => erro instanceof ErroDominio && erro.codigo === 'trabalho_cancelado');
        assert.equal(banco.db.prepare('SELECT COUNT(*) n FROM colecoes').get()!.n, 0);
        repo.falhar(tentativa, new Error('Operação abortada.'));
        assert.equal(repo.detalhe(id).estado, 'cancelado');
    } finally { banco.fechar(); }
});
test('migração F3 → F4 → F3 → F4 → F5 preserva dados existentes e histórico de schema', () => {
    const banco = Banco.abrir({ arquivo: ':memory:' });
    try {
        banco.migrar(MIGRACOES.slice(0, 1));
        banco.db.exec(`
          INSERT INTO colecoes VALUES('anterior','Coleção existente');
          INSERT INTO videos(id,youtube_id,titulo,url,estado,criado_em,atualizado_em)
            VALUES('v','aaaaaaaaaaa','Vídeo anterior','https://youtu.be/aaaaaaaaaaa','pronto','2026-01-01','2026-01-01');
          INSERT INTO transcricoes(id,video_id,idioma,origem,estado,motivo,atualizado_em)
            VALUES('t','v','pt','manual','pronta',NULL,'2026-01-01');
          INSERT INTO segmentos VALUES('t',0,0,1000,'Texto original');
          INSERT INTO resumos VALUES('v','teste','modelo','p1','r1','Resumo original','pronto',NULL,'2026-01-01','2026-01-01');
          INSERT INTO colecao_videos VALUES('anterior','v');
        `);
        // Seleciona apenas colunas da v1 para comparar dados preservados (ignora colunas novas da F5)
        const colunasVideosV1 = 'id, youtube_id, titulo, canal_id, canal_nome, duracao_segundos, url, miniatura_url, publicado_em, estado, criado_em, atualizado_em';
        const conteudo = () => ({
          videos: banco.db.prepare(`SELECT ${colunasVideosV1} FROM videos`).all(),
          transcricoes: banco.db.prepare('SELECT id,video_id,idioma,origem,estado,motivo,atualizado_em FROM transcricoes').all(),
          segmentos: banco.db.prepare('SELECT * FROM segmentos').all(),
          resumos: banco.db.prepare('SELECT * FROM resumos').all(),
          colecoes: banco.db.prepare('SELECT * FROM colecoes').all(),
          associacoes: banco.db.prepare('SELECT * FROM colecao_videos').all(),
        });
        const antes = conteudo();
        assert.equal(banco.migrar(), MIGRACOES.length - 1); // migrações posteriores à F3
        assert.equal(banco.migrar(), 0);
        assert.deepEqual(conteudo(), antes);
        banco.reverterPara(1);
        assert.equal(banco.versaoAtual(), 1);
        assert.deepEqual(conteudo(), antes);
        assert.equal(banco.db.prepare('SELECT titulo FROM colecoes').get()!.titulo, 'Coleção existente');
        assert.equal(banco.migrar(), MIGRACOES.length - 1); // migrações posteriores à F3
        assert.deepEqual(conteudo(), antes);
        assert.equal(banco.db.prepare('SELECT COUNT(*) n FROM trabalhos').get()!.n, 0);
    }
    finally {
        banco.fechar();
    }
});
test('subprocesso Node real é encerrado antes de confirmar aborto no Windows e Linux', async () => {
    const controle = new AbortController();
    let pid = 0;
    await assert.rejects(() => executarProcesso(process.execPath, ['-e', "console.log(process.pid);setInterval(()=>{},1000)"], 5000, () => { }, controle.signal, linha => { pid = Number(linha); controle.abort(); }), (erro: unknown) => erro instanceof ErroDominio && erro.codigo === 'trabalho_cancelado');
    assert.ok(pid > 0);
    assert.throws(() => process.kill(pid, 0));
});
test('timeout de subprocesso Node real aguarda close e não deixa processo vivo', async () => {
    let pid = 0;
    await assert.rejects(() => executarProcesso(process.execPath, ['-e', "console.log(process.pid);setInterval(()=>{},1000)"], 2000, () => { }, undefined, linha => { pid = Number(linha); }), (erro: unknown) => erro instanceof ErroDominio && erro.codigo === 'ytdlp_timeout');
    assert.ok(pid > 0);
    assert.throws(() => process.kill(pid, 0));
});
test('atualizar base F3 cria backup consistente verificável antes da migração', async (t) => {
    const pasta = await mkdtemp(join(tmpdir(), 'contextflow-backup-'));
    t.after(async () => { assert.equal(resolve(dirname(pasta)), resolve(tmpdir())); await rm(pasta, { recursive: true, force: true }); });
    const banco = Banco.abrir({ arquivo: join(pasta, 'contextflow.db') });
    try {
        banco.migrar(MIGRACOES.slice(0, 1));
        banco.db.exec("INSERT INTO colecoes VALUES('original','Conteúdo anterior')");
        banco.migrar();
        const arquivos = await readdir(join(pasta, 'backups'));
        assert.equal(arquivos.length, 1);
        const copia = Banco.abrir({ arquivo: join(pasta, 'backups', arquivos[0]!) });
        try {
            assert.equal(copia.versaoAtual(), 1);
            assert.equal(copia.db.prepare('SELECT titulo FROM colecoes').get()!.titulo, 'Conteúdo anterior');
        }
        finally {
            copia.fechar();
        }
    }
    finally {
        banco.fechar();
    }
});
