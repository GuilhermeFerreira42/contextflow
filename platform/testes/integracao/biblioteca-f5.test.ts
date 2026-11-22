import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { randomUUID } from 'node:crypto';
import type { Video } from '@contextflow/compartilhado';
import { criarAplicacao } from '../../src/motor/src/aplicacao.ts';
import { carregarConfig } from '../../src/motor/src/nucleo/configuracao.ts';
import { Banco, MIGRACOES } from '../../src/motor/src/persistencia/banco.ts';
import { RepositorioBibliotecaSqlite } from '../../src/motor/src/modulos/biblioteca/repositorio-sqlite.ts';

const video = (i: number): Video => ({
  id: `video-${i}`, youtubeId: String(i).padStart(11, '0'), titulo: `Título ${9-i}`,
  canalId: `canal-${i%2}`, canalNome: `Canal ${i%2}`, duracaoSegundos: i%3 ? i*10 : null,
  url: `https://youtube.com/watch?v=${String(i).padStart(11, '0')}`, miniaturaUrl: null,
  publicadoEm: null, estado: i%2 ? 'parcial' : 'pronto',
  criadoEm: '2026-01-01T00:00:00.000Z', atualizadoEm: '2026-01-01T00:00:00.000Z',
});

async function ambiente(t: TestContext) {
  const controle = { bloquear: false };
  const pasta = await mkdtemp(join(tmpdir(), 'contextflow-f5-'));
  const app = criarAplicacao(carregarConfig({ CONTEXTFLOW_PORTA:'0', CONTEXTFLOW_AMBIENTE:'teste', CONTEXTFLOW_DADOS:pasta }), {
    executorYtdlp: {
      async disponivel() { return { disponivel:true, versao:'teste', caminho:'dublê' }; },
      async inspecionar(url, sinal) {
        while(controle.bloquear && !sinal?.aborted) await new Promise(r=>setTimeout(r,10));
        return { id:new URL(url).searchParams.get('v')!, titulo:'Importado de verdade pelo serviço',
        canalId:'c', canalNome:'Canal', duracaoSegundos:12, miniaturaUrl:null, publicadoEm:null,
        legendasManuais:[], legendasAutomaticas:[] }; },
      async baixarLegenda() { return null; },
    },
  });
  app.iniciarPersistencia(); await new Promise<void>(ok => app.servidor.listen(0, '127.0.0.1', ok));
  const endereco = app.servidor.address(); assert.ok(endereco && typeof endereco === 'object');
  const base = `http://127.0.0.1:${endereco.port}`;
  t.after(async () => { await app.encerrar(); assert.equal(resolve(dirname(pasta)), resolve(tmpdir())); await rm(pasta, {recursive:true,force:true}); });
  const post = async (rota:string, corpo:unknown) => {
    const resposta=await fetch(base+rota,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(corpo)});
    return {status:resposta.status, corpo:await resposta.json() as any};
  };
  const repo = new RepositorioBibliotecaSqlite(app.banco.db);
  return {app,base,post,repo,controle};
}

test('F5: cursor percorre a ordenação por título sem repetir ou perder vídeos', async () => {
  const banco=Banco.abrir({arquivo:':memory:'});banco.migrar();
  try {
    const repo=new RepositorioBibliotecaSqlite(banco.db);
    for(let i=0;i<8;i++)await repo.inserir(video(i));
    const vistos:Video[]=[];let cursor:string|null=null;
    do { const pagina=await repo.consultar({filtro:{ordenacao:'titulo',ordenacaoDirecao:'asc'},cursor,limite:2});
      vistos.push(...pagina.itens);cursor=pagina.proximoCursor;
      if(vistos.length>16)throw new Error('Cursor entrou em ciclo.');
    } while(cursor);
    assert.equal(vistos.length,8);assert.equal(new Set(vistos.map(v=>v.id)).size,8);
    assert.deepEqual(vistos.map(v=>v.titulo),vistos.map(v=>v.titulo).sort());
  } finally { banco.fechar(); }
});

test('F5: remover em lote apaga vídeo e filhos, em vez de marcar erro', async t => {
  const a=await ambiente(t);await a.repo.inserir(video(1));
  a.app.banco.db.exec(`INSERT INTO transcricoes(id,video_id,idioma,origem,estado,atualizado_em)
    VALUES('t','video-1','pt','manual','pronta','2026-01-01'); INSERT INTO segmentos VALUES('t',0,0,1000,'Preservar até confirmar');`);
  const resposta=await a.post('/api/biblioteca/lote',{acao:'remover',ids:['video-1']});
  assert.equal(resposta.status,200);assert.equal(resposta.corpo.dados.processados,1);
  assert.equal(await a.repo.porId('video-1'),null);
  assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM segmentos').get()!.n,0);
});

test('F5: reimportar em lote grava trabalhos reais na fila persistente', async t => {
  const a=await ambiente(t);await a.repo.inserir(video(1));await a.repo.inserir(video(2));
  const resposta=await a.post('/api/biblioteca/lote',{acao:'reimportar',ids:['video-1','video-2'],chaveRequisicao:randomUUID()});
  assert.equal(resposta.status,200);assert.equal(resposta.corpo.dados.processados,2);
  assert.ok(Number(a.app.banco.db.prepare('SELECT COUNT(*) n FROM trabalhos').get()!.n)>=2,'o contador não substitui enfileiramento');
});

for (const campo of ['criado_em','titulo','canal','duracao','estado'] as const) {
  for (const direcao of ['asc','desc'] as const) test(`F5: paginação estável ${campo} ${direcao} com empates e nulos`, async () => {
    const banco=Banco.abrir({arquivo:':memory:'});banco.migrar();
    try {
      const repo=new RepositorioBibliotecaSqlite(banco.db);
      for(let i=0;i<25;i++)await repo.inserir({...video(i),titulo:`Grupo ${i%4}`,canalNome:i%3?'Canal':null,criadoEm:`2026-01-${String(i%5+1).padStart(2,'0')}T00:00:00.000Z`});
      const filtro={ordenacao:campo,ordenacaoDirecao:direcao};
      const referencia=await repo.consultar({filtro,cursor:null,limite:100});
      const vistos:string[]=[];let cursor:string|null=null;
      do {const p=await repo.consultar({filtro,cursor,limite:3});vistos.push(...p.itens.map(v=>v.id));cursor=p.proximoCursor;
        assert.equal(p.total,25);assert.ok(vistos.length<=25,'cursor não pode entrar em ciclo');
      }while(cursor);
      assert.deepEqual(vistos,referencia.itens.map(v=>v.id));assert.equal(new Set(vistos).size,25);
    }finally{banco.fechar();}
  });
}

test('F5: filtro combina busca, estado, canal, coleção, resumo e total filtrado', async t => {
  const a=await ambiente(t);for(let i=0;i<10;i++)await a.repo.inserir(video(i));
  const colecao=await a.post('/api/colecoes',{titulo:'Coleção de estudo'});
  const id=colecao.corpo.dados.id;
  await a.post(`/api/colecoes/${id}/videos`,{videoIds:['video-2','video-3']});
  a.app.banco.db.exec("INSERT INTO resumos VALUES('video-2','teste','modelo','v1','r1','Texto','pronto',NULL,'2026','2026')");
  const pagina=await(await fetch(a.base+`/api/biblioteca?busca=T%C3%ADtulo&estado=pronto&canalId=canal-0&colecaoId=${id}&temResumo=1`)).json() as any;
  assert.equal(pagina.dados.total,1);assert.equal(pagina.dados.itens[0].id,'video-2');
  assert.equal(pagina.dados.itens[0].temResumo,true);assert.deepEqual(pagina.dados.itens[0].colecaoIds,[id]);
  const substring=await(await fetch(a.base+`/api/biblioteca?colecaoId=${id.slice(0,8)}`)).json() as any;
  assert.equal(substring.dados.total,0,'coleção usa vínculo exato, não substring do JSON');
});

test('F5: projeções seguem resumos/vínculos e atualização de vídeo não apaga metadados derivados', async t => {
  const a=await ambiente(t);await a.repo.inserir(video(1));
  const c=await a.post('/api/colecoes',{titulo:'Fonte única'});const id=c.corpo.dados.id;
  a.app.banco.db.prepare('INSERT INTO colecao_videos VALUES(?,?)').run(id,'video-1');
  a.app.banco.db.exec("INSERT INTO resumos VALUES('video-1','teste','modelo','v1','r1','Texto','pronto',NULL,'2026','2026')");
  await a.repo.atualizar({...video(1),colecaoIds:[],temResumo:false,titulo:'Título atualizado'});
  const atual=await a.repo.porId('video-1');assert.equal(atual?.temResumo,true);assert.deepEqual(atual?.colecaoIds,[id]);
  a.app.banco.db.exec("UPDATE resumos SET estado='erro' WHERE video_id='video-1'");
  assert.equal((await a.repo.porId('video-1'))?.temResumo,false);
  a.app.banco.db.prepare('DELETE FROM colecao_videos WHERE colecao_id=?').run(id);
  assert.deepEqual((await a.repo.porId('video-1'))?.colecaoIds,[]);
});

test('F5: coleção não recebe vínculos parciais se um vídeo não existe; repetição é idempotente', async t => {
  const a=await ambiente(t);await a.repo.inserir(video(1));
  const c=await a.post('/api/colecoes',{titulo:'Atômica'});const id=c.corpo.dados.id;
  assert.equal((await a.post(`/api/colecoes/${id}/videos`,{videoIds:['video-1','inexistente']})).status,404);
  assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM colecao_videos').get()!.n,0);
  const primeira=await a.post(`/api/colecoes/${id}/videos`,{videoIds:['video-1','video-1']});
  assert.equal(primeira.corpo.dados.adicionados,1);
  const segunda=await a.post(`/api/colecoes/${id}/videos`,{videoIds:['video-1']});assert.equal(segunda.corpo.dados.jaExistiam,1);
  await fetch(a.base+`/api/colecoes/${id}/videos/video-1`,{method:'DELETE'});
  assert.ok(await a.repo.porId('video-1'));
  const colecoes=await(await fetch(a.base+'/api/colecoes')).json() as any;assert.equal(colecoes.dados.itens[0].contagem,0);
});

test('F5: reimportar com a mesma chave não duplica trabalhos e relata IDs ausentes', async t => {
  const a=await ambiente(t);await a.repo.inserir(video(1));const chaveRequisicao=randomUUID();
  const corpo={acao:'reimportar',ids:['video-1','video-1','inexistente'],chaveRequisicao};
  const um=await a.post('/api/biblioteca/lote',corpo), dois=await a.post('/api/biblioteca/lote',corpo);
  assert.equal(um.corpo.dados.processados,1);assert.equal(um.corpo.dados.falhas.length,1);
  assert.equal(um.corpo.dados.trabalhoId,dois.corpo.dados.trabalhoId);
  assert.equal(a.app.banco.db.prepare('SELECT COUNT(*) n FROM trabalhos').get()!.n,2);
});

test('F5: remover durante reimportação cancela a gravação tardia do mesmo vídeo', async t => {
  const a=await ambiente(t);await a.repo.inserir(video(1));a.controle.bloquear=true;
  const job=await a.app.trabalhos.criar('importar-video',{url:video(1).url,chaveRequisicao:randomUUID()});
  const esperar=async(estado:string)=>{for(let i=0;i<300;i++){if(a.app.trabalhos.repositorio.registro(job.id).estado===estado)return;await new Promise(r=>setTimeout(r,10));}throw new Error('Estado não atingido');};
  await esperar('executando');await a.post('/api/biblioteca/lote',{acao:'remover',ids:['video-1']});
  await esperar('cancelado');assert.equal(await a.repo.porId('video-1'),null);
});

test('F5: filtros inválidos são rejeitados antes de executar operações', async t => {
  const a=await ambiente(t);
  for(const query of ['ordenacao=sql','ordenacaoDirecao=up','estado=invalido','temResumo=sim','limite=1abc'])
    assert.equal((await fetch(a.base+'/api/biblioteca?'+query)).status,422);
  for(const ids of [[1],[''],[null]])assert.equal((await a.post('/api/biblioteca/lote',{acao:'remover',ids})).status,422);
});

test('F5: migração 004 reconcilia dados antigos e rollback preserva vínculos e resumos', () => {
  const banco=Banco.abrir({arquivo:':memory:'});
  try {
    banco.migrar(MIGRACOES.slice(0,3));
    banco.db.exec(`INSERT INTO videos(id,youtube_id,titulo,url,estado,criado_em,atualizado_em) VALUES('v','aaaaaaaaaaa','Antes','url','pronto','2026','2026');
      INSERT INTO colecoes VALUES('c','Coleção');INSERT INTO colecao_videos VALUES('c','v');
      INSERT INTO resumos VALUES('v','teste','m','p','r','Texto original','pronto',NULL,'2026','2026');`);
    assert.equal(banco.migrar(),MIGRACOES.length - 3);assert.equal(banco.db.prepare("SELECT tem_resumo FROM videos WHERE id='v'").get()!.tem_resumo,1);
    assert.equal(banco.db.prepare("SELECT colecao_ids FROM videos WHERE id='v'").get()!.colecao_ids,'["c"]');
    banco.reverterPara(3);assert.equal(banco.db.prepare('SELECT COUNT(*) n FROM colecao_videos').get()!.n,1);
    assert.equal(banco.db.prepare('SELECT texto FROM resumos').get()!.texto,'Texto original');
    assert.equal(banco.migrar(),MIGRACOES.length - 3);
  }finally{banco.fechar();}
});

test('F5: consulta e busca em 10 mil vídeos têm métricas reais registradas', async t => {
  const a=await ambiente(t);
  a.app.banco.executarTransacao(()=>{for(let i=0;i<10000;i++)a.repo.inserirSincrono({...video(i),titulo:`Vídeo ${String(i).padStart(5,'0')}`});});
  const tempos:number[]=[];
  for(let i=0;i<20;i++){
    const inicio=performance.now();const resposta=await fetch(a.base+'/api/biblioteca?busca=Vídeo&ordenacao=titulo&ordenacaoDirecao=asc&limite=100');
    const corpo=await resposta.json() as any;tempos.push(performance.now()-inicio);assert.equal(corpo.dados.total,10000);assert.equal(corpo.dados.itens.length,100);
  }
  tempos.sort((a,b)=>a-b);t.diagnostic(`Consulta HTTP 10k: mediana=${tempos[10]!.toFixed(2)}ms; p95=${tempos[18]!.toFixed(2)}ms; amostras=20`);
});
